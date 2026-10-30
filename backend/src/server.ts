import app from "./app.js";
import { env } from "./config/env.js";
import db from "./db/knex.js";
import { collectRoutes } from "./shared/utils/printRoutes.js";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import proveedoresRoutes from "./modules/proveedores/proveedores.routes.js";
import propietariosRoutes from "./modules/propietarios/propietarios.routes.js";
import vehiculosRoutes from "./modules/vehiculos/vehiculos.routes.js";
import comprasRoutes from "./modules/compras/compras.routes.js";

// Escucha en todas las interfaces, para que los equipos de la red local puedan entrar.
const server = app.listen(env.PORT, () => {
  console.log(`Servidor escuchando en el puerto ${env.PORT}`);
  console.log(`Aplicación: ${env.PUBLIC_APP_URL}`);
  console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`Entorno: ${env.NODE_ENV}`);

  // Solo en desarrollo: lista los endpoints disponibles
  if (env.NODE_ENV === "development") {
    console.log("\nEndpoints disponibles:");
    console.table([
      { Método: "GET", Ruta: "/api/health" },
      ...collectRoutes(authRoutes, "/api/auth"),
      ...collectRoutes(userRoutes, "/api/users"),
      ...collectRoutes(proveedoresRoutes, "/api/proveedores"),
      ...collectRoutes(propietariosRoutes, "/api/propietarios"),
      ...collectRoutes(comprasRoutes, "/api/compras"),
      ...collectRoutes(vehiculosRoutes, "/api/vehiculos"),
    ]);
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${env.PORT} ya está en uso.`);
  } else {
    console.error("Error del servidor:", error);
  }
  process.exit(1);
});

// Cierra el servidor y la conexión a la base de datos de manera ordenada
function shutdown(signal: string): void {
  console.log(`\n${signal} recibido. Cerrando server...`);

  server.close(async (error) => {
    if (error) {
      console.error("Error cerrando el server:", error);
      process.exitCode = 1;
    }

    try {
      await db.destroy();
      console.log("Conexiones a la BD cerradas.");
    } catch (dbError) {
      console.error("Error cerrando las conexiones a la BD:", dbError);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
