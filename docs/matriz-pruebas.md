# Matriz de pruebas — TaskFlow

Pruebas realizadas el 4 de noviembre de 2026 contra el backend local en el puerto `3001` y el clúster de MongoDB Atlas configurado localmente. Las pruebas de interfaz se ejecutaron en navegador. Los registros de prueba se eliminaron al finalizar. No se guardan URI ni credenciales en esta matriz.

| Código | Prueba | Datos utilizados | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|---|
| VAL-01 | Registro válido | Título, descripción, categoría `Personal`, prioridad `Media`, hora `09:30`, fecha `2026-11-06`, estado `Pendiente` | Crear y persistir en Atlas; responder `201` | Creado con ObjectId; consultado después por ID y en listado | Aprobada | `POST /api/tasks` `201`; lectura posterior encontró el mismo `_id` |
| VAL-02 | Campos obligatorios vacíos | Título, categoría, prioridad o estado vacíos; título compuesto solo por espacios | Rechazar cada caso con `400`; el formulario no debe aceptar título vacío | La API devolvió `400` en cada campo; el formulario rechazó el título en blanco/espacios | Aprobada | Solicitudes `POST`; formulario mostró validación y conservó el título ingresado |
| VAL-03 | Título demasiado corto | `ab` | Rechazar con `400` | Rechazado con `400` | Aprobada | `POST /api/tasks`, respuesta `400` |
| VAL-04 | Título demasiado largo | 101 caracteres | Rechazar con `400` | Rechazado con `400` | Aprobada | `POST /api/tasks`, respuesta `400`; el formulario limita a 100 |
| VAL-05 | Descripción superior a 500 caracteres | 501 caracteres no blancos | Rechazar con `400` | Rechazada con `400`; descripción vacía tras recortar espacios se normaliza correctamente | Aprobada | `POST /api/tasks`; prueba adicional de normalización |
| VAL-06 | Fecha inválida | `2026-02-31` | Rechazar fecha de calendario inexistente con `400` | Rechazada con `400` | Aprobada | `POST /api/tasks`, respuesta `400` |
| VAL-07 | Categoría inválida | `Desconocida` | Rechazar con `400` | Rechazada con `400` | Aprobada | `POST /api/tasks`, respuesta `400` |
| VAL-08 | Prioridad inválida | `Urgente` | Rechazar con `400` | Rechazada con `400` | Aprobada | `POST /api/tasks`, respuesta `400` |
| VAL-09 | Estado inválido | `Archivada` | Rechazar con `400` | Rechazado con `400` | Aprobada | `POST /api/tasks`, respuesta `400` |
| API-01 | Consulta por ID | ObjectId devuelto al crear una tarea | Devolver el registro persistido con `200` | Devolvió la tarea creada desde Atlas con `200` | Aprobada | `GET /api/tasks/:id`, `200` |
| API-02 | ID inexistente | ObjectId válido sin registro | Responder `404` | Respondió `404` | Aprobada | `GET /api/tasks/ffffffffffffffffffffffff`, `404` |
| API-03 | Actualización | Cambiar título y dejar vacíos los campos opcionales | Persistir los cambios y responder `200` | La tarea actualizada fue leída nuevamente con los cambios; campos opcionales vacíos aceptados | Aprobada | `PUT /api/tasks/:id`, luego `GET`, ambos `200` |
| UI-01 | Eliminación cancelada | Tarea de prueba; se descartó la confirmación del navegador | Mantener el registro | El registro permaneció en la interfaz después de descartar el diálogo | Aprobada | Confirmación `window.confirm` descartada; tarea seguía visible |
| UI-02 | Eliminación confirmada | Tarea de prueba; se aceptó la confirmación | Eliminar de Atlas y retirar de la interfaz | Se mostró el mensaje de eliminación y el registro desapareció | Aprobada | Confirmación aceptada; `DELETE` exitoso; listado actualizado |
| UI-03 | Persistencia después de recargar | Tarea creada y luego editada desde el formulario | Recuperar los datos guardados al recargar la página | La tarea y su título actualizado reaparecieron tras recargar | Aprobada | Navegador: crear, recargar, editar, recargar y verificar el listado |
| API-04 | JSON inválido | Cuerpo `{` con `Content-Type: application/json` | Responder `400` sin exponer detalles internos | Respondió `400` con mensaje general | Aprobada | `POST /api/tasks`, respuesta `400` |
| API-05 | MongoDB no disponible | Servidor de prueba conectado a Atlas y desconexión de Mongoose antes de consultar | Responder `503` con mensaje general, sin URI ni credenciales | Respondió `503`; no se encontraron URI ni credenciales en la respuesta | Aprobada | `GET /api/tasks` tras desconectar Mongoose; revisión de la respuesta |
| UI-04 | Conservación de valores ante error de API | Formulario válido con error `400` simulado en la respuesta | Mostrar error y mantener el formulario y los campos ingresados | El error se mostró y título/descripción permanecieron en el formulario | Aprobada | Navegador con respuesta `400` interceptada; no se creó registro |
| VAL-10 | Campos opcionales vacíos | Fecha límite y hora sugerida vacías | Aceptar ambos campos vacíos | Creación aceptada con `201` | Aprobada | `POST /api/tasks`, `201` |
| API-06 | Identificador malformado | `no-es-id` | Rechazar con `400` antes de consultar Atlas | Respondió `400` | Aprobada | `GET /api/tasks/no-es-id`, `400` |

## Cobertura pendiente

- No hay un script o suite automatizada de pruebas en `package.json`; esta matriz documenta ejecuciones manuales desde HTTP y navegador.
- No se probaron carga, concurrencia, despliegue de producción ni desconexiones intermitentes durante una operación ya iniciada.
- No se probó conflicto de duplicados: el modelo actual no declara campos con índice único ni una regla de unicidad de negocio.
