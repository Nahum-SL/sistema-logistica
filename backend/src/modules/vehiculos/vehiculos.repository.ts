import type { Knex } from "knex";
import db from "../../db/knex.js";
import { escapeLike } from "../../shared/utils/escapeLike.js";
import type {
  CreateVehiculoData,
  UpdateVehiculoData,
  Vehiculo,
  VehiculoFilters,
  VehiculoOptions,
  VehiculoUniqueField,
} from "./vehiculos.types.js";

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export class VehiculosRepository {
  private select() {
    return db("vehiculos").select({
      id: "id",
      vin: "vin",
      marca: "marca",
      modelo: "modelo",
      color: "color",
      anioModelo: "anio_modelo",
      numeroMotor: "numero_motor",
      tipoCombustible: "tipo_combustible",
      placa: "placa",
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
  }

  private map(row: Record<string, unknown>): Vehiculo {
    return {
      id: Number(row.id),
      vin: String(row.vin),
      marca: String(row.marca),
      modelo: String(row.modelo),
      color: text(row.color),
      anioModelo: row.anioModelo === null ? null : Number(row.anioModelo),
      numeroMotor: text(row.numeroMotor),
      tipoCombustible: text(row.tipoCombustible),
      placa: text(row.placa),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  private applyFilters<T extends Knex.QueryBuilder>(
    query: T,
    filters: VehiculoFilters,
  ): T {
    if (filters.marca) query.where("marca", filters.marca);
    if (filters.anioModelo !== undefined)
      query.where("anio_modelo", filters.anioModelo);

    if (filters.search) {
      const pattern = `%${escapeLike(filters.search)}%`;
      query.where((builder) =>
        builder
          .where("vin", "like", pattern)
          .orWhere("marca", "like", pattern)
          .orWhere("modelo", "like", pattern)
          .orWhere("numero_motor", "like", pattern)
          .orWhere("placa", "like", pattern),
      );
    }

    return query;
  }

  async findPage(
    filters: VehiculoFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Vehiculo[]; total: number }> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("id", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    const counted = await this.applyFilters(db("vehiculos"), filters)
      .count({ total: "*" })
      .first();

    return {
      items: rows.map((row) => this.map(row)),
      total: Number(counted?.total ?? 0),
    };
  }

  async findAll(filters: VehiculoFilters): Promise<Vehiculo[]> {
    const rows = await this.applyFilters(this.select(), filters).orderBy(
      "id",
      "desc",
    );
    return rows.map((row) => this.map(row));
  }

  async findById(id: number): Promise<Vehiculo | null> {
    const row = await this.select().where({ id }).first();
    return row ? this.map(row) : null;
  }

  /** Marcas y modelos ya registrados, para sugerir en el formulario y mantener los nombres uniformes. */
  async findOptions(): Promise<VehiculoOptions> {
    const rows = await db("vehiculos")
      .distinct("marca", "modelo")
      .orderBy("marca", "asc")
      .orderBy("modelo", "asc");

    const modelos = rows.map((row) => ({
      marca: String(row.marca),
      modelo: String(row.modelo),
    }));

    return { marcas: [...new Set(modelos.map((m) => m.marca))], modelos };
  }

  /** Indica cuáles de los valores únicos dados ya los usa otro vehículo. */
  async findConflicts(
    candidate: {
      vin?: string;
      numeroMotor?: string | null;
      placa?: string | null;
    },
    exceptId?: number,
  ): Promise<VehiculoUniqueField[]> {
    const { vin, numeroMotor, placa } = candidate;

    if (!vin && !numeroMotor && !placa) return [];

    const query = db("vehiculos")
      .select("vin", "numero_motor", "placa")
      .where((builder) => {
        if (vin) builder.orWhere("vin", vin);
        if (numeroMotor) builder.orWhere("numero_motor", numeroMotor);
        if (placa) builder.orWhere("placa", placa);
      });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });

    const rows = await query;
    const conflicts = new Set<VehiculoUniqueField>();

    for (const row of rows) {
      if (vin && row.vin === vin) conflicts.add("vin");
      if (numeroMotor && row.numero_motor === numeroMotor)
        conflicts.add("numeroMotor");
      if (placa && row.placa === placa) conflicts.add("placa");
    }

    return [...conflicts];
  }

  /** @throws Errores del driver (`ER_DUP_ENTRY`) se propagan sin envolver. */
  async create(data: CreateVehiculoData): Promise<Vehiculo> {
    const [insertedId] = await db("vehiculos").insert({
      vin: data.vin,
      marca: data.marca,
      modelo: data.modelo,
      color: data.color ?? null,
      anio_modelo: data.anioModelo ?? null,
      numero_motor: data.numeroMotor ?? null,
      tipo_combustible: data.tipoCombustible ?? null,
      placa: data.placa ?? null,
    });

    const vehiculo = await this.findById(Number(insertedId));
    if (!vehiculo) throw new Error("No se pudo recuperar el vehículo creado");

    return vehiculo;
  }

  /** Devuelve `false` si el vehículo no existe. */
  async update(id: number, data: UpdateVehiculoData): Promise<boolean> {
    const columns: Record<keyof UpdateVehiculoData, string> = {
      vin: "vin",
      marca: "marca",
      modelo: "modelo",
      color: "color",
      anioModelo: "anio_modelo",
      numeroMotor: "numero_motor",
      tipoCombustible: "tipo_combustible",
      placa: "placa",
    };

    const changes: Record<string, unknown> = { updated_at: db.fn.now() };
    for (const key of Object.keys(columns) as (keyof UpdateVehiculoData)[]) {
      if (data[key] !== undefined) changes[columns[key]] = data[key];
    }

    return (await db("vehiculos").where({ id }).update(changes)) > 0;
  }
}

export const vehiculosRepository = new VehiculosRepository();
