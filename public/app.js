function createDefaultBoard() {
  return {
    columns: [
      { id: crypto.randomUUID(), name: 'Ideas', tasks: [] },
      { id: crypto.randomUUID(), name: 'Por Hacer', tasks: [] },
      { id: crypto.randomUUID(), name: 'En Progreso', tasks: [] },
      { id: crypto.randomUUID(), name: 'Hecho', tasks: [] },
      { id: crypto.randomUUID(), name: 'Guardado', tasks: [] },
    ],
  };
}

let state = createDefaultBoard();
let draggedTask = { taskId: null, fromColumnId: null };
let currentUser = null;

const authPanelEl = document.getElementById('auth-panel');
const appPanelEl = document.getElementById('app-panel');
const welcomeEl = document.getElementById('welcome');
const feedbackEl = document.getElementById('feedback');
const loginFormEl = document.getElementById('login-form');
const registerFormEl = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');
const resetAppBtn = document.getElementById('reset-app-btn');

const boardEl = document.getElementById('board');
const searchInput = document.getElementById('search-input');
const addColumnBtn = document.getElementById('add-column-btn');
const columnDialog = document.getElementById('column-dialog');
const columnNameInput = document.getElementById('column-name');

const statTotal = document.getElementById('stat-total');
const statProgress = document.getElementById('stat-progress');
const statDone = document.getElementById('stat-done');

const columnTemplate = document.getElementById('column-template');
const taskTemplate = document.getElementById('task-template');

start();

async function start() {
  try {
    const me = await apiFetch('/api/auth/me');
    currentUser = me.user;
    await loadBoard();
    showApp();
  } catch {
    showAuth();
  }
}

async function loadBoard() {
  const response = await apiFetch('/api/board');
  state = sanitizeBoard(response.board);
  renderBoard();
}

function sanitizeBoard(board) {
  if (!board || !Array.isArray(board.columns)) return createDefaultBoard();
  return board;
}

async function persistBoard() {
  await apiFetch('/api/board', {
    method: 'PUT',
    body: JSON.stringify({ board: state }),
  });
}

function showAuth() {
  authPanelEl.classList.remove('hidden');
  appPanelEl.classList.add('hidden');
  welcomeEl.textContent = '';
  state = createDefaultBoard();
  boardEl.innerHTML = '';
  updateStats();
}

function showApp() {
  authPanelEl.classList.add('hidden');
  appPanelEl.classList.remove('hidden');
  welcomeEl.textContent = `Hola, ${currentUser.username}`;
  renderBoard();
}

function setFeedback(message, isError = false) {
  feedbackEl.textContent = message;
  feedbackEl.style.color = isError ? 'var(--danger)' : '#ffd8a0';
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      currentUser = null;
      showAuth();
    }
    throw new Error(payload.error || 'Error en la solicitud');
  }

  return payload;
}

loginFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(loginFormEl);
  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: String(fd.get('username') || '').trim(),
        password: String(fd.get('password') || ''),
      }),
    });

    currentUser = response.user;
    await loadBoard();
    showApp();
    loginFormEl.reset();
    setFeedback('Sesión iniciada.');
  } catch (error) {
    setFeedback(error.message, true);
  }
});

registerFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(registerFormEl);
  try {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: String(fd.get('username') || '').trim(),
        password: String(fd.get('password') || ''),
      }),
    });

    currentUser = response.user;
    await loadBoard();
    showApp();
    registerFormEl.reset();
    setFeedback('Cuenta creada y sesión iniciada.');
  } catch (error) {
    setFeedback(error.message, true);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    showAuth();
    setFeedback('Sesión cerrada.');
  } catch (error) {
    setFeedback(error.message, true);
  }
});

resetAppBtn.addEventListener('click', async () => {
  const confirmReset = confirm('Esto reiniciará todo tu tablero actual. ¿Deseas continuar?');
  if (!confirmReset) return;

  try {
    state = createDefaultBoard();
    searchInput.value = '';
    await commitBoardChanges();
    setFeedback('Tablero reiniciado.');
  } catch (error) {
    setFeedback(error.message, true);
  }
});

function getSearchQuery() {
  return searchInput.value.trim().toLowerCase();
}

function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function priorityLabel(priority) {
  if (priority === 'high') return 'Alta';
  if (priority === 'low') return 'Baja';
  return 'Media';
}

function normalizeColumnName(value) {
  return String(value || '').trim().toLowerCase();
}

function isArchivedTask(task) {
  return typeof task.archivedAt === 'string' && task.archivedAt.length > 0;
}

function updateStats() {
  const columnsByName = Object.fromEntries(state.columns.map((col) => [col.name.toLowerCase(), col]));
  const total = state.columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const progress = columnsByName['en progreso']?.tasks.length ?? 0;
  const done = (columnsByName['hecho']?.tasks.length ?? 0) + (columnsByName['guardado']?.tasks.length ?? 0);

  statTotal.textContent = String(total);
  statProgress.textContent = String(progress);
  statDone.textContent = String(done);
}

