import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  await connectDatabase();

  app.listen(port, () => {
    console.log(`TaskFlow API escuchando en http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error(`TaskFlow no pudo iniciar: ${error.message}`);
  process.exitCode = 1;
});
