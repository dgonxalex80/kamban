# Kamban Flow (Simple)

App Kanban con backend `Express + SQLite + sesiones/cookies`.

## Requisitos

- Node.js 18+
- Git

## Instalar Node.js

Descarga e instala la versión LTS desde `https://nodejs.org`.

Verifica la instalación:

```bash
node -v
npm -v
```

### Ubuntu / Debian (opcional por terminal)

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v
npm -v
```

### Windows

1) Descarga el instalador LTS desde `https://nodejs.org`.
2) Ejecuta el instalador (Next -> Next).
3) Abre PowerShell y valida:

```powershell
node -v
npm -v
```

### macOS

1) Descarga el instalador LTS desde `https://nodejs.org`.
2) Instala y valida en Terminal:

```bash
node -v
npm -v
```

## Instalación de la app (clonando GitHub)

```bash
git clone https://github.com/dgonxalex80/kamban.git
cd kamban
```

Instala dependencias:

```bash
npm install
```

## Ejecución

```bash
npm run dev
```

Abre `http://localhost:3000`.
Si `3000` está ocupado, la app intentará automáticamente `3001`, `3002`, etc. (hasta 10 reintentos).

También puedes fijar el puerto manualmente:

```bash
PORT=3010 npm run dev
```

### Acceder Desde Celular En La Misma Red Wi-Fi (sin Docker)

1) En el PC servidor, inicia la app con:

```bash
npm run dev
```

2) Obtén la IP local del PC servidor:

```bash
hostname -I
```

3) Desde el celular (misma red Wi-Fi), abre:

```text
http://IP_DEL_PC_SERVIDOR:3000
```

Ejemplo: `http://192.168.1.25:3000`

Si usas otro puerto, reemplaza `3000` por ese puerto.
Si no abre, permite el puerto en el firewall del PC servidor.

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

### Acceder Desde Otro PC O Celular En La Misma Red Wi-Fi

1) En el PC donde corre Docker, inicia la app:

```bash
docker run -d --name kamban-flow -p 3000:3000 -e SESSION_SECRET="cambia-esto" kamban-flow
```

2) Obtén la IP local del PC servidor:

```bash
hostname -I
```

3) Desde el otro PC o celular conectado a la misma red, abre:

```text
http://IP_DEL_PC_SERVIDOR:3000
```

Ejemplo: `http://192.168.1.25:3000`

Si no abre, permite el puerto `3000` en el firewall del PC servidor.

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
- Reordenamiento de columnas (botones y arrastre)
- Ocultar/mostrar columnas con 1 clic
- Barra de columnas ocultas para volver a mostrarlas rápido (incluye `Hecho/Terminada`)
- Al mover una tarea a `Guardado`, desaparece del flujo visible y queda archivada
- CRUD de columnas y tareas
- Edición completa de tareas en modal (`título`, `descripción`, `prioridad`, `fecha`, `checklist`)
- Checklist de actividades por tarea
- Sub-actividades dentro de cada actividad (checklist anidada)
- En tarjetas, las sub-actividades se muestran en lista simple (nombre, una tras otra)
- Marcado automático de tarea terminada al completar checklist
- Consulta de tareas terminadas y almacenadas desde botón `Terminadas`
- Renombrado de columnas
- Botón para reiniciar el tablero al estado base
- Drag & drop de tareas entre columnas
- Filtro de tareas
- Métricas del tablero

## Actualizar La App

Si ya tienes el proyecto clonado y quieres traer la última versión:

```bash
git pull
npm install
npm run dev
```

Opcional (respaldo rápido de base de datos antes de actualizar):

```bash
cp data.sqlite data.sqlite.bak
```

## Variables opcionales

- `PORT` (default: `3000`)
- `SESSION_SECRET` (recomendado definir en producción)

## Licencia

Proyecto bajo licencia MIT. Ver [LICENSE](./LICENSE).
