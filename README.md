# Kamban Flow (Simple)

App Kanban con backend `Express + SQLite + sesiones/cookies`.

## Requisitos

- Node.js 18+

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Funcionalidades

- Registro con `usuario + clave`
- Inicio/cierre de sesión con cookies
- Tablero personal por usuario en SQLite
- Flujo base: `Ideas -> Por Hacer -> En Progreso -> Hecho -> Guardado`
- Al mover una tarea a `Guardado`, desaparece del flujo visible y queda archivada (consultable desde `Guardado`)
- CRUD de columnas y tareas
- Renombrado de columnas
- Botón para reiniciar el tablero al estado base
- Drag & drop de tareas entre columnas
- Filtro de tareas
- Métricas del tablero

## Variables opcionales

- `PORT` (default: `3000`)
- `SESSION_SECRET` (recomendado definir en producción)
