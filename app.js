import { unlockSubject } from './auth.js';

const CATALOG_URL = './data/catalog.json';

const state = {
  catalog: null,
  subject: null,
  activeSubjectId: 'fisica',
  activeChapterId: 'ch-7',
  activeFilter: 'all',
  activeSubtopicId: 'all',
  searchIndex: [],
  searchResults: [],
  searchActiveIndex: -1,
  currentSolverItem: null,
  currentStep: 0,
  selectedFormulaTopics: new Set()
};

const dom = {
  menuButton: document.querySelector('#menuButton'),
  sidebar: document.querySelector('#sidebar'),
  subjectSelect: document.querySelector('#subjectSelect'),
  chapterNav: document.querySelector('#chapterNav'),
  moduleLabel: document.querySelector('#moduleLabel'),
  pageTitle: document.querySelector('#pageTitle'),
  pageSummary: document.querySelector('#pageSummary'),
  subtopicSelect: document.querySelector('#subtopicSelect'),
  filterButtons: [...document.querySelectorAll('[data-filter]')],
  contentGrid: document.querySelector('#contentGrid'),
  focusModeButton: document.querySelector('#focusModeButton'),
  heroSearchButton: document.querySelector('#heroSearchButton'),
  heroFormulaButton: document.querySelector('#heroFormulaButton'),
  formulaBuilderButton: document.querySelector('#formulaBuilderButton'),
  logoutButton: document.querySelector('#logoutButton'),

  globalSearch: document.querySelector('#globalSearch'),
  clearSearch: document.querySelector('#clearSearch'),
  searchPanel: document.querySelector('#searchPanel'),
  searchResults: document.querySelector('#searchResults'),
  searchStatus: document.querySelector('#searchStatus'),

  solverDialog: document.querySelector('#solverDialog'),
  closeSolverButton: document.querySelector('#closeSolverButton'),
  solverTitle: document.querySelector('#solverTitle'),
  problemStatement: document.querySelector('#problemStatement'),
  simulationMount: document.querySelector('#simulationMount'),
  toggleVisualButton: document.querySelector('#toggleVisualButton'),
  stepCounter: document.querySelector('#stepCounter'),
  stepSelect: document.querySelector('#stepSelect'),
  stepContent: document.querySelector('#stepContent'),
  previousStepButton: document.querySelector('#previousStepButton'),
  replayStepButton: document.querySelector('#replayStepButton'),
  nextStepButton: document.querySelector('#nextStepButton'),

  formulaDialog: document.querySelector('#formulaDialog'),
  closeFormulaButton: document.querySelector('#closeFormulaButton'),
  formulaTopicTree: document.querySelector('#formulaTopicTree'),
  selectAllTopics: document.querySelector('#selectAllTopics'),
  clearAllTopics: document.querySelector('#clearAllTopics'),
  includeDiagrams: document.querySelector('#includeDiagrams'),
  includeVariables: document.querySelector('#includeVariables'),
  includeSigns: document.querySelector('#includeSigns'),
  compactSheet: document.querySelector('#compactSheet'),
  formulaPreview: document.querySelector('#formulaPreview'),
  formulaSelectionCount: document.querySelector('#formulaSelectionCount'),
  printFormulaButton: document.querySelector('#printFormulaButton'),
  downloadFormulaButton: document.querySelector('#downloadFormulaButton'),
  formulaPrintSurface: document.querySelector('#formulaPrintSurface'),
  toast: document.querySelector('#toast')
};

boot();

async function boot() {
  try {
    state.catalog = await fetchJSON(CATALOG_URL);
    renderSubjectOptions();
    await loadSubject(state.activeSubjectId);
    bindEvents();
    window.lucide?.createIcons();
  } catch (error) {
    console.error(error);
    dom.contentGrid.innerHTML = `
      <div class="empty-state">
        <h2>No se pudo abrir la plataforma</h2>
        <p>Ejecuta el proyecto mediante un servidor local, por ejemplo:</p>
        <div class="equation"><code>python -m http.server 8000</code></div>
      </div>`;
  }
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  return response.json();
}

async function loadSubject(subjectId) {
  const record = state.catalog.subjects.find(item => item.id === subjectId && item.enabled);
  if (!record) throw new Error(`Materia no encontrada: ${subjectId}`);
  state.subject = await unlockSubject(record.dataUrl);
  state.activeSubjectId = subjectId;
  state.activeChapterId = state.subject.chapters[0]?.id;
  state.activeSubtopicId = 'all';
  state.searchIndex = buildSearchIndex(state.subject);
  renderNavigation();
  renderChapter();
  renderFormulaTopicTree();
}

function bindEvents() {
  dom.menuButton.addEventListener('click', () => {
    const open = dom.sidebar.classList.toggle('is-open');
    dom.menuButton.setAttribute('aria-expanded', String(open));
  });

  dom.subjectSelect.addEventListener('change', async event => {
    await loadSubject(event.target.value);
    showToast(`Materia activa: ${state.subject.subject.name}`);
  });

  dom.filterButtons.forEach(button => button.addEventListener('click', () => {
    state.activeFilter = button.dataset.filter;
    dom.filterButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    renderCards();
  }));

  dom.subtopicSelect.addEventListener('change', event => {
    state.activeSubtopicId = event.target.value;
    renderCards();
  });

  dom.focusModeButton.addEventListener('click', () => {
    const active = document.body.classList.toggle('focus-mode');
    dom.focusModeButton.setAttribute('aria-pressed', String(active));
    showToast(active ? 'Modo enfoque activado.' : 'Modo enfoque desactivado.');
  });

  dom.formulaBuilderButton.addEventListener('click', () => openFormulaBuilder());
  dom.heroFormulaButton.addEventListener('click', () => openFormulaBuilder({ chapterId: state.activeChapterId }));
  dom.heroSearchButton.addEventListener('click', focusSearch);
  dom.logoutButton.addEventListener('click', () => window.location.reload());

  bindSearchEvents();
  bindSolverEvents();
  bindFormulaEvents();

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      focusSearch();
    }
  });
}

