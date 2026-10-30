import bcrypt from "bcrypt";
import type { Knex } from "knex";

const BCRYPT_COST = 12;

/**
 * Crea el administrador inicial a partir de ADMIN_USERNAME, ADMIN_PASSWORD y
 * ADMIN_NAME. Es idempotente: si ya existe un admin, no hace nada.
 */
export async function ensureAdmin(knex: Knex): Promise<void> {
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const nombre = (process.env.ADMIN_NAME ?? "").trim() || "Administrador";

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME es obligatorio (3-50 caracteres: letras, números, punto, guion y guion bajo)",
    );
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD es obligatorio (mínimo 8 caracteres)");
  }

  const existingAdmin = await knex("usuarios").where({ rol: "admin" }).first();

  if (existingAdmin) {
    console.log("Ya existe un administrador; no se crea otro.");
    return;
  }

  await knex("usuarios").insert({
    username,
    nombre,
    password: await bcrypt.hash(password, BCRYPT_COST),
    rol: "admin",
  });

  console.log(`Administrador "${username}" creado.`);
}
