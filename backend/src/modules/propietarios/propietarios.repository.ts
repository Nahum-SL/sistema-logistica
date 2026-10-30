import type { Knex } from "knex";
import db from "../../db/knex.js";
import { escapeLike } from "../../shared/utils/escapeLike.js";
import type {
  CreatePropietarioData,
  DocumentType,
  Propietario,
  PropietarioFilters,
  UpdatePropietarioData,
} from "./propietarios.types.js";

export class PropietariosRepository {
  private select() {
    return db("propietarios").select({
      id: "id",
      tipoDocumento: "tipo_documento",
      numeroDocumento: "numero_documento",
      nombreCompleto: "nombre_completo",
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
  }

  private map(row: Record<string, unknown>): Propietario {
    return {
      id: Number(row.id),
      tipoDocumento: (row.tipoDocumento as DocumentType | null) ?? null,
      numeroDocumento:
        row.numeroDocumento === null ? null : String(row.numeroDocumento),
      nombreCompleto: String(row.nombreCompleto),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  private applyFilters<T extends Knex.QueryBuilder>(
    query: T,
    filters: PropietarioFilters,
  ): T {
    if (filters.tipoDocumento)
      query.where("tipo_documento", filters.tipoDocumento);

    if (filters.search) {
      const pattern = `%${escapeLike(filters.search)}%`;
      query.where((builder) =>
        builder
          .where("nombre_completo", "like", pattern)
          .orWhere("numero_documento", "like", pattern),
      );
    }

    return query;
  }

  async findPage(
    filters: PropietarioFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Propietario[]; total: number }> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("nombre_completo", "asc")
      .orderBy("id", "asc")
      .limit(limit)
      .offset((page - 1) * limit);

    const counted = await this.applyFilters(db("propietarios"), filters)
      .count({ total: "*" })
      .first();

    return {
      items: rows.map((row) => this.map(row)),
      total: Number(counted?.total ?? 0),
    };
  }

  async findAll(filters: PropietarioFilters): Promise<Propietario[]> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("nombre_completo", "asc")
      .orderBy("id", "asc");

    return rows.map((row) => this.map(row));
  }

  async findById(id: number): Promise<Propietario | null> {
    const row = await this.select().where({ id }).first();
    return row ? this.map(row) : null;
  }

  async documentExists(
    tipo: DocumentType,
    numero: string,
    exceptId?: number,
  ): Promise<boolean> {
    const query = db("propietarios")
      .select("id")
      .where({ tipo_documento: tipo, numero_documento: numero });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });

    return Boolean(await query.first());
  }

  /** @throws Errores del driver (`ER_DUP_ENTRY` por documento) se propagan sin envolver. */
  async create(data: CreatePropietarioData): Promise<Propietario> {
    const [insertedId] = await db("propietarios").insert({
      nombre_completo: data.nombreCompleto,
      tipo_documento: data.tipoDocumento ?? null,
      numero_documento: data.numeroDocumento ?? null,
    });

    const propietario = await this.findById(Number(insertedId));
    if (!propietario)
      throw new Error("No se pudo recuperar el propietario creado");

    return propietario;
  }

  /** Devuelve `false` si el propietario no existe. `null` borra el valor; `undefined` lo deja igual. */
  async update(id: number, data: UpdatePropietarioData): Promise<boolean> {
    const changes: Record<string, unknown> = { updated_at: db.fn.now() };
    if (data.nombreCompleto !== undefined)
      changes.nombre_completo = data.nombreCompleto;
    if (data.tipoDocumento !== undefined)
      changes.tipo_documento = data.tipoDocumento;
    if (data.numeroDocumento !== undefined)
      changes.numero_documento = data.numeroDocumento;

    return (await db("propietarios").where({ id }).update(changes)) > 0;
  }
}

export const propietariosRepository = new PropietariosRepository();
