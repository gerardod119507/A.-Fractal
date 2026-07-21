# Academia Fractal · despliegue para GitHub Pages

Este repositorio contiene únicamente la versión publicable de **Mecánica de la partícula**, basada en las páginas 97–131 del visor PDF. El contenido académico está cifrado; las claves y el JSON editorial no forman parte de esta carpeta.

## Publicación

1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta, incluida `.github/`.
2. Ve a **Settings → Pages → Build and deployment** y selecciona **GitHub Actions**.
3. En **Actions**, espera a que termine `Deploy Academia Fractal to GitHub Pages`.
4. Abre la URL mostrada por GitHub Pages y distribuye un código distinto a cada estudiante.

## Alcance

- Consolidación previa, teoría, consolidación teórica, aplicaciones y práctica.
- 16 aplicaciones y 51 resoluciones prácticas paso a paso.
- Buscador, filtros, modo enfoque, ecuaciones MathJax y gráficos SVG.
- Diez ranuras de acceso cifradas con AES-256-GCM y claves derivadas por PBKDF2.

GitHub Pages no ofrece identidad individual ni revocación de claves. Los diez códigos limitan el conjunto de credenciales, pero una credencial puede compartirse. Para auditoría, bloqueo remoto o cuentas nominales se necesita un backend.