function renderSubjectOptions() {
  dom.subjectSelect.innerHTML = state.catalog.subjects
    .filter(subject => subject.enabled)
    .map(subject => `<option value="${subject.id}">${escapeHTML(subject.name)}</option>`)
    .join('');
  dom.subjectSelect.value = state.activeSubjectId;
}

function getActiveChapter() {
  return state.subject.chapters.find(chapter => chapter.id === state.activeChapterId) || state.subject.chapters[0];
}

function renderNavigation() {
  const groups = groupBy(state.subject.chapters, 'moduleId');
  const fragment = document.createDocumentFragment();

  Object.entries(groups).forEach(([moduleId, chapters]) => {
    const module = state.subject.modules.find(item => item.id === moduleId);
    const title = document.createElement('p');
    title.className = 'module-title';
    title.textContent = module?.title || 'Módulo';
    fragment.appendChild(title);

    chapters.forEach(chapter => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-button';
      button.classList.toggle('is-active', chapter.id === state.activeChapterId);
      button.innerHTML = `<span class="chapter-number">${chapter.number}</span><span>${escapeHTML(chapter.title)}</span>`;
      button.addEventListener('click', () => navigateToChapter(chapter.id));
      fragment.appendChild(button);
    });
  });

  dom.chapterNav.replaceChildren(fragment);
}

