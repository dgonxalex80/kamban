function createDefaultBoard() {
  return {
    hiddenColumnIds: [],
    columns: [
      { id: crypto.randomUUID(), name: 'Ideas', tasks: [], wipLimit: null },
      { id: crypto.randomUUID(), name: 'Por Hacer', tasks: [], wipLimit: null },
      { id: crypto.randomUUID(), name: 'En Progreso', tasks: [], wipLimit: null },
      { id: crypto.randomUUID(), name: 'Hecho', tasks: [], wipLimit: null },
      { id: crypto.randomUUID(), name: 'Guardado', tasks: [], wipLimit: null },
    ],
  };
}

let state = createDefaultBoard();
let draggedTask = { taskId: null, fromColumnId: null };
let draggedColumnId = null;
let currentUser = null;
let currentView = 'board';
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let columnPanelWasOpen = false;
let showOnlyWipAlerts = false;

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
const themeSelect = document.getElementById('theme-select');
const toggleColumnsBtn = document.getElementById('toggle-columns-btn');
const viewWipAlertsBtn = document.getElementById('view-wip-alerts-btn');
const viewCalendarBtn = document.getElementById('view-calendar-btn');
const viewCompletedBtn = document.getElementById('view-completed-btn');
const addColumnBtn = document.getElementById('add-column-btn');
const columnDialog = document.getElementById('column-dialog');
const columnNameInput = document.getElementById('column-name');
const columnVisibilityPanel = document.getElementById('column-visibility-panel');
const columnVisibilityList = document.getElementById('column-visibility-list');
const hiddenColumnsBar = document.getElementById('hidden-columns-bar');
const hiddenColumnsList = document.getElementById('hidden-columns-list');
const completedDialog = document.getElementById('completed-dialog');
const completedList = document.getElementById('completed-list');
const completedTitle = document.getElementById('completed-title');
const renameColumnDialog = document.getElementById('rename-column-dialog');
const renameColumnInput = document.getElementById('rename-column-input');
const wipDialog = document.getElementById('wip-dialog');
const wipLimitInput = document.getElementById('wip-limit-input');
const taskEditDialog = document.getElementById('task-edit-dialog');
const taskEditForm = document.getElementById('task-edit-form');
const taskEditTitleInput = document.getElementById('task-edit-title');
const taskEditFeedback = document.getElementById('task-edit-feedback');
const taskEditDescriptionInput = document.getElementById('task-edit-description');
const taskEditPriorityInput = document.getElementById('task-edit-priority');
const taskEditDueDateInput = document.getElementById('task-edit-due-date');
const taskEditActivitiesEl = document.getElementById('task-edit-activities');
const taskEditActivityInput = document.getElementById('task-edit-activity-input');
const taskEditAddActivityBtn = document.getElementById('task-edit-add-activity');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');

const statTotal = document.getElementById('stat-total');
const statProgress = document.getElementById('stat-progress');
const statDone = document.getElementById('stat-done');
const statsEl = document.querySelector('.stats');
const calendarPanel = document.getElementById('calendar-panel');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const calendarPrevBtn = document.getElementById('calendar-prev-btn');
const calendarNextBtn = document.getElementById('calendar-next-btn');
const backToBoardBtn = document.getElementById('back-to-board-btn');
const calendarGrid = document.getElementById('calendar-grid');
const remindersList = document.getElementById('reminders-list');

const columnTemplate = document.getElementById('column-template');
const taskTemplate = document.getElementById('task-template');
let taskEditorState = { taskId: null, activities: [], returnMode: null };
const themeIds = new Set(['default', 'dark-blue', 'light-blue', 'white']);

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
  const sanitizedColumns = board.columns.map((column) => ({
    ...column,
    tasks: Array.isArray(column.tasks)
      ? column.tasks.map((task) => ({
          ...task,
          completedAt: typeof task.completedAt === 'string' ? task.completedAt : '',
          activities: normalizeTaskActivities(task.activities),
        }))
      : [],
  }));
  const ids = new Set(sanitizedColumns.map((column) => column.id));
  const hiddenColumnIds = Array.isArray(board.hiddenColumnIds)
    ? board.hiddenColumnIds.filter((id) => typeof id === 'string' && ids.has(id))
    : [];

  return {
    ...board,
    hiddenColumnIds,
    columns: sanitizedColumns,
  };
}

function normalizeTaskActivities(activities) {
  if (!Array.isArray(activities)) return [];
  return activities
    .filter((activity) => activity && typeof activity === 'object')
    .map((activity) => {
      const items = normalizeActivityItems(activity.items);
      const done = items.length > 0 ? items.every((item) => item.done) : Boolean(activity.done);
      return {
        id: typeof activity.id === 'string' && activity.id ? activity.id : crypto.randomUUID(),
        title: String(activity.title || '').trim(),
        done,
        dueDate: normalizeDateString(activity.dueDate),
        reminderDays: normalizeReminderDays(activity.reminderDays),
        items,
      };
    })
    .filter((activity) => activity.title.length > 0);
}

function normalizeActivityItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      title: String(item.title || '').trim(),
      done: Boolean(item.done),
    }))
    .filter((item) => item.title.length > 0);
}

function normalizeDateString(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function normalizeReminderDays(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0 || num > 30) return 0;
  return num;
}

function normalizeWipLimit(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || num > 99) return null;
  return num;
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
  initializeTheme();
  renderBoard();
  setView(currentView);
}

function getThemeStorageKey() {
  const userName = currentUser?.username || 'anon';
  return `kamban.theme.${userName}`;
}

function applyTheme(themeId) {
  const safeTheme = themeIds.has(themeId) ? themeId : 'default';
  document.body.dataset.theme = safeTheme;
  if (themeSelect) themeSelect.value = safeTheme;
}