async function deleteTask(columnId, taskId) {
  state.columns = state.columns.map((column) => {
    if (column.id !== columnId) return column;
    return { ...column, tasks: column.tasks.filter((task) => task.id !== taskId) };
  });
  await commitBoardChanges();
}

async function editTask(columnId, taskId, values) {
  state.columns = state.columns.map((column) => {
    if (column.id !== columnId) return column;
    return {
      ...column,
      tasks: column.tasks.map((task) => (task.id === taskId ? { ...task, ...values } : task)),
    };
  });
  await commitBoardChanges();
}

async function moveTask(fromColumnId, taskId, toColumnId) {
  if (!fromColumnId || !taskId || !toColumnId || fromColumnId === toColumnId) return;

  let movingTask = null;
  state.columns = state.columns.map((column) => {
    if (column.id !== fromColumnId) return column;
    const remaining = column.tasks.filter((task) => {
      if (task.id === taskId) {
        movingTask = task;
        return false;
      }
      return true;
    });
    return { ...column, tasks: remaining };
  });

  if (!movingTask) return;

  state.columns = state.columns.map((column) => {
    if (column.id !== toColumnId) return column;
    const isGuardado = normalizeColumnName(column.name) === 'guardado';
    const nextTask = isGuardado
      ? { ...movingTask, archivedAt: new Date().toISOString() }
      : { ...movingTask, archivedAt: '' };
    return { ...column, tasks: [...column.tasks, nextTask] };
  });

  await commitBoardChanges();
}

function createTaskElement(task, columnId) {
  const clone = taskTemplate.content.cloneNode(true);
  const taskEl = clone.querySelector('.task');
  const titleEl = clone.querySelector('.task-title');
  const descriptionEl = clone.querySelector('.task-description');
  const dueEl = clone.querySelector('.due');
  const priorityEl = clone.querySelector('.priority');
  const editBtn = clone.querySelector('.edit-task');
  const deleteBtn = clone.querySelector('.delete-task');

  taskEl.dataset.taskId = task.id;
  taskEl.dataset.columnId = columnId;
  titleEl.textContent = task.title;
  descriptionEl.textContent = task.description || 'Sin descripción';
  priorityEl.classList.add(task.priority);
  priorityEl.textContent = priorityLabel(task.priority);
  dueEl.textContent = formatDate(task.dueDate);
  dueEl.dateTime = task.dueDate || '';

  taskEl.addEventListener('dragstart', () => {
    draggedTask = { taskId: task.id, fromColumnId: columnId };
    taskEl.classList.add('dragging');
  });

  taskEl.addEventListener('dragend', () => {
    taskEl.classList.remove('dragging');
  });

  deleteBtn.addEventListener('click', () => {
    deleteTask(columnId, task.id).catch((error) => setFeedback(error.message, true));
  });

  editBtn.addEventListener('click', () => {
    const title = prompt('Editar título:', task.title);
    if (title === null) return;

    const description = prompt('Editar descripción:', task.description ?? '');
    if (description === null) return;

    const priority = prompt('Prioridad (low, medium, high):', task.priority);
    if (priority === null) return;

    const normalizedPriority = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';
    editTask(columnId, task.id, { title: title.trim() || 'Sin título', description, priority: normalizedPriority }).catch(
      (error) => setFeedback(error.message, true)
    );
  });

  return taskEl;
}

