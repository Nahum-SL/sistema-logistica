import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";

// ===========
// MODULOS
// ===========
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import proveedoresRoutes from "./modules/proveedores/proveedores.routes.js";
import propietariosRoutes from "./modules/propietarios/propietarios.routes.js";
import vehiculosRoutes from "./modules/vehiculos/vehiculos.routes.js";
import comprasRoutes from "./modules/compras/compras.routes.js";
// ===========
// MIDDLEWARES
// ===========
import { NotFoundError } from "./shared/errors/AppError.js";
import { errorHandler } from "./shared/middlewares/error.middleware.js";
import { env } from "./config/env.js";

const app = express();

// Funciona igual desde src/app.ts (tsx) y desde dist/app.js (compilado).
const frontendDist = path.resolve(import.meta.dirname, "../../frontend/dist");

// Solo mayor a 0 si hay un proxy inverso delante (ver TRUST_PROXY en env.ts).
app.set("trust proxy", env.TRUST_PROXY);

// ======================================
// Seguridad y análisis de solicitudes
// ======================================

// El sistema se sirve por HTTP en la red local: se desactiva todo lo que
// asume HTTPS (HSTS y upgrade-insecure-requests dejarían la pantalla en blanco)
// y las cabeceras que los navegadores ignoran en orígenes HTTP no confiables.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { "upgrade-insecure-requests": null },
    },
    strictTransportSecurity: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  }),
);

// Origen del frontend en desarrollo (Vite). En producción se sirve desde este mismo servidor.
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check público: permite comprobar que Express está respondiendo.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Sistema de logística API en ejecución",
    timestamp: new Date().toISOString(),
  });
});

// Módulos con prefijo propio
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/propietarios", propietariosRoutes);
app.use("/api/vehiculos", vehiculosRoutes);
app.use("/api/compras", comprasRoutes);
// Aquí se registrarán: proveedores, vehículos, compras, documentos, reportes...

// Una ruta /api inexistente debe seguir respondiendo JSON, no el index.html.
app.use("/api", (_req, _res, next) => {
  next(new NotFoundError("La ruta solicitada no existe"));
});

// Solo en producción y si el build existe.
if (env.NODE_ENV === "production") {
  if (!fs.existsSync(frontendDist)) {
    throw new Error(
      `No se encontró el build del frontend en ${frontendDist}. Ejecuta pnpm build:all`,
    );
  }
  app.use(express.static(frontendDist, { index: false }));

  // Fallback de la SPA: cualquier ruta de React (p. ej. /compras/12).
  // En Express 5 el comodín debe llevar nombre.
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// 404 handler - Middleware para manejar rutas no encontradas
app.use((_req, _res, next) => {
  next(new NotFoundError("La ruta solicitada no existe"));
});

app.use(errorHandler);

export default app;