function initializeTheme() {
  const stored = localStorage.getItem(getThemeStorageKey()) || 'default';
  applyTheme(stored);
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

function openDialogSafely(dialogEl) {
  if (!dialogEl || typeof dialogEl.showModal !== 'function') {
    setFeedback('Tu navegador no soporta esta acción.', true);
    return false;
  }
  dialogEl.showModal();
  return true;
}

function askConfirm(title, message, okLabel = 'Confirmar') {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = okLabel;
    if (!openDialogSafely(confirmDialog)) {
      resolve(false);
      return;
    }

    confirmDialog.addEventListener(
      'close',
      () => {
        resolve(confirmDialog.returnValue === 'default');
      },
      { once: true }
    );
  });
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
  const confirmReset = await askConfirm(
    'Reiniciar tablero',
    'Esto reiniciará todo tu tablero actual. Esta acción no se puede deshacer.',
    'Reiniciar'
  );
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

function reminderLabel(days) {
  if (!days) return 'Sin recordatorio';
  if (days === 1) return '1 día antes';
  return `${days} días antes`;
}

function normalizeColumnName(value) {
  return String(value || '').trim().toLowerCase();
}

function isArchivedTask(task) {
  return typeof task.archivedAt === 'string' && task.archivedAt.length > 0;
}

function isDoneColumn(column) {
  return normalizeColumnName(column?.name) === 'hecho';
}

function isStoredColumn(column) {
  return normalizeColumnName(column?.name) === 'guardado';
}

function isColumnHidden(columnId) {
  return Array.isArray(state.hiddenColumnIds) && state.hiddenColumnIds.includes(columnId);
}

function getColumnById(columnId) {
  return state.columns.find((column) => column.id === columnId) || null;
}

function isWipExceeded(column) {
  const limit = normalizeWipLimit(column?.wipLimit);
  if (!limit) return false;
  const activeCount = (column?.tasks || []).filter((task) => !isArchivedTask(task)).length;
  return activeCount > limit;
}

function getWipStatus(column) {
  const limit = normalizeWipLimit(column?.wipLimit);
  if (!limit) return { limited: false, atLimit: false, exceeded: false, activeCount: 0, limit: null, overload: 0 };
  const activeCount = (column?.tasks || []).filter((task) => !isArchivedTask(task)).length;
  const overload = activeCount - limit;
  return {
    limited: true,
    atLimit: overload === 0,
    exceeded: overload > 0,
    activeCount,
    limit,
    overload: overload > 0 ? overload : 0,
  };
}

function canAddTaskToColumn(column) {
  const limit = normalizeWipLimit(column?.wipLimit);
  if (!limit) return true;
  const activeCount = (column?.tasks || []).filter((task) => !isArchivedTask(task)).length;
  return activeCount < limit;
}

function getDoneColumn() {
  return state.columns.find((column) => isDoneColumn(column)) || null;
}

function findTaskLocation(taskId) {
  for (const column of state.columns) {
    const task = column.tasks.find((entry) => entry.id === taskId);
    if (task) return { column, task };
  }
  return null;
}

