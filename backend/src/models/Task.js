import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título es obligatorio."],
      minlength: [3, "El título debe tener al menos 3 caracteres."],
      maxlength: [100, "El título no puede superar los 100 caracteres."],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [500, "La descripción no puede superar los 500 caracteres."],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "La categoría es obligatoria."],
      enum: ["Académica", "Personal", "Trabajo", "Otros"],
    },
    priority: {
      type: String,
      required: [true, "La prioridad es obligatoria."],
      enum: ["Baja", "Media", "Alta"],
    },
    dueDate: {
      type: Date,
    },
    scheduledTime: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),
        message: "La hora sugerida debe tener el formato HH:mm.",
      },
    },
    status: {
      type: String,
      required: [true, "El estado es obligatorio."],
      enum: ["Pendiente", "En progreso", "Completada"],
    },
  },
  { timestamps: true },
);

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
