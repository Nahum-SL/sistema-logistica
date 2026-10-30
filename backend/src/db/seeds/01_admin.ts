import type { Knex } from "knex";
import { ensureAdmin } from "../../shared/helpers/ensureAdmin.js";

/** Desarrollo: crea el admin. Los datos de ejemplo del Excel se agregan aquí más adelante. */
export async function seed(knex: Knex): Promise<void> {
  await ensureAdmin(knex);
}