function isTaskCompleted(task) {
  return typeof task?.completedAt === 'string' && task.completedAt.length > 0;
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

function renderTaskEditorActivities() {
  taskEditActivitiesEl.innerHTML = '';
  const activities = normalizeTaskActivities(taskEditorState.activities);
  taskEditorState.activities = activities;

  if (!activities.length) {
    const empty = document.createElement('li');
    empty.className = 'checklist-empty';
    empty.textContent = 'Aún no hay actividades.';
    taskEditActivitiesEl.append(empty);
    return;
  }

  activities.forEach((activity) => {
    const item = document.createElement('li');
    item.className = 'checklist-item';
    const label = document.createElement('label');
    const toggle = document.createElement('input');
    const text = document.createElement('input');
    const remove = document.createElement('button');
    const metaRow = document.createElement('div');
    const dateInput = document.createElement('input');
    const reminderSelect = document.createElement('select');
    const nestedWrap = document.createElement('details');
    const nestedSummary = document.createElement('summary');
    const nestedList = document.createElement('ul');
    const nestedForm = document.createElement('div');
    const nestedInput = document.createElement('input');
    const nestedAddBtn = document.createElement('button');
    const subItems = normalizeActivityItems(activity.items);
    const doneSub = subItems.filter((subItem) => subItem.done).length;

    toggle.type = 'checkbox';
    toggle.checked = activity.done;
    text.type = 'text';
    text.className = 'activity-input';
    text.maxLength = 80;
    text.value = activity.title;
    text.placeholder = 'Nombre de actividad';
    remove.type = 'button';
    remove.className = 'icon-btn delete-activity';
    remove.title = 'Eliminar actividad';
    remove.textContent = '×';

    toggle.addEventListener('change', () => {
      taskEditorState.activities = taskEditorState.activities.map((entry) =>
        entry.id === activity.id
          ? {
              ...entry,
              done: toggle.checked,
              items: normalizeActivityItems(entry.items).map((subItem) => ({ ...subItem, done: toggle.checked })),
            }
          : entry
      );
      renderTaskEditorActivities();
    });

    text.addEventListener('change', () => {
      const nextTitle = text.value.trim();
      if (!nextTitle) {
        text.value = activity.title;
        return;
      }
      taskEditorState.activities = taskEditorState.activities.map((entry) =>
        entry.id === activity.id ? { ...entry, title: nextTitle } : entry
      );
    });

    remove.addEventListener('click', () => {
      taskEditorState.activities = taskEditorState.activities.filter((entry) => entry.id !== activity.id);
      renderTaskEditorActivities();
    });

    metaRow.className = 'activity-meta-row';
    dateInput.type = 'date';
    dateInput.className = 'activity-date';
    dateInput.value = normalizeDateString(activity.dueDate);
    reminderSelect.className = 'activity-reminder';
    [0, 1, 2, 3, 7].forEach((days) => {
      const option = document.createElement('option');
      option.value = String(days);
      option.textContent = reminderLabel(days);
      if (normalizeReminderDays(activity.reminderDays) === days) option.selected = true;
      reminderSelect.append(option);
    });
    dateInput.addEventListener('change', () => {
      const date = normalizeDateString(dateInput.value);
      taskEditorState.activities = taskEditorState.activities.map((entry) =>
        entry.id === activity.id ? { ...entry, dueDate: date } : entry
      );
    });
    reminderSelect.addEventListener('change', () => {
      const days = normalizeReminderDays(reminderSelect.value);
      taskEditorState.activities = taskEditorState.activities.map((entry) =>
        entry.id === activity.id ? { ...entry, reminderDays: days } : entry
      );
    });

    nestedWrap.className = 'nested-checklist';
    nestedWrap.open = subItems.length === 0;
    nestedSummary.className = 'nested-checklist-summary';
    nestedSummary.textContent = `Sub-actividades (${doneSub}/${subItems.length})`;
    nestedList.className = 'nested-checklist-items';
    nestedForm.className = 'nested-checklist-form';
    nestedInput.className = 'activity-input';
    nestedInput.type = 'text';
    nestedInput.maxLength = 80;
    nestedInput.placeholder = 'Nueva sub-actividad...';
    nestedAddBtn.type = 'button';
    nestedAddBtn.className = 'icon-btn';
    nestedAddBtn.textContent = '+';
    nestedAddBtn.title = 'Agregar sub-actividad';

    if (!subItems.length) {
      const empty = document.createElement('li');
      empty.className = 'checklist-empty';
      empty.textContent = 'Sin sub-actividades.';
      nestedList.append(empty);
    } else {
      subItems.forEach((subItem) => {
        const subEl = document.createElement('li');
        subEl.className = 'checklist-item nested-item';
        const subLabel = document.createElement('label');
        const subToggle = document.createElement('input');
        const subText = document.createElement('input');
        const subRemove = document.createElement('button');

        subToggle.type = 'checkbox';
        subToggle.checked = subItem.done;
        subText.type = 'text';
        subText.className = 'activity-input';
        subText.maxLength = 80;
        subText.value = subItem.title;
        subText.placeholder = 'Nombre de sub-actividad';
        subRemove.type = 'button';
        subRemove.className = 'icon-btn delete-activity';
        subRemove.title = 'Eliminar sub-actividad';
        subRemove.textContent = '×';

        subToggle.addEventListener('change', () => {
          taskEditorState.activities = taskEditorState.activities.map((entry) => {
            if (entry.id !== activity.id) return entry;
            const nextItems = normalizeActivityItems(entry.items).map((value) =>
              value.id === subItem.id ? { ...value, done: subToggle.checked } : value
            );
            return { ...entry, items: nextItems, done: nextItems.length > 0 ? nextItems.every((value) => value.done) : entry.done };
          });
          renderTaskEditorActivities();
        });

        subText.addEventListener('change', () => {
          const nextTitle = subText.value.trim();
          if (!nextTitle) {
            subText.value = subItem.title;
            return;
          }
          taskEditorState.activities = taskEditorState.activities.map((entry) => {
            if (entry.id !== activity.id) return entry;
            const nextItems = normalizeActivityItems(entry.items).map((value) =>
              value.id === subItem.id ? { ...value, title: nextTitle } : value
            );
            return { ...entry, items: nextItems };
          });
        });

        subRemove.addEventListener('click', () => {
          taskEditorState.activities = taskEditorState.activities.map((entry) => {
            if (entry.id !== activity.id) return entry;
            const nextItems = normalizeActivityItems(entry.items).filter((value) => value.id !== subItem.id);
            return { ...entry, items: nextItems, done: nextItems.length > 0 ? nextItems.every((value) => value.done) : entry.done };
          });
          renderTaskEditorActivities();
        });

        subLabel.append(subToggle, subText);
        subEl.append(subLabel, subRemove);
        nestedList.append(subEl);
      });
    }

    nestedAddBtn.addEventListener('click', () => {
      const subTitle = nestedInput.value.trim();
      if (!subTitle) return;
      taskEditorState.activities = taskEditorState.activities.map((entry) => {
        if (entry.id !== activity.id) return entry;
        const nextItems = [...normalizeActivityItems(entry.items), { id: crypto.randomUUID(), title: subTitle, done: false }];
        return { ...entry, items: nextItems, done: false };
      });
      renderTaskEditorActivities();
    });

    label.append(toggle, text);
    metaRow.append(dateInput, reminderSelect);
    item.append(label, remove, metaRow);
    nestedForm.append(nestedInput, nestedAddBtn);
    nestedWrap.append(nestedSummary, nestedList, nestedForm);
    item.append(nestedWrap);
    taskEditActivitiesEl.append(item);
  });
}

function openTaskEditor(taskId, options = {}) {
  const location = findTaskLocation(taskId);
  if (!location) {
    setFeedback('No se encontró la tarea.', true);
    return;
  }

  taskEditorState = {
    taskId,
    activities: normalizeTaskActivities(location.task.activities),
    returnMode: options.returnMode || null,
  };

  taskEditTitleInput.value = location.task.title || '';
  taskEditTitleInput.classList.remove('input-error');
  taskEditFeedback.textContent = '';
  taskEditDescriptionInput.value = location.task.description || '';
  taskEditPriorityInput.value = location.task.priority || 'medium';
  taskEditDueDateInput.value = location.task.dueDate || '';
  taskEditActivityInput.value = '';
  renderTaskEditorActivities();
  if (completedDialog.open) completedDialog.close();
  openDialogSafely(taskEditDialog);
}

function setTaskEditFeedback(message, isError = false) {
  taskEditFeedback.textContent = message;
  taskEditFeedback.style.color = isError ? 'var(--danger)' : '#ffd8a0';
}

async function updateTaskActivities(columnId, taskId, activities) {
  const nextActivities = normalizeTaskActivities(activities);
  const doneByChecklist = nextActivities.length > 0 && nextActivities.every((activity) => activity.done);
  const now = new Date().toISOString();

  let updatedTask = null;
  state.columns = state.columns.map((column) => {
    if (column.id !== columnId) return column;
    return {
      ...column,
      tasks: column.tasks.map((task) => {
        if (task.id !== taskId) return task;
        updatedTask = {
          ...task,
          activities: nextActivities,
          completedAt: doneByChecklist ? task.completedAt || now : '',
        };
        return updatedTask;
      }),
    };
  });

  if (!updatedTask) return;

  const currentColumn = getColumnById(columnId);
  const doneColumn = getDoneColumn();
  const shouldMoveToDone =
    doneByChecklist &&
    currentColumn &&
    !isDoneColumn(currentColumn) &&
    !isStoredColumn(currentColumn) &&
    doneColumn &&
    doneColumn.id !== columnId;

  if (shouldMoveToDone) {
    state.columns = state.columns.map((column) => {
      if (column.id === columnId) {
        return { ...column, tasks: column.tasks.filter((task) => task.id !== taskId) };
      }
      if (column.id === doneColumn.id) {
        return { ...column, tasks: [...column.tasks, updatedTask] };
      }
      return column;
    });
  }

  await commitBoardChanges();
}

function getActivityProgress(activities) {
  const safeActivities = normalizeTaskActivities(activities);
  const done = safeActivities.filter((activity) => activity.done).length;
  return { total: safeActivities.length, done };
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

  const targetColumn = getColumnById(toColumnId);
  if (!targetColumn) return;
  if (!canAddTaskToColumn(targetColumn)) {
    setFeedback(`La columna "${targetColumn.name}" alcanzó su límite WIP.`, true);
    state.columns = state.columns.map((column) => {
      if (column.id !== fromColumnId) return column;
      return { ...column, tasks: [...column.tasks, movingTask] };
    });
    return;
  }

  state.columns = state.columns.map((column) => {
    if (column.id !== toColumnId) return column;
    const now = new Date().toISOString();
    const isGuardado = isStoredColumn(column);
    const isHecho = isDoneColumn(column);
    const nextTask = {
      ...movingTask,
      archivedAt: isGuardado ? now : '',
      completedAt: isHecho || isGuardado ? movingTask.completedAt || now : movingTask.completedAt || '',
    };
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
  const doneStatusEl = clone.querySelector('.done-status');
  const editBtn = clone.querySelector('.edit-task');
  const deleteBtn = clone.querySelector('.delete-task');
  const checklistSummaryEl = clone.querySelector('.checklist-summary');
  const checklistListEl = clone.querySelector('.checklist-items');
  const checklistFormEl = clone.querySelector('.checklist-form');
  const checklistInputEl = clone.querySelector('.activity-input');
  const progressEl = clone.querySelector('.task-progress');

  const activities = normalizeTaskActivities(task.activities);
  const progress = getActivityProgress(activities);
  const completed = isTaskCompleted(task);

  taskEl.dataset.taskId = task.id;
  taskEl.dataset.columnId = columnId;
  titleEl.textContent = task.title;
  descriptionEl.textContent = task.description || 'Sin descripción';
  priorityEl.classList.add(task.priority);
  priorityEl.textContent = priorityLabel(task.priority);
  dueEl.textContent = formatDate(task.dueDate);
  dueEl.dateTime = task.dueDate || '';
  progressEl.textContent =
    progress.total > 0
      ? `${progress.done}/${progress.total} actividades`
      : completed
        ? 'Tarea terminada'
        : 'Sin actividades';
  checklistSummaryEl.textContent = `Actividades (${progress.done}/${progress.total})`;

  if (completed) {
    taskEl.classList.add('task-completed');
    doneStatusEl.classList.remove('hidden');
    doneStatusEl.textContent = 'Terminada';
  }

  if (!activities.length) {
    const emptyEl = document.createElement('li');
    emptyEl.className = 'checklist-empty';
    emptyEl.textContent = 'Aún no hay actividades.';
    checklistListEl.append(emptyEl);
  } else {
    activities.forEach((activity) => {
      const itemEl = document.createElement('li');
      itemEl.className = 'checklist-item';
      const labelEl = document.createElement('label');
      const toggleEl = document.createElement('input');
      const titleEl = document.createElement('span');
      const removeBtn = document.createElement('button');
      const subItems = normalizeActivityItems(activity.items);

      toggleEl.type = 'checkbox';
      toggleEl.checked = activity.done;
      titleEl.textContent = activity.title;
      removeBtn.type = 'button';
      removeBtn.className = 'icon-btn delete-activity';
      removeBtn.title = 'Eliminar actividad';
      removeBtn.textContent = '×';

      labelEl.append(toggleEl, titleEl);
      itemEl.append(labelEl, removeBtn);

      toggleEl.addEventListener('change', () => {
        const nextActivities = activities.map((entry) =>
          entry.id === activity.id
            ? {
                ...entry,
                done: toggleEl.checked,
                items: normalizeActivityItems(entry.items).map((subItem) => ({ ...subItem, done: toggleEl.checked })),
              }
            : entry
        );
        updateTaskActivities(columnId, task.id, nextActivities).catch((error) => setFeedback(error.message, true));
      });

      removeBtn.addEventListener('click', () => {
        const nextActivities = activities.filter((entry) => entry.id !== activity.id);
        updateTaskActivities(columnId, task.id, nextActivities).catch((error) => setFeedback(error.message, true));
      });

      if (subItems.length) {
        const subItemsEl = document.createElement('ul');
        subItemsEl.className = 'subactivity-list';
        subItems.forEach((subItem) => {
          const subEl = document.createElement('li');
          subEl.className = 'subactivity-name';
          subEl.textContent = subItem.title;
          subItemsEl.append(subEl);
        });
        itemEl.append(subItemsEl);
      }

      checklistListEl.append(itemEl);
    });
  }

  taskEl.addEventListener('dragstart', () => {
    draggedTask = { taskId: task.id, fromColumnId: columnId };
    taskEl.classList.add('dragging');
  });

  taskEl.addEventListener('dragend', () => {
    taskEl.classList.remove('dragging');
    draggedTask = { taskId: null, fromColumnId: null };
  });

  deleteBtn.addEventListener('click', () => {
    deleteTask(columnId, task.id).catch((error) => setFeedback(error.message, true));
  });

  editBtn.addEventListener('click', () => {
    openTaskEditor(task.id);
  });

  taskEl.addEventListener('dblclick', (event) => {
    if (event.target.closest('button, input, textarea, select, summary, form')) return;
    openTaskEditor(task.id);
  });

  checklistFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = checklistInputEl.value.trim();
    if (!title) return;

        const nextActivities = [
          ...activities,
          { id: crypto.randomUUID(), title, done: false, dueDate: '', reminderDays: 0, items: [] },
        ];
        updateTaskActivities(columnId, task.id, nextActivities).catch((error) => setFeedback(error.message, true));
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
  const setColumnWipBtn = clone.querySelector('.set-column-wip');
  const toggleColumnVisibilityBtn = clone.querySelector('.toggle-column-visibility');
  const moveLeftBtn = clone.querySelector('.move-column-left');
  const moveRightBtn = clone.querySelector('.move-column-right');
  const addTaskBtn = clone.querySelector('.add-task');
  const deleteColumnBtn = clone.querySelector('.delete-column');
  const formEl = clone.querySelector('.task-form');
  const cancelBtn = clone.querySelector('.cancel-task');
  const isGuardado = isStoredColumn(column);
  const archivedTasks = isGuardado ? column.tasks : column.tasks.filter((task) => isArchivedTask(task));
  const activeTasks = isGuardado ? [] : column.tasks.filter((task) => !isArchivedTask(task));
  const sourceTasks = isGuardado ? archivedTasks : activeTasks;

  const query = getSearchQuery();
  const visibleTasks = sourceTasks.filter((task) => {
    if (!query) return true;
    const activitiesText = normalizeTaskActivities(task.activities)
      .flatMap((activity) => [
        activity.title,
        ...normalizeActivityItems(activity.items).map((subItem) => subItem.title),
      ])
      .join(' ');
    const searchable = `${task.title} ${task.description} ${priorityLabel(task.priority)} ${activitiesText}`.toLowerCase();
    return searchable.includes(query);
  });

  columnEl.dataset.columnId = column.id;
  columnEl.draggable = true;
  titleEl.textContent = column.name;
  countEl.textContent = isGuardado
    ? `${archivedTasks.length} guardada${archivedTasks.length === 1 ? '' : 's'}`
    : `${visibleTasks.length} tarea${visibleTasks.length === 1 ? '' : 's'}`;
  if (!isGuardado) {
    const wip = getWipStatus(column);
    if (wip.limited) {
      countEl.textContent = wip.exceeded
        ? `${wip.activeCount}/${wip.limit} WIP (+${wip.overload})`
        : `${wip.activeCount}/${wip.limit} WIP`;
    }
    countEl.classList.toggle('wip-alert', wip.atLimit || wip.exceeded);
    countEl.classList.toggle('wip-critical', wip.exceeded);
    columnEl.classList.toggle('wip-alert', wip.atLimit || wip.exceeded);
    columnEl.classList.toggle('wip-critical', wip.exceeded);
  }
  visibleTasks.forEach((task) => tasksEl.append(createTaskElement(task, column.id)));

  const columnIndex = state.columns.findIndex((col) => col.id === column.id);
  moveLeftBtn.disabled = columnIndex <= 0;
  moveRightBtn.disabled = columnIndex < 0 || columnIndex >= state.columns.length - 1;

  moveLeftBtn.addEventListener('click', () => {
    moveColumn(column.id, -1).catch((error) => setFeedback(error.message, true));
  });

  moveRightBtn.addEventListener('click', () => {
    moveColumn(column.id, 1).catch((error) => setFeedback(error.message, true));
  });

  toggleColumnVisibilityBtn.addEventListener('click', () => {
    toggleColumnVisibility(column.id, false).catch((error) => setFeedback(error.message, true));
  });

  if (isGuardado) {
    setColumnWipBtn.style.display = 'none';
    renameColumnBtn.style.display = 'none';
    deleteColumnBtn.style.display = 'none';
    addTaskBtn.textContent = 'Ver';
    addTaskBtn.title = 'Ver tareas guardadas';
    addTaskBtn.addEventListener('click', () => {
      openCompletedTasksDialog({ mode: 'stored' });
    });
  } else {
    setColumnWipBtn.addEventListener('click', () => {
      wipLimitInput.value = column.wipLimit ? String(column.wipLimit) : '';
      if (!openDialogSafely(wipDialog)) return;
      wipDialog.addEventListener(
        'close',
        () => {
          if (wipDialog.returnValue !== 'default') return;
          const nextLimit = normalizeWipLimit(wipLimitInput.value.trim());
          state.columns = state.columns.map((col) => (col.id === column.id ? { ...col, wipLimit: nextLimit } : col));
          commitBoardChanges().catch((error) => setFeedback(error.message, true));
        },
        { once: true }
      );
    });

    renameColumnBtn.addEventListener('click', () => {
      renameColumnInput.value = column.name;
      if (!openDialogSafely(renameColumnDialog)) return;
      renameColumnDialog.addEventListener(
        'close',
        () => {
          if (renameColumnDialog.returnValue === 'cancel') return;
          const newName = renameColumnInput.value.trim();
          if (!newName) return;

          state.columns = state.columns.map((col) => {
            if (col.id !== column.id) return col;
            return { ...col, name: newName };
          });

          commitBoardChanges().catch((error) => setFeedback(error.message, true));
        },
        { once: true }
      );
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
        completedAt: '',
        activities: [],
      };

      if (!newTask.title) return;
      if (!canAddTaskToColumn(column)) {
        setFeedback(`La columna "${column.name}" alcanzó su límite WIP.`, true);
        return;
      }

      state.columns = state.columns.map((col) => {
        if (col.id !== column.id) return col;
        return { ...col, tasks: [...col.tasks, newTask] };
      });

      commitBoardChanges().catch((error) => setFeedback(error.message, true));
    });

    deleteColumnBtn.addEventListener('click', () => {
      if (state.columns.length <= 1) {
        setFeedback('Debe existir al menos una columna.', true);
        return;
      }

      (async () => {
        const hasTasks = column.tasks.length > 0;
        if (hasTasks) {
          const confirmed = await askConfirm(
            'Eliminar columna',
            'La columna tiene tareas. ¿Seguro que deseas eliminarla?',
            'Eliminar'
          );
          if (!confirmed) return;
        }

        state.columns = state.columns.filter((col) => col.id !== column.id);
        commitBoardChanges().catch((error) => setFeedback(error.message, true));
      })();
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
    if (!draggedTask.taskId) return;
    moveTask(draggedTask.fromColumnId, draggedTask.taskId, column.id).catch((error) => setFeedback(error.message, true));
  });

  columnEl.addEventListener('dragstart', (event) => {
    if (event.target.closest('.task')) return;
    draggedColumnId = column.id;
    columnEl.classList.add('dragging');
  });

  columnEl.addEventListener('dragend', () => {
    draggedColumnId = null;
    columnEl.classList.remove('dragging');
  });

  columnEl.addEventListener('dragover', (event) => {
    if (!draggedColumnId || draggedColumnId === column.id) return;
    event.preventDefault();
  });

  columnEl.addEventListener('drop', (event) => {
    if (!draggedColumnId || draggedColumnId === column.id || event.target.closest('.task')) return;
    event.preventDefault();
    moveColumnToIndex(draggedColumnId, column.id).catch((error) => setFeedback(error.message, true));
  });

  return columnEl;
}

function renderBoard() {
  boardEl.innerHTML = '';
  const overloadedColumns = state.columns.filter((column) => isWipExceeded(column)).length;
  if (viewWipAlertsBtn) {
    viewWipAlertsBtn.textContent = `Saturadas (${overloadedColumns})`;
  }
  const visibleColumns = state.columns.filter((column) => {
    if (isColumnHidden(column.id)) return false;
    if (!showOnlyWipAlerts) return true;
    return isWipExceeded(column);
  });
  if (showOnlyWipAlerts) {
    visibleColumns.sort((a, b) => {
      const wa = getWipStatus(a);
      const wb = getWipStatus(b);
      if (wb.overload !== wa.overload) return wb.overload - wa.overload;
      return wb.activeCount - wa.activeCount;
    });
  }
  if (showOnlyWipAlerts && visibleColumns.length === 0) {
    const empty = document.createElement('article');
    empty.className = 'column glass';
    const title = document.createElement('h2');
    title.className = 'column-title';
    title.textContent = 'Sin columnas saturadas';
    const desc = document.createElement('p');
    desc.className = 'muted';
    desc.textContent = 'Todas las columnas están dentro de su límite WIP.';
    empty.append(title, desc);
    boardEl.append(empty);
  }
  visibleColumns.forEach((column) => boardEl.append(createColumnElement(column)));
  renderColumnVisibilityPanel();
  renderHiddenColumnsBar();
  renderCalendarView();
  updateStats();
}

function renderColumnVisibilityPanel() {
  columnVisibilityList.innerHTML = '';
  state.columns.forEach((column) => {
    const item = document.createElement('label');
    item.className = 'visibility-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !isColumnHidden(column.id);
    checkbox.addEventListener('change', () => {
      toggleColumnVisibility(column.id, checkbox.checked).catch((error) => setFeedback(error.message, true));
    });

    const text = document.createElement('span');
    text.textContent = column.name;
    item.append(checkbox, text);
    columnVisibilityList.append(item);
  });
}

async function toggleColumnVisibility(columnId, visible) {
  const current = Array.isArray(state.hiddenColumnIds) ? state.hiddenColumnIds : [];
  const visibleCount = state.columns.length - current.length;
  if (visible) {
    state.hiddenColumnIds = current.filter((id) => id !== columnId);
  } else if (!current.includes(columnId)) {
    if (visibleCount <= 1) {
      setFeedback('Debe quedar al menos una columna visible.', true);
      return;
    }
    state.hiddenColumnIds = [...current, columnId];
  }
  await commitBoardChanges();
}

function renderHiddenColumnsBar() {
  const hiddenIds = Array.isArray(state.hiddenColumnIds) ? state.hiddenColumnIds : [];
  hiddenColumnsList.innerHTML = '';
  if (!hiddenIds.length) {
    hiddenColumnsBar.classList.add('hidden');
    return;
  }

  if (currentView === 'calendar') {
    hiddenColumnsBar.classList.add('hidden');
    return;
  }

  hiddenColumnsBar.classList.remove('hidden');
  hiddenIds.forEach((columnId) => {
    const column = getColumnById(columnId);
    if (!column) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost hidden-column-chip';
    btn.textContent = `Mostrar ${column.name}`;
    btn.addEventListener('click', () => {
      toggleColumnVisibility(column.id, true).catch((error) => setFeedback(error.message, true));
    });
    hiddenColumnsList.append(btn);
  });
}

function setView(nextView) {
  if (currentView === 'board' && nextView === 'calendar') {
    columnPanelWasOpen = !columnVisibilityPanel.classList.contains('hidden');
  }
  currentView = nextView === 'calendar' ? 'calendar' : 'board';
  const isCalendar = currentView === 'calendar';
  boardEl.classList.toggle('hidden', isCalendar);
  statsEl.classList.toggle('hidden', isCalendar);
  if (isCalendar) {
    columnVisibilityPanel.classList.add('hidden');
  } else if (columnPanelWasOpen) {
    columnVisibilityPanel.classList.remove('hidden');
  }
  hiddenColumnsBar.classList.toggle('hidden', isCalendar || (state.hiddenColumnIds || []).length === 0);
  calendarPanel.classList.toggle('hidden', !isCalendar);
  viewCalendarBtn.classList.toggle('primary', isCalendar);
  viewCalendarBtn.classList.toggle('ghost', !isCalendar);
  if (isCalendar) renderCalendarView();
}

function formatDateIsoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function collectCalendarEvents() {
  const events = [];
  state.columns.forEach((column) => {
    column.tasks.forEach((task) => {
      const taskDue = normalizeDateString(task.dueDate);
      if (taskDue) {
        events.push({
          date: taskDue,
          title: task.title,
          type: 'task',
          done: isTaskCompleted(task),
          reminderDays: 0,
        });
      }
      normalizeTaskActivities(task.activities).forEach((activity) => {
        const activityDue = normalizeDateString(activity.dueDate);
        if (!activityDue) return;
        events.push({
          date: activityDue,
          title: `${task.title} / ${activity.title}`,
          type: 'activity',
          done: Boolean(activity.done),
          reminderDays: normalizeReminderDays(activity.reminderDays),
        });
      });
    });
  });
  return events;
}

function renderCalendarView() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  calendarMonthLabel.textContent = calendarCursor.toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const events = collectCalendarEvents();
  const eventsByDate = new Map();
  events.forEach((event) => {
    const list = eventsByDate.get(event.date) || [];
    list.push(event);
    eventsByDate.set(event.date, list);
  });

  calendarGrid.innerHTML = '';
  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach((label) => {
    const weekday = document.createElement('div');
    weekday.className = 'calendar-weekday';
    weekday.textContent = label;
    calendarGrid.append(weekday);
  });

  for (let i = 0; i < startWeekday; i += 1) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day';
    calendarGrid.append(blank);
  }

  const todayIso = formatDateIsoLocal(new Date());
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    const iso = formatDateIsoLocal(cellDate);
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (iso === todayIso) cell.classList.add('today');
    const number = document.createElement('div');
    number.className = 'calendar-day-number';
    number.textContent = String(day);
    cell.append(number);

    const dayEvents = eventsByDate.get(iso) || [];
    dayEvents.slice(0, 3).forEach((event) => {
      const tag = document.createElement('div');
      tag.className = 'calendar-event';
      tag.textContent = event.type === 'activity' ? `Act: ${event.title}` : `Tar: ${event.title}`;
      cell.append(tag);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement('div');
      more.className = 'calendar-event';
      more.textContent = `+${dayEvents.length - 3} más`;
      cell.append(more);
    }
    calendarGrid.append(cell);
  }

  remindersList.innerHTML = '';
  const now = new Date(`${todayIso}T00:00:00`);
  const reminders = events
    .filter((event) => event.reminderDays > 0 && !event.done)
    .map((event) => {
      const due = new Date(`${event.date}T00:00:00`);
      const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));
      return { ...event, diffDays };
    })
    .filter((event) => event.diffDays <= event.reminderDays)
    .sort((a, b) => a.diffDays - b.diffDays);

  if (!reminders.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Sin recordatorios pendientes para este rango.';
    remindersList.append(empty);
    return;
  }

  reminders.slice(0, 12).forEach((event) => {
    const item = document.createElement('li');
    const when = event.diffDays < 0 ? `Vencida hace ${Math.abs(event.diffDays)} día(s)` : `Vence en ${event.diffDays} día(s)`;
    item.textContent = `${event.title} — ${formatDate(event.date)} (${when})`;
    remindersList.append(item);
  });
}

