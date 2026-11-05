import cors from "cors";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import healthRoutes from "./routes/health.routes.js";
import tasksRoutes, { taskErrorHandler } from "./routes/tasks.routes.js";

const app = express();
const frontendDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../frontend",
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  }),
);
app.use(express.json());
app.use("/api", healthRoutes);
app.use("/api", tasksRoutes);
app.use("/api", (request, response) => {
  response.status(404).json({
    message: `La ruta ${request.method} ${request.originalUrl} aún no está implementada.`,
  });
});
app.use(express.static(frontendDirectory));
app.use((error, request, response, next) => {
  if (error?.type === "entity.parse.failed") {
    return response.status(400).json({ message: "El cuerpo de la solicitud debe contener JSON válido." });
  }
  return taskErrorHandler(error, request, response, next);
});

export default app;
