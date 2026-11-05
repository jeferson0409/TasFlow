import mongoose from "mongoose";

function findMongoServerError(error) {
  const pending = [error];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);
    if (current.name === "MongoServerError") {
      return current;
    }

    for (const nested of [current.cause, current.error, current.reason]) {
      if (nested) {
        pending.push(nested);
      }
    }

    const servers = current.reason?.servers;
    if (servers instanceof Map) {
      for (const server of servers.values()) {
        if (server?.error) {
          pending.push(server.error);
        }
      }
    }
  }

  return null;
}

function getConnectionSecrets(uri) {
  const secrets = [uri];

  try {
    const parsedUri = new URL(uri);
    for (const credential of [parsedUri.username, parsedUri.password]) {
      if (credential) {
        secrets.push(credential);
        try {
          secrets.push(decodeURIComponent(credential));
        } catch {
          // Keep the encoded credential in the redaction list.
        }
      }
    }
  } catch {
    // The full URI is still redacted even when it cannot be parsed.
  }

  return secrets.filter(Boolean).sort((left, right) => right.length - left.length);
}

function redactConnectionSecrets(value, secrets) {
  let message = String(value).replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[MongoDB URI redacted]");
  for (const secret of secrets) {
    message = message.split(secret).join("[redacted]");
  }
  return message.replace(
    /\b(password|passwd|pwd|username|user)\s*[:=]\s*(['"]?)[^\s,;}'"]+\2/gi,
    "$1=[redacted]",
  );
}

function formatError(error, secrets) {
  const details = [error.name || "Error"];
  if (typeof error.code === "string" || typeof error.code === "number") {
    details.push(`code=${error.code}`);
  }
  if (typeof error.codeName === "string") {
    details.push(`codeName=${error.codeName}`);
  }
  details.push(`message=${redactConnectionSecrets(error.message || "Sin mensaje", secrets)}`);
  return details.join(" ");
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI no está configurada. Añade la URI de MongoDB Atlas a backend/.env.",
    );
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await mongoose.connection.db.admin().ping();
    console.log("Conexión a MongoDB Atlas establecida correctamente.");
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "Error desconocido";
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      const secrets = getConnectionSecrets(uri);
      console.error(`[MongoDB] Error de Mongoose: ${formatError(error, secrets)}`);

      const mongoError = findMongoServerError(error);
      if (mongoError && mongoError !== error) {
        console.error(`[MongoDB] Error original del driver: ${formatError(mongoError, secrets)}`);
      }
    }

    let cleanupErrorType = "";

    try {
      await mongoose.disconnect();
    } catch (cleanupError) {
      cleanupErrorType =
        cleanupError instanceof Error ? ` El cierre también falló (${cleanupError.name}).` : "";
    }

    throw new Error(
      `No fue posible conectar con MongoDB Atlas (${errorType}). Verifica la URI, las credenciales y el acceso de red configurado en Atlas.${cleanupErrorType}`,
    );
  }
}