async function moveColumn(columnId, direction) {
  const fromIndex = state.columns.findIndex((column) => column.id === columnId);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= state.columns.length) return;
  const next = [...state.columns];
  const [moving] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moving);
  state.columns = next;
  await commitBoardChanges();
}

async function moveColumnToIndex(fromColumnId, targetColumnId) {
  const fromIndex = state.columns.findIndex((column) => column.id === fromColumnId);
  const targetIndex = state.columns.findIndex((column) => column.id === targetColumnId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
  const next = [...state.columns];
  const [moving] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moving);
  state.columns = next;
  await commitBoardChanges();
}

function collectCompletedTasks(mode = 'all') {
  const result = [];
  state.columns.forEach((column) => {
    column.tasks.forEach((task) => {
      const isStored = isStoredColumn(column);
      const isCompleted = isDoneColumn(column) || isStored || isTaskCompleted(task);
      if (!isCompleted) return;
      if (mode === 'stored' && !isStored) return;
      if (mode === 'done' && isStored) return;
      if (mode === 'all' || mode === 'stored' || mode === 'done') {
        result.push({ ...task, columnName: column.name });
      }
    });
  });
  return result;
}

function openCompletedTasksDialog(options = {}) {
  const mode = options.mode || 'all';
  const titleByMode = {
    all: 'Tareas terminadas y almacenadas',
    stored: 'Tareas almacenadas',
    done: 'Tareas terminadas',
  };
  completedTitle.textContent = titleByMode[mode] || titleByMode.all;
  const completedTasks = collectCompletedTasks(mode);
  completedList.innerHTML = '';

  if (!completedTasks.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay tareas terminadas o almacenadas.';
    completedList.append(empty);
  } else {
    completedTasks.forEach((task, index) => {
      const item = document.createElement('article');
      item.className = 'completed-item';
      const completedText = task.completedAt ? `Finalizada: ${formatDate(task.completedAt.slice(0, 10))}` : '';
      const archivedText = task.archivedAt ? `Almacenada: ${formatDate(task.archivedAt.slice(0, 10))}` : '';
      const title = document.createElement('h3');
      title.textContent = `${index + 1}. ${task.title}`;
      const description = document.createElement('p');
      description.textContent = task.description || 'Sin descripción';
      const column = document.createElement('p');
      column.className = 'muted';
      column.textContent = `Columna: ${task.columnName}`;
      const meta = document.createElement('p');
      meta.className = 'muted';
      meta.textContent = [completedText, archivedText].filter(Boolean).join(' | ') || 'Sin fecha de cierre';
      const editDescriptionBtn = document.createElement('button');
      editDescriptionBtn.type = 'button';
      editDescriptionBtn.className = 'btn ghost completed-edit-btn';
      editDescriptionBtn.textContent = 'Editar tarea';
      editDescriptionBtn.addEventListener('click', () => {
        openTaskEditor(task.id, { returnMode: mode });
      });
      item.append(title, description, column, meta, editDescriptionBtn);
      completedList.append(item);
    });
  }

  openDialogSafely(completedDialog);
}

