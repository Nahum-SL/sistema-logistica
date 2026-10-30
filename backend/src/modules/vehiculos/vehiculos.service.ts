import { diffFields, recordAudit } from "../../shared/utils/audit.js";
import {
  ConflictError,
  NotFoundError,
  type ErrorDetail,
} from "../../shared/errors/AppError.js";
import { buildXlsx } from "../../shared/utils/excel.js";
import {
  buildPagination,
  type Pagination,
} from "../../shared/utils/pagination.js";
import { isDuplicateEntryError } from "../../shared/utils/isDuplicateEntryError.js";
import { vehiculosRepository } from "./vehiculos.repository.js";
import type {
  CreateVehiculoInput,
  ExportVehiculosQuery,
  ListVehiculosQuery,
  UpdateVehiculoInput,
} from "./vehiculos.schema.js";
import type {
  Vehiculo,
  VehiculoOptions,
  VehiculoUniqueField,
} from "./vehiculos.types.js";

const ENTIDAD = "vehiculo";

const CONFLICT_MESSAGES: Record<VehiculoUniqueField, string> = {
  vin: "Ya existe un vehículo con este VIN / serie",
  numeroMotor: "Ya existe un vehículo con este número de motor",
  placa: "Ya existe un vehículo con esta placa",
};

function conflictError(fields: VehiculoUniqueField[]): ConflictError {
  const details: ErrorDetail[] = fields.map((field) => ({
    field,
    message: CONFLICT_MESSAGES[field],
  }));

  return new ConflictError(
    "Hay datos que ya pertenecen a otro vehículo",
    details,
  );
}

/** Traduce el ER_DUP_ENTRY de la BD (condición de carrera) indicando qué campo chocó. */
function translateDuplicate(error: unknown): never {
  if (isDuplicateEntryError(error)) {
    const message = String(
      (error as { sqlMessage?: unknown }).sqlMessage ?? "",
    );
    const field: VehiculoUniqueField = message.includes("numero_motor")
      ? "numeroMotor"
      : message.includes("placa")
        ? "placa"
        : "vin";

    throw conflictError([field]);
  }

  throw error;
}

/** Lógica de negocio de vehículos (identificación física de cada unidad). */
export class VehiculosService {
  async list(
    query: ListVehiculosQuery,
  ): Promise<{ items: Vehiculo[]; pagination: Pagination }> {
    const { page, limit, ...filters } = query;
    const { items, total } = await vehiculosRepository.findPage(
      filters,
      page,
      limit,
    );

    return { items, pagination: buildPagination(page, limit, total) };
  }

  options(): Promise<VehiculoOptions> {
    return vehiculosRepository.findOptions();
  }

  /** @throws {NotFoundError} Si el vehículo no existe (404). */
  async getById(id: number): Promise<Vehiculo> {
    const vehiculo = await vehiculosRepository.findById(id);

    if (!vehiculo) throw new NotFoundError("El vehículo no existe");

    return vehiculo;
  }

  /** @throws {ConflictError} Si el VIN, el motor o la placa ya existen (409, con el campo en `details`). */
  async create(input: CreateVehiculoInput, actorId: number): Promise<Vehiculo> {
    const conflicts = await vehiculosRepository.findConflicts(input);
    if (conflicts.length > 0) throw conflictError(conflicts);

    let vehiculo: Vehiculo;
    try {
      vehiculo = await vehiculosRepository.create(input);
    } catch (error) {
      translateDuplicate(error);
    }

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: vehiculo.id,
      accion: "CREATE",
      cambios: {
        vin: vehiculo.vin,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
      },
    });

    return vehiculo;
  }

  /**
   * @throws {NotFoundError} Si no existe (404).
   * @throws {ConflictError} Si el VIN, el motor o la placa ya pertenecen a otro vehículo (409).
   */
  async update(
    id: number,
    input: UpdateVehiculoInput,
    actorId: number,
  ): Promise<Vehiculo> {
    const before = await this.getById(id);

    // Solo se verifican los valores únicos que realmente cambian.
    const conflicts = await vehiculosRepository.findConflicts(
      {
        vin:
          input.vin !== undefined && input.vin !== before.vin
            ? input.vin
            : undefined,
        numeroMotor:
          input.numeroMotor && input.numeroMotor !== before.numeroMotor
            ? input.numeroMotor
            : undefined,
        placa:
          input.placa && input.placa !== before.placa ? input.placa : undefined,
      },
      id,
    );
    if (conflicts.length > 0) throw conflictError(conflicts);

    try {
      await vehiculosRepository.update(id, input);
    } catch (error) {
      translateDuplicate(error);
    }

    const after = await this.getById(id);
    const cambios = diffFields(before, after, [
      "vin",
      "marca",
      "modelo",
      "color",
      "anioModelo",
      "numeroMotor",
      "tipoCombustible",
      "placa",
    ]);

    if (Object.keys(cambios).length > 0) {
      await recordAudit({
        usuarioId: actorId,
        entidad: ENTIDAD,
        entidadId: id,
        accion: "UPDATE",
        cambios,
      });
    }

    return after;
  }

  /** Excel con todos los vehículos que cumplen los filtros. */
  async exportToExcel(
    filters: ExportVehiculosQuery,
    actorId: number,
  ): Promise<Buffer> {
    const vehiculos = await vehiculosRepository.findAll(filters);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: null,
      accion: "EXPORT",
      cambios: { filtros: filters, filas: vehiculos.length },
    });

    return buildXlsx(
      "Vehículos",
      [
        { header: "VIN / Serie", key: "vin", width: 22 },
        { header: "Marca", key: "marca", width: 14 },
        { header: "Modelo", key: "modelo", width: 28 },
        { header: "Color", key: "color", width: 12 },
        { header: "Año modelo", key: "anioModelo", width: 12 },
        { header: "N° motor", key: "numeroMotor", width: 18 },
        { header: "Combustible", key: "tipoCombustible", width: 22 },
        { header: "Placa", key: "placa", width: 12 },
        { header: "Registrado", key: "createdAt", width: 20 },
      ],
      vehiculos.map((v) => ({
        vin: v.vin,
        marca: v.marca,
        modelo: v.modelo,
        color: v.color ?? "",
        anioModelo: v.anioModelo ?? "",
        numeroMotor: v.numeroMotor ?? "",
        tipoCombustible: v.tipoCombustible ?? "",
        placa: v.placa ?? "",
        createdAt: v.createdAt,
      })),
    );
  }
}

export const vehiculosService = new VehiculosService();