function createColumnElement(column) {
  const clone = columnTemplate.content.cloneNode(true);
  const columnEl = clone.querySelector('.column');
  const titleEl = clone.querySelector('.column-title');
  const countEl = clone.querySelector('.column-count');
  const tasksEl = clone.querySelector('.tasks');
  const renameColumnBtn = clone.querySelector('.rename-column');
  const addTaskBtn = clone.querySelector('.add-task');
  const deleteColumnBtn = clone.querySelector('.delete-column');
  const formEl = clone.querySelector('.task-form');
  const cancelBtn = clone.querySelector('.cancel-task');
  const isGuardado = normalizeColumnName(column.name) === 'guardado';
  const archivedTasks = isGuardado ? column.tasks : column.tasks.filter((task) => isArchivedTask(task));
  const activeTasks = isGuardado ? [] : column.tasks.filter((task) => !isArchivedTask(task));

  const query = getSearchQuery();
  const visibleTasks = activeTasks.filter((task) => {
    if (!query) return true;
    const searchable = `${task.title} ${task.description} ${priorityLabel(task.priority)}`.toLowerCase();
    return searchable.includes(query);
  });

  columnEl.dataset.columnId = column.id;
  titleEl.textContent = column.name;
  countEl.textContent = isGuardado
    ? `${archivedTasks.length} guardada${archivedTasks.length === 1 ? '' : 's'}`
    : `${visibleTasks.length} tarea${visibleTasks.length === 1 ? '' : 's'}`;
  visibleTasks.forEach((task) => tasksEl.append(createTaskElement(task, column.id)));

  if (isGuardado) {
    renameColumnBtn.style.display = 'none';
    deleteColumnBtn.style.display = 'none';
    addTaskBtn.textContent = 'Ver';
    addTaskBtn.title = 'Ver tareas guardadas';
    addTaskBtn.addEventListener('click', () => {
      if (!archivedTasks.length) {
        alert('No hay tareas guardadas.');
        return;
      }

      const summary = archivedTasks
        .map((task, idx) => `${idx + 1}. ${task.title}${task.dueDate ? ` (vence: ${formatDate(task.dueDate)})` : ''}`)
        .join('\n');
      alert(`Tareas guardadas:\n\n${summary}`);
    });
  } else {
    renameColumnBtn.addEventListener('click', () => {
      const newName = prompt('Nuevo nombre de columna:', column.name);
      if (!newName) return;

      state.columns = state.columns.map((col) => {
        if (col.id !== column.id) return col;
        return { ...col, name: newName.trim() };
      });

      commitBoardChanges().catch((error) => setFeedback(error.message, true));
    });
  }

  if (!isGuardado) {
    addTaskBtn.addEventListener('click', () => {
      formEl.classList.toggle('hidden');
      if (!formEl.classList.contains('hidden')) {
        formEl.querySelector('[name="title"]').focus();
      }
    });
  } else {
    formEl.classList.add('hidden');
  }

  cancelBtn.addEventListener('click', () => {
    formEl.reset();
    formEl.classList.add('hidden');
  });

  if (!isGuardado) {
    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(formEl);

      const newTask = {
        id: crypto.randomUUID(),
        title: String(fd.get('title')).trim(),
        description: String(fd.get('description')).trim(),
        priority: String(fd.get('priority')),
        dueDate: String(fd.get('dueDate')),
        archivedAt: '',
      };

      if (!newTask.title) return;

      state.columns = state.columns.map((col) => {
        if (col.id !== column.id) return col;
        return { ...col, tasks: [...col.tasks, newTask] };
      });

      commitBoardChanges().catch((error) => setFeedback(error.message, true));
    });

    deleteColumnBtn.addEventListener('click', () => {
      if (state.columns.length <= 1) {
        alert('Debe existir al menos una columna.');
        return;
      }

      const hasTasks = column.tasks.length > 0;
      if (hasTasks && !confirm('La columna tiene tareas. ¿Seguro que deseas eliminarla?')) return;

      state.columns = state.columns.filter((col) => col.id !== column.id);
      commitBoardChanges().catch((error) => setFeedback(error.message, true));
    });
  }

  columnEl.addEventListener('dragover', (event) => {
    event.preventDefault();
    columnEl.classList.add('drag-target');
  });

  columnEl.addEventListener('dragleave', () => {
    columnEl.classList.remove('drag-target');
  });

  columnEl.addEventListener('drop', () => {
    columnEl.classList.remove('drag-target');
    moveTask(draggedTask.fromColumnId, draggedTask.taskId, column.id).catch((error) => setFeedback(error.message, true));
  });

  return columnEl;
}

function renderBoard() {
  const flowOrder = ['ideas', 'por hacer', 'en progreso', 'hecho', 'guardado'];
  const sortedColumns = [...state.columns].sort((a, b) => {
    const aIdx = flowOrder.indexOf(normalizeColumnName(a.name));
    const bIdx = flowOrder.indexOf(normalizeColumnName(b.name));
    const aRank = aIdx === -1 ? flowOrder.length : aIdx;
    const bRank = bIdx === -1 ? flowOrder.length : bIdx;
    return aRank - bRank;
  });

  boardEl.innerHTML = '';
  sortedColumns.forEach((column) => boardEl.append(createColumnElement(column)));
  updateStats();
}

searchInput.addEventListener('input', renderBoard);

addColumnBtn.addEventListener('click', () => {
  columnNameInput.value = '';
  if (typeof columnDialog.showModal === 'function') {
    columnDialog.showModal();
    return;
  }

  const fallbackName = prompt('Nombre de la columna:');
  if (!fallbackName) return;

  state.columns.push({ id: crypto.randomUUID(), name: fallbackName.trim(), tasks: [] });
  commitBoardChanges().catch((error) => setFeedback(error.message, true));
});

columnDialog?.addEventListener('close', () => {
  if (columnDialog.returnValue === 'cancel') return;
  const name = columnNameInput.value.trim();
  if (!name) return;

  state.columns.push({ id: crypto.randomUUID(), name, tasks: [] });
  commitBoardChanges().catch((error) => setFeedback(error.message, true));
});

async function commitBoardChanges() {
  await persistBoard();
  renderBoard();
}