searchInput.addEventListener('input', renderBoard);
toggleColumnsBtn.addEventListener('click', () => {
  if (currentView === 'calendar') setView('board');
  columnVisibilityPanel.classList.toggle('hidden');
  columnPanelWasOpen = !columnVisibilityPanel.classList.contains('hidden');
});
viewCalendarBtn.addEventListener('click', () => {
  setView(currentView === 'calendar' ? 'board' : 'calendar');
});
viewCompletedBtn.addEventListener('click', openCompletedTasksDialog);
calendarPrevBtn.addEventListener('click', () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendarView();
});
calendarNextBtn.addEventListener('click', () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendarView();
});
backToBoardBtn.addEventListener('click', () => setView('board'));
viewWipAlertsBtn?.addEventListener('click', () => {
  showOnlyWipAlerts = !showOnlyWipAlerts;
  if (currentView === 'calendar') setView('board');
  viewWipAlertsBtn.classList.toggle('primary', showOnlyWipAlerts);
  viewWipAlertsBtn.classList.toggle('ghost', !showOnlyWipAlerts);
  renderBoard();
});
themeSelect?.addEventListener('change', () => {
  const nextTheme = themeIds.has(themeSelect.value) ? themeSelect.value : 'default';
  applyTheme(nextTheme);
  localStorage.setItem(getThemeStorageKey(), nextTheme);
});
function addActivityFromEditorInput() {
  const title = taskEditActivityInput.value.trim();
  if (!title) {
    setTaskEditFeedback('Escribe un nombre para la actividad.', true);
    return false;
  }
  taskEditorState.activities = [
    ...taskEditorState.activities,
    { id: crypto.randomUUID(), title, done: false, dueDate: '', reminderDays: 0, items: [] },
  ];
  taskEditActivityInput.value = '';
  setTaskEditFeedback('');
  renderTaskEditorActivities();
  taskEditActivityInput.focus();
  return true;
}

