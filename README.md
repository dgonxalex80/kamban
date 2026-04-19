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

## Docker

### Requisitos

- Docker instalado

### Construir imagen

```bash
docker build -t kamban-flow .
```

### Ejecutar contenedor

```bash
docker run -d --name kamban-flow -p 3000:3000 -e SESSION_SECRET="cambia-esto" kamban-flow
```

Abre `http://localhost:3000`.

### Persistir SQLite (opcional)

Para conservar usuarios y tablero al reiniciar el contenedor:

```bash
docker run -d --name kamban-flow -p 3000:3000 -e SESSION_SECRET="cambia-esto" -v $(pwd)/data.sqlite:/app/data.sqlite kamban-flow
```

## Pasar La App A Otro PC

### 1) Subir cambios al repositorio (PC actual)

```bash
git add .
git commit -m "Prepare app for cross-machine deployment with Docker"
git push
```

### 2) Clonar y ejecutar en el otro PC

```bash
git clone https://github.com/dgonxalex80/kamban.git
cd kamban
docker build -t kamban-flow .
docker run -d --name kamban-flow -p 3000:3000 -e SESSION_SECRET="una-clave-larga" kamban-flow
```

Abre `http://localhost:3000`.

### 3) (Opcional) Mantener datos entre reinicios

```bash
docker run -d --name kamban-flow -p 3000:3000 -e SESSION_SECRET="una-clave-larga" -v $(pwd)/data.sqlite:/app/data.sqlite kamban-flow
```

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

## Licencia

Proyecto bajo licencia MIT. Ver [LICENSE](./LICENSE).
