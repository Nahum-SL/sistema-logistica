// =========
// UTILS
// =========
// EXCEL
import { buildXlsx } from "../../shared/utils/excel.js";
// AUDITORIA
import { recordAudit, diffFields } from "../../shared/utils/audit.js";
// PAGINACION
import {
  buildPagination,
  type Pagination,
} from "../../shared/utils/pagination.js";
import { withConflictHandling } from "../../shared/utils/withConflictHandling.js";
// MANEJO DE ERRORES
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
// PROVEEDORES - REPOSITORY
import { proveedoresRepository } from "./proveedores.repository.js";
// PROVEEDORES - SCHEMA
import type {
  CreateProveedorInput,
  ExportProveedoresQuery,
  ListProveedoresQuery,
  SetProveedorStatusInput,
  UpdateProveedorInput,
} from "./proveedores.schema.js";
// PROVEEDORES - TYPES
import type { Proveedor } from "./proveedores.types.js";

const ENTIDAD = "proveedor";
const DUPLICATE_RUC = "Ya existe un proveedor con ese RUC";

/** Lógica de negocio de proveedores y concesionarios. */
export class ProveedoresService {
  async list(
    query: ListProveedoresQuery,
  ): Promise<{ items: Proveedor[]; pagination: Pagination }> {
    const { page, limit, ...filters } = query;
    const { items, total } = await proveedoresRepository.findPage(
      filters,
      page,
      limit,
    );

    return { items, pagination: buildPagination(page, limit, total) };
  }

  /** @throws {NotFoundError} Si el proveedor no existe (404). */
  async getById(id: number): Promise<Proveedor> {
    const proveedor = await proveedoresRepository.findById(id);

    if (!proveedor) throw new NotFoundError("El proveedor no existe");

    return proveedor;
  }

  /** @throws {ConflictError} Si el RUC ya está registrado (409). */
  async create(
    input: CreateProveedorInput,
    actorId: number,
  ): Promise<Proveedor> {
    if (await proveedoresRepository.rucExists(input.ruc)) {
      throw new ConflictError(DUPLICATE_RUC);
    }

    // `ruc` es la única restricción UNIQUE de la tabla: cubre la condición de carrera.
    const proveedor = await withConflictHandling(
      () => proveedoresRepository.create(input),
      DUPLICATE_RUC,
    );

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: proveedor.id,
      accion: "CREATE",
      cambios: { ruc: proveedor.ruc, razonSocial: proveedor.razonSocial },
    });

    return proveedor;
  }

  /**
   * @throws {NotFoundError} Si no existe (404).
   * @throws {ConflictError} Si el nuevo RUC ya pertenece a otro proveedor (409).
   */
  async update(
    id: number,
    input: UpdateProveedorInput,
    actorId: number,
  ): Promise<Proveedor> {
    const before = await this.getById(id);

    if (
      input.ruc !== undefined &&
      input.ruc !== before.ruc &&
      (await proveedoresRepository.rucExists(input.ruc, id))
    ) {
      throw new ConflictError(DUPLICATE_RUC);
    }

    await withConflictHandling(
      () => proveedoresRepository.update(id, input),
      DUPLICATE_RUC,
    );

    const after = await this.getById(id);
    const cambios = diffFields(before, after, ["ruc", "razonSocial"]);

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

  /** Activa o desactiva un proveedor (no se elimina: tiene compras asociadas). */
  async setStatus(
    id: number,
    input: SetProveedorStatusInput,
    actorId: number,
  ): Promise<Proveedor> {
    const before = await this.getById(id);

    if (before.activo === input.activo) return before;

    await proveedoresRepository.setActivo(id, input.activo);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: id,
      accion: "UPDATE",
      cambios: { activo: { antes: before.activo, despues: input.activo } },
    });

    return this.getById(id);
  }

  /** Genera el Excel con todos los proveedores que cumplen los filtros. */
  async exportToExcel(
    filters: ExportProveedoresQuery,
    actorId: number,
  ): Promise<Buffer> {
    const proveedores = await proveedoresRepository.findAll(filters);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: null,
      accion: "EXPORT",
      cambios: { filtros: filters, filas: proveedores.length },
    });

    return buildXlsx(
      "Proveedores",
      [
        { header: "RUC", key: "ruc", width: 16 },
        { header: "Razón social", key: "razonSocial", width: 50 },
        { header: "Estado", key: "estado", width: 12 },
        { header: "Registrado", key: "createdAt", width: 20 },
      ],
      proveedores.map((p) => ({
        ruc: p.ruc,
        razonSocial: p.razonSocial,
        estado: p.activo ? "ACTIVO" : "INACTIVO",
        createdAt: p.createdAt,
      })),
    );
  }
}

export const proveedoresService = new ProveedoresService();