function navigateToChapter(chapterId, options = {}) {
  state.activeChapterId = chapterId;
  state.activeSubtopicId = options.subtopicId || 'all';
  state.activeFilter = options.filter || 'all';

  dom.filterButtons.forEach(item => {
    const selected = item.dataset.filter === state.activeFilter;
    item.classList.toggle('is-active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });

  renderNavigation();
  renderChapter();
  dom.sidebar.classList.remove('is-open');
  dom.menuButton.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (options.contentId) {
    window.setTimeout(() => {
      const item = findContentById(options.contentId);
      const selectedSolver = item?.solvers?.find(solver => solver.id === options.solverId);
      if (selectedSolver || item?.solver) openSolver(item, selectedSolver || item.solver);
      else document.querySelector(`[data-card-id="${CSS.escape(options.contentId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }
}

function renderChapter() {
  const chapter = getActiveChapter();
  const module = state.subject.modules.find(item => item.id === chapter.moduleId);
  dom.moduleLabel.textContent = `${state.subject.subject.name.toUpperCase()} · ${module?.title || ''}`;
  dom.pageTitle.textContent = `${chapter.number}. ${chapter.title}`;
  dom.pageSummary.textContent = chapter.summary;

  dom.subtopicSelect.innerHTML = `
    <option value="all">Todos los subtemas</option>
    ${chapter.subtopics.map(subtopic => `<option value="${subtopic.id}">${escapeHTML(subtopic.number)}. ${escapeHTML(subtopic.title)}</option>`).join('')}
  `;
  dom.subtopicSelect.value = state.activeSubtopicId;
  renderCards();
}

function renderCards() {
  const chapter = getActiveChapter();
  const content = chapter.content || [];
  const visible = content.filter(item => {
    const typeMatch = state.activeFilter === 'all' || item.type === state.activeFilter;
    const subtopicMatch = state.activeSubtopicId === 'all' || item.subtopicIds?.includes(state.activeSubtopicId);
    return typeMatch && subtopicMatch;
  });

  if (!visible.length) {
    dom.contentGrid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="search-x" aria-hidden="true"></i>
        <h2>No hay contenido con esta combinación</h2>
        <p>Prueba otro filtro o abre el generador de formularios para consultar las ecuaciones del subtema.</p>
      </div>`;
    window.lucide?.createIcons();
    return;
  }

  dom.contentGrid.innerHTML = visible.map(renderCardMarkup).join('');
  dom.contentGrid.querySelectorAll('[data-open-solver]').forEach(button => {
    button.addEventListener('click', () => {
      const item = findContentById(button.dataset.openSolver);
      const selectedSolver = item?.solvers?.find(solver => solver.id === button.dataset.solverId);
      if (item) openSolver(item, selectedSolver || item.solver);
    });
  });
  dom.contentGrid.querySelectorAll('[data-open-formulas]').forEach(button => {
    button.addEventListener('click', () => openFormulaBuilder({ chapterId: state.activeChapterId, subtopicId: state.activeSubtopicId }));
  });
  typesetMath(dom.contentGrid);
  window.lucide?.createIcons();
}

function renderCardMarkup(item) {
  const meta = {
    prior: { label: 'Consolidación previa', icon: 'sparkles' },
    theory: { label: 'Parte teórica', icon: 'book-open' },
    concept: { label: 'Consolidación teórica', icon: 'brain' },
    example: { label: 'Aplicación resuelta', icon: 'list-checks' },
    practice: { label: 'Consolidación práctica', icon: 'pencil-ruler' }
  }[item.type] || { label: 'Consulta', icon: 'book-open' };

  const solverButtons = item.solvers?.length
    ? `<div class="solver-list">${item.solvers.map((solver, index) => `<button class="practice-solver-button" type="button" data-open-solver="${item.id}" data-solver-id="${solver.id}"><span>${index + 1}</span>${escapeHTML(solver.title)}</button>`).join('')}</div>`
    : item.solver
      ? `<button class="primary-button" type="button" data-open-solver="${item.id}" data-solver-id="${item.solver.id || ''}"><i data-lucide="presentation"></i>Abrir pizarra</button>`
      : '';

  return `
    <article class="content-card" data-type="${item.type}" data-card-id="${item.id}">
      <div class="content-accent" aria-hidden="true"></div>
      <div class="content-card-body">
        <div class="card-header">
          <div>
            <span class="card-label"><i data-lucide="${meta.icon}" aria-hidden="true"></i>${meta.label}</span>
            <h2>${escapeHTML(item.title)}</h2>
          </div>
          <span class="card-source">Visor PDF · p. ${item.sourcePages?.join('–') || '—'}</span>
        </div>
        <div class="card-content">${item.blocks?.map(renderBlock).join('') || ''}</div>
        <div class="card-actions">
          ${solverButtons}
          <button class="secondary-button" type="button" data-open-formulas><i data-lucide="sigma"></i>Formulario del tema</button>
        </div>
      </div>
    </article>`;
}

function renderBlock(block) {
  switch (block.kind) {
    case 'paragraph': return `<p>${block.html}</p>`;
    case 'equation': return `<div class="equation">${block.latex}</div>`;
    case 'keyIdea': return `<div class="key-idea"><strong>Idea clave:</strong> ${block.html}</div>`;
    case 'list': return `<${block.ordered ? 'ol' : 'ul'}>${block.items.map(item => `<li>${item}</li>`).join('')}</${block.ordered ? 'ol' : 'ul'}>`;
    case 'question': return `<div class="question-block"><strong>Pregunta:</strong> ${block.prompt}</div>`;
    case 'rawHtml': return block.html;
    default: return '';
  }
}

/* ---------------------------- SMART SEARCH ---------------------------- */
function bindSearchEvents() {
  const debounced = debounce(() => runSearch(dom.globalSearch.value), 70);
  dom.globalSearch.addEventListener('input', () => {
    dom.clearSearch.hidden = !dom.globalSearch.value;
    debounced();
  });
  dom.globalSearch.addEventListener('focus', () => runSearch(dom.globalSearch.value));
  dom.clearSearch.addEventListener('click', () => {
    dom.globalSearch.value = '';
    dom.clearSearch.hidden = true;
    runSearch('');
    dom.globalSearch.focus();
  });
  dom.globalSearch.addEventListener('keydown', event => {
    if (dom.searchPanel.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSearchSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSearchSelection(-1);
    } else if (event.key === 'Enter' && state.searchActiveIndex >= 0) {
      event.preventDefault();
      openSearchResult(state.searchResults[state.searchActiveIndex]);
    } else if (event.key === 'Escape') {
      closeSearch();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#smartSearch')) closeSearch();
  });
}

function focusSearch() {
  dom.globalSearch.focus();
  runSearch(dom.globalSearch.value);
}

function buildSearchIndex(subject) {
  const index = [];
  subject.chapters.forEach(chapter => {
    const module = subject.modules.find(item => item.id === chapter.moduleId);
    index.push({
      id: `chapter-${chapter.id}`, kind: 'chapter', typeLabel: 'Capítulo', icon: 'book-marked',
      chapterId: chapter.id, title: `${chapter.number}. ${chapter.title}`,
      preview: chapter.summary, breadcrumb: `${module?.title || ''}`,
      keywords: [chapter.title, chapter.summary, ...chapter.subtopics.map(item => item.title)]
    });

    chapter.subtopics.forEach(subtopic => index.push({
      id: `subtopic-${subtopic.id}`, kind: 'subtopic', typeLabel: 'Subtema', icon: 'bookmark',
      chapterId: chapter.id, subtopicId: subtopic.id,
      title: `${subtopic.number}. ${subtopic.title}`,
      preview: chapter.summary, breadcrumb: chapter.title,
      keywords: [subtopic.title, chapter.title]
    }));

    chapter.formulaSheet?.equations?.forEach(equation => index.push({
      id: `formula-${equation.id}`, kind: 'formula', typeLabel: 'Fórmula', icon: 'sigma',
      chapterId: chapter.id, subtopicId: equation.subtopicIds?.[0],
      title: equation.label, preview: `\\(${equation.latex}\\)`, formula: equation.latex,
      breadcrumb: chapter.formulaSheet.title,
      keywords: [equation.label, equation.latex, chapter.title, ...(equation.subtopicIds || [])]
    }));

    chapter.content?.forEach(item => {
      const plain = item.blocks?.map(block => stripHTML(block.html || block.prompt || block.latex || '')).join(' ') || '';
      index.push({
        id: `content-${item.id}`, kind: item.type, typeLabel: contentTypeLabel(item.type),
        icon: item.type === 'practice' ? 'pencil-ruler' : item.type === 'example' ? 'list-checks' : 'book-open',
        chapterId: chapter.id, subtopicId: item.subtopicIds?.[0], contentId: item.id,
        title: item.title, preview: truncate(plain, 180), breadcrumb: chapter.title,
        keywords: [item.title, plain, chapter.title]
      });
      item.solvers?.forEach(solver => {
        const solverPlain = stripHTML([solver.problemHtml, ...(solver.steps || []).flatMap(step => step.lines || [])].join(' '));
        index.push({
          id: `solver-${item.id}-${solver.id}`, kind: 'practice', typeLabel: 'Ejercicio resuelto', icon: 'presentation',
          chapterId: chapter.id, subtopicId: item.subtopicIds?.[0], contentId: item.id, solverId: solver.id,
          title: solver.title, preview: truncate(solverPlain, 180), breadcrumb: `${chapter.title} · ${item.title}`,
          keywords: [solver.title, solverPlain, item.title, chapter.title]
        });
      });
    });
  });
  return index.map(item => ({ ...item, searchable: normalizeText([item.title, item.preview, item.breadcrumb, ...(item.keywords || [])].join(' ')) }));
}

function runSearch(rawQuery) {
  const query = normalizeText(rawQuery.trim());
  dom.searchPanel.hidden = false;
  dom.globalSearch.setAttribute('aria-expanded', 'true');
  state.searchActiveIndex = -1;

  if (!query) {
    const suggestions = state.searchIndex.filter(item => item.kind === 'formula').slice(0, 6);
    state.searchResults = suggestions;
    dom.searchStatus.textContent = 'Fórmulas de consulta rápida';
    renderSearchResults(suggestions, '');
    return;
  }

  const tokens = query.split(/\s+/).filter(token => token.length > 2);
  const results = state.searchIndex
    .map(item => ({ ...item, score: scoreSearchItem(item, query, tokens) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'es'))
    .slice(0, 10);

  state.searchResults = results;
  dom.searchStatus.textContent = results.length ? `${results.length} resultado${results.length === 1 ? '' : 's'} en Física` : 'Sin coincidencias';
  renderSearchResults(results, rawQuery.trim());
}

function scoreSearchItem(item, query, tokens) {
  const title = normalizeText(item.title);
  const preview = normalizeText(item.preview || '');
  const breadcrumb = normalizeText(item.breadcrumb || '');
  let score = 0;
  if (title === query) score += 180;
  if (title.startsWith(query)) score += 120;
  if (title.includes(query)) score += 90;
  if (item.searchable.includes(query)) score += 45;
  tokens.forEach(token => {
    if (title.includes(token)) score += 32;
    if (preview.includes(token)) score += 13;
    if (breadcrumb.includes(token)) score += 9;
    if (item.searchable.includes(token)) score += 5;
  });
  if (item.kind === 'formula') score += 8;
  return score;
}

function renderSearchResults(results, query) {
  if (!results.length) {
    dom.searchResults.innerHTML = `<div class="search-empty"><i data-lucide="search-x"></i><p>No encontré ese término. Prueba una palabra como <strong>fuerza</strong>, <strong>resorte</strong>, <strong>equilibrio</strong> o <strong>roce</strong>.</p></div>`;
    window.lucide?.createIcons();
    return;
  }

  dom.searchResults.innerHTML = results.map((item, index) => `
    <button class="search-result" type="button" role="option" aria-selected="false" data-search-index="${index}">
      <span class="search-result-icon"><i data-lucide="${item.icon}"></i></span>
      <span>
        <small>${escapeHTML(item.breadcrumb || '')}</small>
        <strong>${highlightText(item.title, query)}</strong>
        <p>${item.kind === 'formula' ? item.preview : highlightText(item.preview || '', query)}</p>
      </span>
      <span class="search-result-type">${escapeHTML(item.typeLabel)}</span>
    </button>`).join('');

  dom.searchResults.querySelectorAll('[data-search-index]').forEach(button => {
    button.addEventListener('mousemove', () => setSearchSelection(Number(button.dataset.searchIndex)));
    button.addEventListener('click', () => openSearchResult(results[Number(button.dataset.searchIndex)]));
  });
  typesetMath(dom.searchResults);
  window.lucide?.createIcons();
}

function moveSearchSelection(delta) {
  if (!state.searchResults.length) return;
  const next = (state.searchActiveIndex + delta + state.searchResults.length) % state.searchResults.length;
  setSearchSelection(next);
}

function setSearchSelection(index) {
  state.searchActiveIndex = index;
  dom.searchResults.querySelectorAll('.search-result').forEach((item, itemIndex) => {
    const active = itemIndex === index;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    if (active) item.scrollIntoView({ block: 'nearest' });
  });
}

function openSearchResult(result) {
  closeSearch();
  dom.globalSearch.value = result.title;
  dom.clearSearch.hidden = false;
  if (result.kind === 'formula') {
    navigateToChapter(result.chapterId, { subtopicId: result.subtopicId || 'all' });
    openFormulaBuilder({ chapterId: result.chapterId, subtopicId: result.subtopicId });
  } else {
    navigateToChapter(result.chapterId, {
      subtopicId: result.subtopicId || 'all',
      filter: ['prior', 'theory', 'concept', 'example', 'practice'].includes(result.kind) ? result.kind : 'all',
      contentId: result.contentId,
      solverId: result.solverId
    });
  }
}

function closeSearch() {
  dom.searchPanel.hidden = true;
  dom.globalSearch.setAttribute('aria-expanded', 'false');
  state.searchActiveIndex = -1;
}

/* ------------------------------ SOLVER ------------------------------ */
function bindSolverEvents() {
  dom.closeSolverButton.addEventListener('click', () => dom.solverDialog.close());
  dom.previousStepButton.addEventListener('click', () => showStep(state.currentStep - 1));
  dom.nextStepButton.addEventListener('click', () => showStep(state.currentStep + 1));
  dom.replayStepButton.addEventListener('click', () => showStep(state.currentStep, true));
  dom.stepSelect.addEventListener('change', event => showStep(Number(event.target.value)));
  dom.toggleVisualButton.addEventListener('click', () => {
    const show = dom.simulationMount.hidden;
    dom.simulationMount.hidden = !show;
    dom.toggleVisualButton.setAttribute('aria-pressed', String(show));
  });
  dom.solverDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  document.addEventListener('keydown', event => {
    if (!dom.solverDialog.open) return;
    if (event.key === 'ArrowRight') showStep(state.currentStep + 1);
    if (event.key === 'ArrowLeft') showStep(state.currentStep - 1);
  });
}

function findContentById(id) {
  for (const chapter of state.subject.chapters) {
    const item = chapter.content?.find(content => content.id === id);
    if (item) return item;
  }
  return null;
}

function openSolver(item, selectedSolver = item?.solver) {
  if (!selectedSolver) return;
  state.currentSolverItem = { ...item, solver: selectedSolver };
  state.currentStep = 0;
  dom.solverTitle.textContent = selectedSolver.title || item.title;
  dom.problemStatement.innerHTML = selectedSolver.problemHtml;
  dom.stepSelect.innerHTML = selectedSolver.steps.map((step, index) => `<option value="${index}">Paso ${index + 1}: ${escapeHTML(step.title)}</option>`).join('');
  dom.solverDialog.showModal();
  document.body.classList.add('dialog-open');
  renderSimulation(selectedSolver.visual);
  showStep(0, true);
  typesetMath(dom.solverDialog);
  window.lucide?.createIcons();
}

function showStep(index, replay = false) {
  const steps = state.currentSolverItem?.solver?.steps || [];
  if (!steps.length) return;
  state.currentStep = Math.max(0, Math.min(index, steps.length - 1));
  const step = steps[state.currentStep];
  dom.stepCounter.textContent = `Paso ${state.currentStep + 1} de ${steps.length}`;
  dom.stepSelect.value = String(state.currentStep);
  dom.previousStepButton.disabled = state.currentStep === 0;
  dom.nextStepButton.disabled = state.currentStep === steps.length - 1;
  dom.nextStepButton.innerHTML = state.currentStep === steps.length - 1
    ? `<i data-lucide="circle-check-big"></i> Resultado final`
    : `Avanzar <i data-lucide="arrow-right"></i>`;
  dom.stepContent.innerHTML = `<h4>${escapeHTML(step.title)}</h4>${step.lines.map(line => `<div class="reveal-line">${line}</div>`).join('')}`;
  revealSequentially(dom.stepContent, replay);
  typesetMath(dom.stepContent);
  window.lucide?.createIcons();
}

function revealSequentially(container, replay) {
  const items = [...container.querySelectorAll('.reveal-line')];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(item => item.classList.add('is-visible'));
    return;
  }
  items.forEach(item => item.classList.remove('is-visible'));
  items.forEach((item, index) => setTimeout(() => item.classList.add('is-visible'), (replay ? 180 : 125) * index));
}

async function renderSimulation(visual) {
  dom.simulationMount.hidden = false;
  dom.toggleVisualButton.setAttribute('aria-pressed', 'true');
  if (!visual) {
    dom.simulationMount.innerHTML = `<div class="simulation-placeholder"><p>Representación visual no disponible.</p></div>`;
    return;
  }
  if (visual.kind === 'jsxgraph') {
    await renderMasGraph(visual);
    return;
  }
  const diagramId = visual.kind === 'pendulum' ? 'pendulum' : visual.kind === 'spring' ? 'spring' : visual.model;
  dom.simulationMount.innerHTML = `<div class="static-visual">${diagramSVG(diagramId)}</div>`;
}

async function renderMasGraph(visual) {
  dom.simulationMount.innerHTML = `<div id="jxgbox" class="jxgbox"></div>`;
  try {
    await loadStyle('https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css');
    await loadScript('https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js');
    const board = JXG.JSXGraph.initBoard('jxgbox', {
      boundingbox: [-1.05, 0.28, 1.05, -0.28], axis: true, grid: true,
      showCopyright: false, showNavigation: false, pan: { enabled: false }, zoom: { enabled: false }
    });
    const amplitude = visual.amplitude ?? 0.2;
    const phase = visual.phase ?? 0;
    board.create('functiongraph', [x => amplitude * Math.cos((visual.omega || Math.PI) * x + phase), -1, 1], {
      strokeWidth: 4, strokeColor: '#1C3D6E', highlight: false
    });
    const t = board.create('glider', [0, amplitude * Math.cos(phase), board.defaultAxes.x], { name: 't', size: 5, color: '#E46D5A' });
    const point = board.create('point', [() => t.X(), () => amplitude * Math.cos((visual.omega || Math.PI) * t.X() + phase)], { name: 'x(t)', size: 6, color: '#00A6B2', fixed: true });
    board.create('segment', [() => [t.X(), 0], () => [point.X(), point.Y()]], { dash: 2, strokeColor: '#627184', fixed: true });
  } catch (error) {
    console.error(error);
    dom.simulationMount.innerHTML = `<div class="simulation-placeholder"><p>No se pudo cargar la gráfica interactiva. Revisa la conexión.</p></div>`;
  }
}

/* ------------------------- FORMULA GENERATOR ------------------------- */
function bindFormulaEvents() {
  dom.closeFormulaButton.addEventListener('click', () => dom.formulaDialog.close());
  dom.formulaDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dom.selectAllTopics.addEventListener('click', () => {
    state.subject.chapters.flatMap(chapter => chapter.subtopics).forEach(subtopic => state.selectedFormulaTopics.add(subtopic.id));
    syncFormulaCheckboxes();
    renderFormulaPreview();
  });
  dom.clearAllTopics.addEventListener('click', () => {
    state.selectedFormulaTopics.clear();
    syncFormulaCheckboxes();
    renderFormulaPreview();
  });
  [dom.includeDiagrams, dom.includeVariables, dom.includeSigns, dom.compactSheet].forEach(input => input.addEventListener('change', renderFormulaPreview));
  dom.printFormulaButton.addEventListener('click', printFormulaSheet);
  dom.downloadFormulaButton.addEventListener('click', downloadFormulaPdf);
}

function renderFormulaTopicTree() {
  dom.formulaTopicTree.innerHTML = state.subject.chapters.map(chapter => {
    const equationSubtopics = new Set(chapter.formulaSheet?.equations?.flatMap(eq => eq.subtopicIds || []) || []);
    const subtopics = chapter.subtopics.filter(subtopic => equationSubtopics.has(subtopic.id));
    if (!subtopics.length) return '';
    return `
      <details ${chapter.id === state.activeChapterId ? 'open' : ''}>
        <summary><span class="chapter-number">${chapter.number}</span><span>${escapeHTML(chapter.title)}</span></summary>
        <div class="formula-topic-list">
          ${subtopics.map(subtopic => `<label><input type="checkbox" data-formula-topic="${subtopic.id}"><span><strong>${escapeHTML(subtopic.number)}</strong> ${escapeHTML(subtopic.title)}</span></label>`).join('')}
        </div>
      </details>`;
  }).join('');

  dom.formulaTopicTree.querySelectorAll('[data-formula-topic]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) state.selectedFormulaTopics.add(input.dataset.formulaTopic);
      else state.selectedFormulaTopics.delete(input.dataset.formulaTopic);
      renderFormulaPreview();
    });
  });
}

function openFormulaBuilder({ chapterId, subtopicId } = {}) {
  if (chapterId) {
    const chapter = state.subject.chapters.find(item => item.id === chapterId);
    if (subtopicId && subtopicId !== 'all') state.selectedFormulaTopics.add(subtopicId);
    else chapter?.formulaSheet?.subtopics?.forEach(id => state.selectedFormulaTopics.add(id));
  }
  syncFormulaCheckboxes();
  renderFormulaPreview();
  dom.formulaDialog.showModal();
  document.body.classList.add('dialog-open');
  window.lucide?.createIcons();
}

function syncFormulaCheckboxes() {
  dom.formulaTopicTree.querySelectorAll('[data-formula-topic]').forEach(input => {
    input.checked = state.selectedFormulaTopics.has(input.dataset.formulaTopic);
  });
}

function renderFormulaPreview() {
  const selected = [...state.selectedFormulaTopics];
  dom.formulaSelectionCount.textContent = `${selected.length} tema${selected.length === 1 ? '' : 's'}`;
  if (!selected.length) {
    dom.formulaPreview.innerHTML = `
      <div class="formula-empty">
        <div><img src="assets/academia-fractal-symbol.png" alt=""><h3>Selecciona uno o varios temas</h3><p>La vista previa mostrará exclusivamente ecuaciones, variables, signos y gráficos esenciales.</p></div>
      </div>`;
    return;
  }

  const sections = state.subject.chapters.map(chapter => buildFormulaSection(chapter, selected)).filter(Boolean);
  const compact = dom.compactSheet.checked;
  dom.formulaPreview.innerHTML = `
    <article class="formula-sheet-page ${compact ? 'compact' : ''}">
      <header class="formula-sheet-header">
        <img src="assets/academia-fractal-symbol.png" alt="">
        <div><p>Academia Fractal</p><h2>Formulario de ${escapeHTML(state.subject.subject.name)}</h2></div>
        <small>${selected.length} tema${selected.length === 1 ? '' : 's'} seleccionado${selected.length === 1 ? '' : 's'}</small>
      </header>
      ${sections.join('')}
    </article>`;
  typesetMath(dom.formulaPreview);
}

function buildFormulaSection(chapter, selectedIds) {
  const equations = chapter.formulaSheet?.equations?.filter(eq => eq.subtopicIds?.some(id => selectedIds.includes(id))) || [];
  if (!equations.length) return '';
  const selectedNames = chapter.subtopics.filter(item => selectedIds.includes(item.id)).map(item => item.title);
  return `
    <section class="formula-section">
      <h3 class="formula-section-title"><span>${chapter.number}</span>${escapeHTML(chapter.formulaSheet.title)}</h3>
      <p><strong>Temas:</strong> ${selectedNames.map(escapeHTML).join(' · ')}</p>
      <div class="formula-section-grid">
        <div>
          <div class="formula-equations">
            ${equations.map(eq => `<div class="formula-item"><strong>${escapeHTML(eq.label)}</strong><div>\\[${eq.latex}\\]</div></div>`).join('')}
          </div>
          ${dom.includeVariables.checked && chapter.formulaSheet.variables?.length ? renderVariableTable(chapter.formulaSheet.variables) : ''}
          ${dom.includeSigns.checked && chapter.formulaSheet.signConventions?.length ? `<h4>Convención de signos</h4><ul class="sign-list">${chapter.formulaSheet.signConventions.map(note => `<li>${escapeHTML(note)}</li>`).join('')}</ul>` : ''}
          ${chapter.formulaSheet.quickNotes?.length ? `<ul class="quick-notes">${chapter.formulaSheet.quickNotes.map(note => `<li>${escapeHTML(note)}</li>`).join('')}</ul>` : ''}
        </div>
        ${dom.includeDiagrams.checked ? `<div class="formula-diagram">${diagramSVG(chapter.formulaSheet.diagramId)}</div>` : ''}
      </div>
    </section>`;
}

function renderVariableTable(variables) {
  return `<table class="variable-table"><thead><tr><th>Símbolo</th><th>Significado</th><th>Unidad</th></tr></thead><tbody>${variables.map(variable => `<tr><td>\\(${variable.symbol}\\)</td><td>${escapeHTML(variable.meaning)}</td><td>${escapeHTML(variable.unit)}</td></tr>`).join('')}</tbody></table>`;
}

function printFormulaSheet() {
  if (!state.selectedFormulaTopics.size) {
    showToast('Selecciona al menos un tema.');
    return;
  }
  dom.formulaPrintSurface.innerHTML = dom.formulaPreview.innerHTML;
  document.body.classList.add('printing-formula');
  typesetMath(dom.formulaPrintSurface).then(() => {
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-formula');
    }, 180);
  });
}

async function downloadFormulaPdf() {
  if (!state.selectedFormulaTopics.size) {
    showToast('Selecciona al menos un tema.');
    return;
  }
  const original = dom.downloadFormulaButton.innerHTML;
  dom.downloadFormulaButton.disabled = true;
  dom.downloadFormulaButton.innerHTML = `<i data-lucide="loader-circle"></i> Generando…`;
  window.lucide?.createIcons();
  try {
    const response = await fetch('/api/formula-sheet/pdf', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: state.subject.subject.name,
        selectedTopicIds: [...state.selectedFormulaTopics],
        html: dom.formulaPreview.innerHTML,
        options: {
          diagrams: dom.includeDiagrams.checked,
          variables: dom.includeVariables.checked,
          signs: dom.includeSigns.checked,
          compact: dom.compactSheet.checked
        }
      })
    });
    if (!response.ok) throw new Error('Backend PDF no disponible');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `formulario-${state.subject.subject.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Formulario PDF generado.');
  } catch (error) {
    console.warn(error);
    showToast('El servidor PDF no está activo. Se abrirá la opción de imprimir/guardar como PDF.');
    printFormulaSheet();
  } finally {
    dom.downloadFormulaButton.disabled = false;
    dom.downloadFormulaButton.innerHTML = original;
    window.lucide?.createIcons();
  }
}

/* ------------------------------ DIAGRAMS ------------------------------ */
function diagramSVG(id) {
  const common = `viewBox="0 0 360 220" role="img" aria-label="Diagrama de ${escapeHTML(id || 'física')}"`;
  const axis = `<line x1="30" y1="170" x2="330" y2="170" stroke="#627184" stroke-width="2"/>`;
  const diagrams = {
    mas: `<svg ${common}>${axis}<path d="M35 110 C70 45 105 45 140 110 S210 175 245 110 S310 45 330 85" fill="none" stroke="#1C3D6E" stroke-width="5"/><line x1="140" y1="110" x2="140" y2="170" stroke="#E46D5A" stroke-dasharray="6 5"/><circle cx="140" cy="110" r="8" fill="#00A6B2"/><text x="146" y="104" fill="#172033">x(t)</text></svg>`,
    wave: `<svg ${common}>${axis}<path d="M35 120 C65 55 95 55 125 120 S185 185 215 120 S275 55 325 120" fill="none" stroke="#00A6B2" stroke-width="5"/><line x1="65" y1="120" x2="65" y2="55" stroke="#E46D5A"/><text x="72" y="86">A</text><line x1="65" y1="38" x2="245" y2="38" stroke="#7850A0" marker-end="url(#arr)"/><text x="143" y="30">λ</text><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#7850A0"/></marker></defs></svg>`,
    light: `<svg ${common}><path d="M30 110 H330" stroke="#E46D5A" stroke-width="5" marker-end="url(#arr2)"/><path d="M60 110 C85 55 110 55 135 110 S185 165 210 110 S260 55 285 110" fill="none" stroke="#00A6B2" stroke-width="4"/><path d="M60 110 C85 85 110 85 135 110 S185 135 210 110 S260 85 285 110" fill="none" stroke="#7850A0" stroke-width="3"/><defs><marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#E46D5A"/></marker></defs><text x="245" y="95">c = λf</text></svg>`,
    mirror: `<svg ${common}>${axis}<path d="M250 45 Q205 110 250 180" fill="none" stroke="#1C3D6E" stroke-width="8"/><line x1="90" y1="75" x2="230" y2="112" stroke="#E46D5A" stroke-width="4"/><line x1="230" y1="112" x2="110" y2="155" stroke="#00A6B2" stroke-width="4"/><line x1="230" y1="45" x2="230" y2="180" stroke="#627184" stroke-dasharray="5 5"/><text x="120" y="66">rayo incidente</text><text x="105" y="148">rayo reflejado</text></svg>`,
    prism: `<svg ${common}><polygon points="180,35 75,180 285,180" fill="#e5f7f8" stroke="#1C3D6E" stroke-width="5"/><line x1="20" y1="125" x2="120" y2="118" stroke="#E46D5A" stroke-width="4"/><line x1="120" y1="118" x2="240" y2="140" stroke="#F3C75B" stroke-width="4"/><line x1="240" y1="140" x2="338" y2="115" stroke="#7850A0" stroke-width="4"/><text x="154" y="65">α</text><text x="150" y="112">r</text><text x="221" y="130">r′</text></svg>`,
    lens: `<svg ${common}>${axis}<path d="M180 30 Q145 110 180 190 Q215 110 180 30" fill="#e5f7f8" stroke="#00A6B2" stroke-width="5"/><line x1="45" y1="75" x2="180" y2="75" stroke="#E46D5A" stroke-width="4"/><line x1="180" y1="75" x2="315" y2="170" stroke="#E46D5A" stroke-width="4"/><line x1="45" y1="75" x2="180" y2="125" stroke="#7850A0" stroke-width="4"/><line x1="180" y1="125" x2="315" y2="125" stroke="#7850A0" stroke-width="4"/><circle cx="250" cy="170" r="5" fill="#1C3D6E"/><text x="244" y="193">F</text></svg>`,
    forces: `<svg ${common}>${axis}<rect x="140" y="100" width="80" height="70" rx="8" fill="#eaf0f8" stroke="#1C3D6E" stroke-width="4"/><line x1="180" y1="100" x2="180" y2="35" stroke="#00A6B2" stroke-width="5"/><line x1="180" y1="170" x2="180" y2="215" stroke="#E46D5A" stroke-width="5"/><line x1="140" y1="135" x2="70" y2="135" stroke="#7850A0" stroke-width="5"/><line x1="220" y1="135" x2="300" y2="90" stroke="#F3C75B" stroke-width="5"/><text x="188" y="52">N</text><text x="188" y="205">mg</text><text x="78" y="126">f</text><text x="270" y="88">F</text></svg>`,
    fluid: `<svg ${common}><rect x="55" y="50" width="250" height="145" rx="8" fill="#e5f7f8" stroke="#1C3D6E" stroke-width="4"/><path d="M58 95 Q95 80 130 95 T205 95 T302 95 V192 H58 Z" fill="#7dd8de" opacity=".75"/><rect x="145" y="105" width="70" height="55" rx="8" fill="#fff0ed" stroke="#E46D5A" stroke-width="4"/><line x1="180" y1="105" x2="180" y2="55" stroke="#00A6B2" stroke-width="5"/><line x1="180" y1="160" x2="180" y2="210" stroke="#E46D5A" stroke-width="5"/><text x="188" y="70">E</text><text x="188" y="205">mg</text></svg>`,
    torque: `<svg ${common}>${axis}<rect x="55" y="105" width="250" height="18" rx="8" fill="#1C3D6E"/><circle cx="180" cy="145" r="18" fill="#F3C75B" stroke="#725400" stroke-width="3"/><line x1="275" y1="105" x2="310" y2="48" stroke="#E46D5A" stroke-width="6"/><path d="M145 75 A55 55 0 0 1 210 70" fill="none" stroke="#7850A0" stroke-width="4"/><text x="290" y="47">F</text><text x="145" y="62">τ</text></svg>`,
    dynamics: `<svg ${common}>${axis}<rect x="85" y="105" width="100" height="65" rx="8" fill="#eaf0f8" stroke="#1C3D6E" stroke-width="4"/><line x1="185" y1="137" x2="305" y2="137" stroke="#00A6B2" stroke-width="6"/><text x="247" y="125">ΣF</text><line x1="85" y1="150" x2="35" y2="150" stroke="#E46D5A" stroke-width="5"/><text x="40" y="139">f</text></svg>`,
    circular: `<svg ${common}><circle cx="180" cy="112" r="78" fill="none" stroke="#1C3D6E" stroke-width="4"/><circle cx="245" cy="70" r="13" fill="#E46D5A"/><line x1="245" y1="70" x2="180" y2="112" stroke="#00A6B2" stroke-width="5"/><line x1="245" y1="70" x2="290" y2="135" stroke="#7850A0" stroke-width="5"/><text x="205" y="84">r</text><text x="282" y="145">v</text><text x="148" y="122">centro</text></svg>`,
    spring: `<svg ${common}>${axis}<line x1="35" y1="80" x2="35" y2="175" stroke="#1C3D6E" stroke-width="8"/><path d="M35 120 L55 120 L65 95 L85 145 L105 95 L125 145 L145 95 L165 145 L185 120 L205 120" fill="none" stroke="#00A6B2" stroke-width="5"/><rect x="205" y="87" width="85" height="83" rx="10" fill="#fff0ed" stroke="#E46D5A" stroke-width="4"/><text x="238" y="136">m</text></svg>`,
    pendulum: `<svg ${common}><line x1="80" y1="35" x2="280" y2="35" stroke="#1C3D6E" stroke-width="8"/><line x1="180" y1="35" x2="245" y2="160" stroke="#7850A0" stroke-width="5"/><circle cx="245" cy="160" r="23" fill="#E46D5A"/><line x1="180" y1="35" x2="180" y2="180" stroke="#627184" stroke-dasharray="6 5"/><path d="M180 85 A50 50 0 0 1 205 78" fill="none" stroke="#00A6B2" stroke-width="4"/><text x="202" y="73">θ</text><text x="215" y="95">l</text></svg>`
  };
  return diagrams[id] || diagrams.mas;
}

