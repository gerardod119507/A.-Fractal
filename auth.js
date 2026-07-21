const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fromB64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function deriveKey(password, slot) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'PBKDF2', salt: fromB64(slot.salt), iterations: slot.iterations, hash: 'SHA-256'
  }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptCombined(key, iv, combined, aad) {
  return crypto.subtle.decrypt({
    name: 'AES-GCM', iv: fromB64(iv), additionalData: encoder.encode(aad), tagLength: 128
  }, key, fromB64(combined));
}

async function tryPassword(password, envelope) {
  const hinted = password.match(/^FRACTAL-(\d{2})-/i);
  const index = hinted ? Number(hinted[1]) - 1 : -1;
  const candidates = index >= 0 && envelope.keys[index] ? [envelope.keys[index]] : envelope.keys;
  for (const slot of candidates) {
    try {
      const wrappingKey = await deriveKey(password, slot);
      const rawContentKey = await decryptCombined(wrappingKey, slot.iv, slot.wrappedKey, `academia-fractal-key:${slot.id}`);
      const contentKey = await crypto.subtle.importKey('raw', rawContentKey, { name: 'AES-GCM' }, false, ['decrypt']);
      const plain = await decryptCombined(contentKey, envelope.content.iv, envelope.content.ciphertext, envelope.content.aad);
      return JSON.parse(decoder.decode(plain));
    } catch {
      // Se prueba el siguiente cupo sin revelar cuál coincidió.
    }
  }
  throw new Error('Clave no válida');
}

function setStatus(message, kind = '') {
  const status = document.querySelector('#authStatus');
  status.textContent = message;
  status.dataset.kind = kind;
}

export async function unlockSubject(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar el contenido protegido.');
  const envelope = await response.json();
  const gate = document.querySelector('#authGate');
  const form = document.querySelector('#authForm');
  const input = document.querySelector('#accessPassword');
  const submit = form.querySelector('button[type="submit"]');
  let attempts = 0;

  gate.hidden = false;
  input.focus();
  return new Promise(resolve => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = input.value.trim();
      if (!password) {
        setStatus('Escribe tu código de acceso.', 'error');
        input.focus();
        return;
      }
      submit.disabled = true;
      input.disabled = true;
      setStatus('Verificando acceso…', 'loading');
      try {
        const subject = await tryPassword(password, envelope);
        input.value = '';
        gate.hidden = true;
        document.body.classList.remove('is-locked');
        resolve(subject);
      } catch {
        attempts += 1;
        const delay = Math.min(5000, attempts * 700);
        setStatus(`Código incorrecto. Intenta nuevamente en ${Math.ceil(delay / 1000)} s.`, 'error');
        window.setTimeout(() => {
          input.disabled = false;
          submit.disabled = false;
          input.focus();
          input.select();
        }, delay);
      }
    });
  });
}
