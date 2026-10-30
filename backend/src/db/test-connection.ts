import db from "./knex.js";

/** Comprueba la conexión a MySQL con las variables del .env. Uso: pnpm db:check */
try {
  await db.raw("SELECT 1");
  const [rows] = await db.raw("SELECT DATABASE() AS db, @@time_zone AS tz");
  console.log("Conexión a MySQL correcta:", rows[0]);
} catch (error) {
  console.error("No se pudo conectar a MySQL:", error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
