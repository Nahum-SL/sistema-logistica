import type { Knex } from "knex";
import db from "../../db/knex.js";
// UTILS
import { escapeLike } from "../../shared/utils/escapeLike.js";
// PROVEEDORES - TYPES
import type {
  CreateProveedorData,
  Proveedor,
  ProveedorFilters,
  UpdateProveedorData,
} from "./proveedores.types.js";

export class ProveedoresRepository {
  private select() {
    return db("proveedores").select({
      id: "id",
      ruc: "ruc",
      razonSocial: "razon_social",
      activo: "activo",
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
  }

  private map(row: Record<string, unknown>): Proveedor {
    return {
      id: Number(row.id),
      ruc: String(row.ruc),
      razonSocial: String(row.razonSocial),
      activo: Boolean(row.activo),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  private applyFilters<T extends Knex.QueryBuilder>(
    query: T,
    filters: ProveedorFilters,
  ): T {
    if (filters.activo !== undefined) query.where("activo", filters.activo);

    if (filters.search) {
      const pattern = `%${escapeLike(filters.search)}%`;
      query.where((builder) =>
        builder
          .where("ruc", "like", pattern)
          .orWhere("razon_social", "like", pattern),
      );
    }

    return query;
  }

  async findPage(
    filters: ProveedorFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Proveedor[]; total: number }> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("razon_social", "asc")
      .orderBy("id", "asc")
      .limit(limit)
      .offset((page - 1) * limit);

    const counted = await this.applyFilters(db("proveedores"), filters)
      .count({ total: "*" })
      .first();

    return {
      items: rows.map((row) => this.map(row)),
      total: Number(counted?.total ?? 0),
    };
  }

  /** Todos los que cumplen los filtros, sin paginar (para exportar). */
  async findAll(filters: ProveedorFilters): Promise<Proveedor[]> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("razon_social", "asc")
      .orderBy("id", "asc");

    return rows.map((row) => this.map(row));
  }

  async findById(id: number): Promise<Proveedor | null> {
    const row = await this.select().where({ id }).first();
    return row ? this.map(row) : null;
  }

  async rucExists(ruc: string, exceptId?: number): Promise<boolean> {
    const query = db("proveedores").select("id").where({ ruc });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });

    return Boolean(await query.first());
  }

  /** @throws Errores del driver (`ER_DUP_ENTRY` por RUC) se propagan sin envolver. */
  async create(data: CreateProveedorData): Promise<Proveedor> {
    const [insertedId] = await db("proveedores").insert({
      ruc: data.ruc,
      razon_social: data.razonSocial,
    });

    const proveedor = await this.findById(Number(insertedId));
    if (!proveedor) throw new Error("No se pudo recuperar el proveedor creado");

    return proveedor;
  }

  /** Devuelve `false` si el proveedor no existe. */
  async update(id: number, data: UpdateProveedorData): Promise<boolean> {
    const changes: Record<string, unknown> = { updated_at: db.fn.now() };
    if (data.ruc !== undefined) changes.ruc = data.ruc;
    if (data.razonSocial !== undefined) changes.razon_social = data.razonSocial;

    return (await db("proveedores").where({ id }).update(changes)) > 0;
  }

  async setActivo(id: number, activo: boolean): Promise<boolean> {
    const updated = await db("proveedores")
      .where({ id })
      .update({ activo, updated_at: db.fn.now() });

    return updated > 0;
  }
}

export const proveedoresRepository = new ProveedoresRepository();
