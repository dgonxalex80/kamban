const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT || 3000);
const MAX_PORT_RETRIES = 10;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';
const app = express();
const db = new Database(path.join(__dirname, 'data.sqlite'));

initializeDb();

app.use(express.json({ limit: '1mb' }));
app.use(
  session({
    name: 'kamban.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  return res.json({ user });
});

app.post('/api/auth/register', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y clave son obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La clave debe tener mínimo 6 caracteres' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Ese usuario ya existe' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const fakeEmail = `${username}@kamban.local`;

  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, board_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, fakeEmail, passwordHash, JSON.stringify(createDefaultBoard()), now);

  req.session.userId = Number(result.lastInsertRowid);
  return res.status(201).json({ user: { id: Number(result.lastInsertRowid), username } });
});

app.post('/api/auth/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y clave son obligatorios' });
  }

  const user = db.prepare('SELECT id, name, password_hash FROM users WHERE name = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  req.session.userId = user.id;
  return res.json({ user: { id: user.id, username: user.name } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo cerrar sesión' });
    return res.json({ ok: true });
  });
});

app.get('/api/board', requireAuth, (req, res) => {
  const row = db.prepare('SELECT board_json FROM users WHERE id = ?').get(req.session.userId);
  if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });

  try {
    const board = normalizeBoard(JSON.parse(row.board_json));
    db.prepare('UPDATE users SET board_json = ? WHERE id = ?').run(JSON.stringify(board), req.session.userId);
    return res.json({ board });
  } catch {
    return res.status(500).json({ error: 'Tablero corrupto en base de datos' });
  }
});

app.put('/api/board', requireAuth, (req, res) => {
  const board = req.body?.board;
  if (!isValidBoard(board)) {
    return res.status(400).json({ error: 'Formato de tablero inválido' });
  }

  const normalized = normalizeBoard(board);
  db.prepare('UPDATE users SET board_json = ? WHERE id = ?').run(JSON.stringify(normalized), req.session.userId);
  return res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

startServer(PORT, 0);

function startServer(port, retries) {
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Kamban Flow ejecutándose en http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      if (process.env.PORT) {
        // eslint-disable-next-line no-console
        console.error(`El puerto ${port} ya está en uso. Define otro puerto, por ejemplo: PORT=${port + 1} npm run dev`);
        process.exit(1);
      }

      if (retries < MAX_PORT_RETRIES) {
        const nextPort = port + 1;
        // eslint-disable-next-line no-console
        console.warn(`Puerto ${port} en uso. Intentando ${nextPort}...`);
        return startServer(nextPort, retries + 1);
      }
    }

    // eslint-disable-next-line no-console
    console.error(`No se pudo iniciar el servidor en el puerto ${port}:`, error.message || error);
    process.exit(1);
  });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  return next();
}

function initializeDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      board_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function getUser(userId) {
  const row = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  return { id: row.id, username: row.name };
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function createDefaultBoard() {
  return {
    hiddenColumnIds: [],
    columns: [
      { id: crypto.randomUUID(), name: 'Ideas', tasks: [] },
      { id: crypto.randomUUID(), name: 'Por Hacer', tasks: [] },
      { id: crypto.randomUUID(), name: 'En Progreso', tasks: [] },
      { id: crypto.randomUUID(), name: 'Hecho', tasks: [] },
      { id: crypto.randomUUID(), name: 'Guardado', tasks: [] },
    ],
  };
}

function normalizeBoard(board) {
  if (!board || !Array.isArray(board.columns)) return createDefaultBoard();
  const required = ['Ideas', 'Por Hacer', 'En Progreso', 'Hecho', 'Guardado'];
  const columns = board.columns.map((col) => normalizeColumn(col, col?.name || 'Columna'));

  required.forEach((requiredName) => {
    const exists = columns.some((column) => normalizeColumnName(column.name) === normalizeColumnName(requiredName));
    if (!exists) {
      columns.push({ id: crypto.randomUUID(), name: requiredName, tasks: [] });
    }
  });

  const validIds = new Set(columns.map((column) => column.id));
  const hiddenColumnIds = Array.isArray(board.hiddenColumnIds)
    ? board.hiddenColumnIds.filter((id) => typeof id === 'string' && validIds.has(id))
    : [];

  return { ...board, hiddenColumnIds, columns };
}

function normalizeColumnName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeColumn(column, fallbackName) {
  const tasks = Array.isArray(column?.tasks) ? column.tasks.map(normalizeTask) : [];
  return {
    id: typeof column?.id === 'string' && column.id ? column.id : crypto.randomUUID(),
    name: String(fallbackName || column?.name || 'Columna'),
    tasks,
  };
}

function normalizeTask(task) {
  const activities = normalizeActivities(task?.activities);
  const doneByChecklist = activities.length > 0 && activities.every((activity) => activity.done);
  return {
    id: typeof task?.id === 'string' && task.id ? task.id : crypto.randomUUID(),
    title: String(task?.title || 'Sin título'),
    description: String(task?.description || ''),
    priority: ['low', 'medium', 'high'].includes(task?.priority) ? task.priority : 'medium',
    dueDate: String(task?.dueDate || ''),
    archivedAt: typeof task?.archivedAt === 'string' ? task.archivedAt : '',
    completedAt:
      typeof task?.completedAt === 'string' && task.completedAt
        ? task.completedAt
        : doneByChecklist
          ? new Date().toISOString()
          : '',
    activities,
  };
}

function normalizeActivities(activities) {
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

function isValidBoard(board) {
  if (!board || !Array.isArray(board.columns)) return false;
  if (board.hiddenColumnIds !== undefined) {
    if (!Array.isArray(board.hiddenColumnIds)) return false;
    if (board.hiddenColumnIds.some((id) => typeof id !== 'string')) return false;
  }

  for (const column of board.columns) {
    if (!column || typeof column.id !== 'string' || typeof column.name !== 'string') return false;
    if (!Array.isArray(column.tasks)) return false;

    for (const task of column.tasks) {
      if (!task || typeof task.id !== 'string' || typeof task.title !== 'string') return false;
      if (typeof task.description !== 'string') return false;
      if (!['low', 'medium', 'high'].includes(task.priority)) return false;
      if (typeof task.dueDate !== 'string') return false;
      if (task.archivedAt !== undefined && typeof task.archivedAt !== 'string') return false;
      if (task.completedAt !== undefined && typeof task.completedAt !== 'string') return false;
      if (task.activities !== undefined) {
        if (!Array.isArray(task.activities)) return false;
        for (const activity of task.activities) {
          if (!activity || typeof activity.id !== 'string' || typeof activity.title !== 'string') return false;
          if (typeof activity.done !== 'boolean') return false;
          if (activity.items !== undefined) {
            if (!Array.isArray(activity.items)) return false;
            for (const item of activity.items) {
              if (!item || typeof item.id !== 'string' || typeof item.title !== 'string') return false;
              if (typeof item.done !== 'boolean') return false;
            }
          }
        }
      }
    }
  }

  return true;
}
