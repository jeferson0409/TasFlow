# TaskFlow

TaskFlow es una aplicación web para organizar tareas por fecha, estado, categoría y prioridad. Permite crear, consultar, actualizar, filtrar y eliminar tareas. Los registros se guardan en MongoDB Atlas; el navegador no usa almacenamiento local para persistirlos.

## Tecnologías

- **Frontend:** HTML semántico, CSS y JavaScript nativo (Fetch API).
- **Backend:** Node.js, Express y Mongoose.
- **Base de datos:** MongoDB Atlas.

## Arquitectura

Express sirve los archivos estáticos de `frontend/` y expone la API bajo `/api`. El cliente hace solicitudes al mismo origen. Las rutas de tareas validan y consultan el modelo Mongoose `Task`; Atlas es el almacenamiento persistente. El backend comprueba la conexión a la base de datos antes de empezar a escuchar.

El estado en memoria del frontend solo sirve para dibujar la interfaz y se vuelve a cargar desde la API. No se usa `localStorage` ni un arreglo como almacenamiento persistente.

## Requisitos

- Node.js y npm.
- Un clúster de MongoDB Atlas, un usuario de base de datos y acceso de red autorizado para el equipo.

## Instalación y configuración

1. En MongoDB Atlas, crea o selecciona un clúster y una base de datos. Crea un usuario de base de datos con los permisos mínimos necesarios y autoriza la dirección IP del equipo en **Network Access**.
2. Desde la raíz del proyecto, crea el archivo local de configuración si aún no existe:

   ```powershell
   if (-not (Test-Path .\backend\.env)) {
     Copy-Item .\backend\.env.example .\backend\.env
   }
   ```

3. Edita `backend/.env` localmente y asigna la URI de conexión de Atlas a `MONGODB_URI`. Incluye el nombre de la base de datos y codifica los caracteres especiales de las credenciales según el formato URI. No pegues la URI en el frontend, no la compartas ni la subas al repositorio. `.env` está excluido por `.gitignore`; `.env.example` solo contiene valores de ejemplo.
4. Instala dependencias e inicia el backend desde PowerShell:

   ```powershell
   Set-Location .\backend
   npm install
   npm run dev
   ```

5. Abre `http://localhost:3000`. Express sirve el frontend y la API desde ese mismo origen. `PORT` permite elegir otro puerto. `CLIENT_URL` configura el origen permitido por CORS si se cambia la configuración de despliegue.

El servidor inicia solo después de conectar con Atlas. El endpoint `GET /api/health` informa si la base de datos está conectada. Ante una desconexión durante una solicitud, la API responde `503` con un mensaje general, sin incluir la URI ni las credenciales.

## API

Los cuerpos de creación y actualización son objetos JSON con los campos permitidos indicados en **Validaciones**. `PUT` reemplaza los datos editables de la tarea; los campos requeridos deben enviarse en cada actualización.

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/tasks` o `/api/tasks/` | Lista las tareas almacenadas en Atlas. |
| `GET` | `/api/tasks/:id` | Consulta una tarea por su ObjectId. |
| `POST` | `/api/tasks` | Crea una tarea; responde `201`. |
| `PUT` | `/api/tasks/:id` | Actualiza una tarea; responde `200`. |
| `DELETE` | `/api/tasks/:id` | Elimina una tarea; responde `200`. |
| `GET` | `/api/health` | Informa el estado de conexión de la API y MongoDB. |

Las respuestas de error usan `400` para datos o identificadores inválidos, `404` para tareas inexistentes, `409` para un conflicto de clave duplicada si lo produce la base de datos, `503` cuando MongoDB no está disponible y `500` para errores inesperados. El modelo actual no define una clave de negocio única.

## Validaciones

Las reglas se verifican tanto en el cliente como en el servidor; el servidor también valida las solicitudes directas que no pasan por el formulario.

| Campo | Regla |
|---|---|
| `title` | Obligatorio; se recortan espacios; entre 3 y 100 caracteres. |
| `description` | Opcional; texto de hasta 500 caracteres después de recortar espacios. |
| `category` | Obligatoria; `Académica`, `Personal`, `Trabajo` u `Otros`. |
| `priority` | Obligatoria; `Baja`, `Media` o `Alta`. |
| `status` | Obligatorio; `Pendiente`, `En progreso` o `Completada`. |
| `dueDate` | Opcional; fecha real con formato `AAAA-MM-DD`. |
| `scheduledTime` | Opcional; hora válida con formato `HH:mm` (24 horas). |

Los valores de texto obligatorios que quedan vacíos al recortar se rechazan. Los campos opcionales vacíos se normalizan como ausencia de valor. El formulario mantiene sus valores si la validación falla o la API responde con error.

## Estructura

```text
TaskFlow/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── models/
│   │   │   └── Task.js
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   └── tasks.routes.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env                 # configuración local; no se versiona
│   ├── .env.example
│   └── package.json
├── docs/
│   └── matriz-pruebas.md
├── frontend/
│   ├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js
│   └── index.html
└── README.md
```

## Pruebas

La matriz de [pruebas](./docs/matriz-pruebas.md) registra el resultado observado y la evidencia de cada caso. El proyecto no incluye actualmente un script de pruebas automatizadas; las verificaciones documentadas se ejecutaron contra la API conectada a Atlas y en el navegador.
