import "dotenv/config";
import { config } from "dotenv";
import path from "node:path";

config();
config({ path: path.resolve(process.cwd(), "../../.env") });

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env.PORT ?? "5000";
const port = Number(rawPort);
const host = process.env.HOST ?? "0.0.0.0";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, host, () => {
  logger.info({ host, port }, "Server listening");
});

let shuttingDown = false;

function shutdownAfterUnhandledRejection(reason: unknown) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.error({ reason }, "Unhandled promise rejection; shutting down API server");

  const forceExit = setTimeout(() => {
    logger.error("API server did not stop gracefully; forcing shutdown");
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    if (error) logger.error({ err: error }, "Error closing API server");
    process.exitCode = 1;
  });
}

process.on("unhandledRejection", shutdownAfterUnhandledRejection);

server.on("error", (err) => {
  logger.error({ err, host, port }, "Error listening on API server");
  process.exit(1);
});
