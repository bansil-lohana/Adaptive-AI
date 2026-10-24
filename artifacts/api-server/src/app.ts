import "./types";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";

const app: Express = express();

const codespaceName = process.env.CODESPACE_NAME?.trim().toLowerCase();
const forwardedDomain = (
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"
)
  .trim()
  .replace(/^\.+|\.+$/g, "")
  .toLowerCase();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin): origin is string => Boolean(origin)),
);

function isCodespacesForwardedOrigin(origin: string): boolean {
  if (!codespaceName || !forwardedDomain) return false;

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const prefix = `${codespaceName}-`;
    const suffix = `.${forwardedDomain}`;
    if (url.protocol !== "https:" || !hostname.startsWith(prefix) || !hostname.endsWith(suffix)) {
      return false;
    }

    const forwardedPort = hostname.slice(prefix.length, -suffix.length);
    return /^\d+$/.test(forwardedPort);
  } catch {
    return false;
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      const isLocalDevelopment =
        origin !== undefined && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (
        !origin ||
        isLocalDevelopment ||
        allowedOrigins.has(origin.replace(/\/+$/, "")) ||
        isCodespacesForwardedOrigin(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
