import { Router } from "express";
import mongoose from "mongoose";
import Task from "../models/Task.js";

const router = Router();

const categories = ["Académica", "Personal", "Trabajo", "Otros"];
const priorities = ["Baja", "Media", "Alta"];
const statuses = ["Pendiente", "En progreso", "Completada"];
const allowedFields = new Set([
  "title",
  "description",
  "category",
  "priority",
  "scheduledTime",
  "dueDate",
  "status",
]);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireDatabase() {
  if (mongoose.connection.readyState !== 1) {
    throw new ApiError(503, "La base de datos no está disponible. Inténtalo de nuevo más tarde.");
  }
}

function validateTaskId(id) {
  if (!/^[\da-f]{24}$/i.test(id)) {
    throw new ApiError(400, "El identificador de tarea no es válido.");
  }
}

function validateTaskPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "El cuerpo de la solicitud debe ser un objeto JSON.");
  }

  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length) {
    throw new ApiError(400, `Campo(s) no permitido(s): ${unknownFields.join(", ")}.`);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3 || title.length > 100) {
    throw new ApiError(400, "El título es obligatorio y debe tener entre 3 y 100 caracteres.");
  }

  const description = body.description === undefined ? "" : body.description;
  if (typeof description !== "string") {
    throw new ApiError(400, "La descripción debe ser texto de hasta 500 caracteres.");
  }
  const normalizedDescription = description.trim();
  if (normalizedDescription.length > 500) {
    throw new ApiError(400, "La descripción debe ser texto de hasta 500 caracteres.");
  }

  if (!categories.includes(body.category)) {
    throw new ApiError(400, "Selecciona una categoría válida.");
  }
  if (!priorities.includes(body.priority)) {
    throw new ApiError(400, "Selecciona una prioridad válida.");
  }
  if (!statuses.includes(body.status)) {
    throw new ApiError(400, "Selecciona un estado válido.");
  }

  const scheduledTime = body.scheduledTime === undefined ? "" : body.scheduledTime;
  if (
    typeof scheduledTime !== "string" ||
    (scheduledTime !== "" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime))
  ) {
    throw new ApiError(400, "La hora sugerida debe tener el formato HH:mm.");
  }

  const dueDate = body.dueDate === undefined ? "" : body.dueDate;
  if (dueDate !== "") {
    const parsedDate =
      typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
        ? new Date(`${dueDate}T00:00:00.000Z`)
        : null;
    if (
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dueDate
    ) {
      throw new ApiError(400, "La fecha límite debe ser una fecha válida en formato AAAA-MM-DD.");
    }
  }

  return {
    title,
    description: normalizedDescription,
    category: body.category,
    priority: body.priority,
    scheduledTime,
    dueDate: dueDate || null,
    status: body.status,
  };
}

router.get("/tasks", async (_request, response, next) => {
  try {
    requireDatabase();
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();
    response.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get("/tasks/:id", async (request, response, next) => {
  try {
    validateTaskId(request.params.id);
    requireDatabase();
    const task = await Task.findById(request.params.id).lean();
    if (!task) {
      throw new ApiError(404, "No se encontró la tarea solicitada.");
    }
    response.json(task);
  } catch (error) {
    next(error);
  }
});

router.post("/tasks", async (request, response, next) => {
  try {
    requireDatabase();
    const task = await Task.create(validateTaskPayload(request.body));
    response.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.put("/tasks/:id", async (request, response, next) => {
  try {
    validateTaskId(request.params.id);
    requireDatabase();
    const task = await Task.findByIdAndUpdate(
      request.params.id,
      validateTaskPayload(request.body),
      { new: true, runValidators: true },
    );
    if (!task) {
      throw new ApiError(404, "No se encontró la tarea que quieres actualizar.");
    }
    response.json(task);
  } catch (error) {
    next(error);
  }
});

router.delete("/tasks/:id", async (request, response, next) => {
  try {
    validateTaskId(request.params.id);
    requireDatabase();
    const task = await Task.findByIdAndDelete(request.params.id);
    if (!task) {
      throw new ApiError(404, "No se encontró la tarea que quieres eliminar.");
    }
    response.json({ message: "Tarea eliminada correctamente." });
  } catch (error) {
    next(error);
  }
});

export function taskErrorHandler(error, _request, response, _next) {
  if (error instanceof ApiError) {
    return response.status(error.status).json({ message: error.message });
  }
  if (error?.code === 11000) {
    return response.status(409).json({ message: "Ya existe una tarea con esos datos." });
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return response.status(400).json({ message: "Los datos de la tarea no son válidos." });
  }
  if (
    mongoose.connection.readyState !== 1 ||
    /Mongo(?:Network|ServerSelection)/.test(error?.name || "")
  ) {
    return response.status(503).json({
      message: "La base de datos no está disponible. Inténtalo de nuevo más tarde.",
    });
  }

  console.error(`Error inesperado en la API de tareas (${error?.name || "Error"}).`);
  return response.status(500).json({ message: "Ocurrió un error interno al procesar la tarea." });
}

export default router;
