import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/health", (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "error",
    service: "TaskFlow API",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

export default router;