/* ------------------------------ UTILS ------------------------------ */
function contentTypeLabel(type) {
  return ({ prior: 'Consolidación previa', theory: 'Parte teórica', concept: 'Consolidación teórica', example: 'Aplicación', practice: 'Consolidación práctica' })[type] || 'Contenido';
}
function normalizeText(value = '') { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9α-ω\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function stripHTML(value = '') { const node = document.createElement('div'); node.innerHTML = value; return node.textContent || node.innerText || ''; }
function truncate(value, length) { return value.length > length ? `${value.slice(0, length - 1)}…` : value; }
function highlightText(value, query) {
  const safe = escapeHTML(value || '');
  if (!query) return safe;
  const terms = query.trim().split(/\s+/).filter(term => term.length > 1).map(escapeRegExp);
  if (!terms.length) return safe;
  return safe.replace(new RegExp(`(${terms.join('|')})`, 'gi'), '<mark>$1</mark>');
}
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function groupBy(items, key) { return items.reduce((groups, item) => { (groups[item[key]] ||= []).push(item); return groups; }, {}); }
function debounce(callback, delay) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), delay); }; }
function showToast(message) { dom.toast.textContent = message; dom.toast.classList.add('is-visible'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => dom.toast.classList.remove('is-visible'), 3000); }
function typesetMath(element) {
  if (!window.MathJax?.typesetPromise) return Promise.resolve();
  window.MathJax.typesetClear?.([element]);
  return window.MathJax.typesetPromise([element]).catch(console.error);
}
function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
}
function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.onload = resolve; link.onerror = reject; document.head.appendChild(link); });
}
