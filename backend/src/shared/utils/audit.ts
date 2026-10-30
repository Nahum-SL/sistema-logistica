import db from "../../db/knex.js";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "IMPORT"
  | "EXPORT";

interface AuditEntry {
  usuarioId: number | null;
  entidad: string;
  entidadId: number | null;
  accion: AuditAction;
  cambios?: unknown;
}

/**
 * Registra una operación en la tabla `auditoria`. Un fallo al auditar se
 * registra en consola pero no deshace la operación del usuario, que ya se guardó.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db("auditoria").insert({
      usuario_id: entry.usuarioId,
      entidad: entry.entidad,
      entidad_id: entry.entidadId,
      accion: entry.accion,
      cambios:
        entry.cambios === undefined ? null : JSON.stringify(entry.cambios),
    });
  } catch (error) {
    console.error("No se pudo registrar la auditoría:", error);
  }
}

/** Devuelve solo los campos que cambiaron, con su valor anterior y el nuevo. */
export function diffFields<T extends object>(
  before: T,
  after: T,
  keys: (keyof T & string)[],
): Record<string, { antes: unknown; despues: unknown }> {
  const changes: Record<string, { antes: unknown; despues: unknown }> = {};

  for (const key of keys) {
    if (before[key] !== after[key]) {
      changes[key] = { antes: before[key], despues: after[key] };
    }
  }

  return changes;
}