taskEditAddActivityBtn.addEventListener('click', addActivityFromEditorInput);
taskEditActivityInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addActivityFromEditorInput();
});

taskEditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!taskEditorState.taskId) return;

  const location = findTaskLocation(taskEditorState.taskId);
  if (!location) {
    taskEditDialog.close();
    return;
  }

  const title = taskEditTitleInput.value.trim();
  if (!title) {
    taskEditTitleInput.classList.add('input-error');
    setTaskEditFeedback('El título es obligatorio.', true);
    taskEditTitleInput.focus();
    return;
  }
  taskEditTitleInput.classList.remove('input-error');
  setTaskEditFeedback('');
  const description = taskEditDescriptionInput.value.trim();
  const priority = ['low', 'medium', 'high'].includes(taskEditPriorityInput.value) ? taskEditPriorityInput.value : 'medium';
  const dueDate = taskEditDueDateInput.value;

  try {
    await editTask(location.column.id, taskEditorState.taskId, { title, description, priority, dueDate });
    const refreshed = findTaskLocation(taskEditorState.taskId);
    if (refreshed) {
      await updateTaskActivities(refreshed.column.id, taskEditorState.taskId, taskEditorState.activities);
    }
    if (taskEditorState.returnMode) {
      openCompletedTasksDialog({ mode: taskEditorState.returnMode });
    }
    taskEditDialog.close();
  } catch (error) {
    setFeedback(error.message, true);
  }
});

taskEditDialog.addEventListener('close', () => {
  taskEditorState = { taskId: null, activities: [], returnMode: null };
  taskEditTitleInput.classList.remove('input-error');
  setTaskEditFeedback('');
});

taskEditTitleInput.addEventListener('input', () => {
  if (taskEditTitleInput.value.trim()) {
    taskEditTitleInput.classList.remove('input-error');
    if (taskEditFeedback.textContent === 'El título es obligatorio.') {
      setTaskEditFeedback('');
    }
  }
});

addColumnBtn.addEventListener('click', () => {
  columnNameInput.value = '';
  openDialogSafely(columnDialog);
});

columnDialog?.addEventListener('close', () => {
  if (columnDialog.returnValue !== 'default') return;
  const name = columnNameInput.value.trim();
  if (!name) return;

  state.columns.push({ id: crypto.randomUUID(), name, tasks: [], wipLimit: null });
  commitBoardChanges().catch((error) => setFeedback(error.message, true));
});

async function commitBoardChanges() {
  await persistBoard();
  renderBoard();
}
