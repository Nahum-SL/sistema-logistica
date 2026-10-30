import { diffFields, recordAudit } from "../../shared/utils/audit.js";

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type ErrorDetail,
} from "../../shared/errors/AppError.js";

// UTILS
import { buildXlsx } from "../../shared/utils/excel.js";
import { isDuplicateEntryError } from "../../shared/utils/isDuplicateEntryError.js";
import {
  buildPagination,
  type Pagination,
} from "../../shared/utils/pagination.js";
// PROPIETARIOS - REPOSITORY
import { propietariosRepository } from "../propietarios/propietarios.repository.js";
// PROVEEDORES - REPOSITORY
import { proveedoresRepository } from "../proveedores/proveedores.repository.js";
// VEHICULOS - REPOSITORY
import { vehiculosRepository } from "../vehiculos/vehiculos.repository.js";
// COMPRAS - REPOSITORY
import { comprasRepository } from "./compras.repository.js";
// COMPRAS - CONSTANTS
import { COMPRA_FIELDS, ESTADOS_LOGISTICOS, MONEDAS } from "../../shared/constants/compras.constants.js";
// COMPRAS CONSTANTS - RULES 
import { evaluarCompra } from "../../shared/constants/compras.rules.js";
// COMPRAS - SCHEMA
import type {
  CreateCompraInput,
  ExportComprasQuery,
  ListComprasQuery,
  UpdateCompraInput,
} from "./compras.schema.js";
// COMPRAS - TYPE
import type {
  Compra,
  CompraConflictField,
  CompraDetalle,
} from "./compras.types.js";

const ENTIDAD = "compra";

const CONFLICT_MESSAGES: Record<CompraConflictField, string> = {
  ordenCompra: "Este proveedor ya tiene registrada esa orden de compra",
  factura: "Ya existe una compra con esa factura (serie y correlativo)",
};

function conflictError(fields: CompraConflictField[]): ConflictError {
  const details: ErrorDetail[] = fields.map((field) => ({
    field,
    message: CONFLICT_MESSAGES[field],
  }));

  return new ConflictError(
    "Hay datos que ya pertenecen a otra compra",
    details,
  );
}

/** Traduce el ER_DUP_ENTRY de la BD (condición de carrera) indicando qué campo chocó. */
function translateDuplicate(error: unknown): never {
  if (isDuplicateEntryError(error)) {
    const message = String(
      (error as { sqlMessage?: unknown }).sqlMessage ?? "",
    );

    if (message.includes("orden_compra")) throw conflictError(["ordenCompra"]);
    if (message.includes("factura")) throw conflictError(["factura"]);

    throw new ConflictError("Ya existe una compra con esos datos");
  }

  throw error;
}

/** Lógica de negocio de las compras de vehículos. */
export class ComprasService {
  /** Valores válidos para los selectores del formulario. */
  catalogos() {
    return {
      estadosLogisticos: [...ESTADOS_LOGISTICOS],
      monedas: [...MONEDAS],
    };
  }

  async list(
    query: ListComprasQuery,
  ): Promise<{ items: Compra[]; pagination: Pagination }> {
    const { page, limit, ...filters } = query;
    const { items, total } = await comprasRepository.findPage(
      filters,
      page,
      limit,
    );

    return { items, pagination: buildPagination(page, limit, total) };
  }

  /** @throws {NotFoundError} Si la compra no existe (404). */
  private async getCompra(id: number): Promise<Compra> {
    const compra = await comprasRepository.findById(id);

    if (!compra) throw new NotFoundError("La compra no existe");

    return compra;
  }

  /** La compra con sus alertas (contradicciones) y pendientes (datos que faltan). */
  async getById(id: number): Promise<CompraDetalle> {
    const compra = await this.getCompra(id);
    const otras = await comprasRepository.countOthersByVehiculo(
      compra.vehiculoId,
      compra.id,
    );

    return { ...compra, ...evaluarCompra(compra, otras) };
  }

  /**
   * Comprueba que lo referenciado exista. Solo mira lo que cambia, de modo que
   * editar una compra cuyo proveedor se desactivó después sigue siendo posible.
   * @throws {ValidationError} Con el campo que falla (400).
   */
  private async checkReferences(
    refs: {
      proveedorId?: number;
      vehiculoId?: number;
      propietarioId?: number | null;
    },
    before?: Compra,
  ): Promise<void> {
    const details: ErrorDetail[] = [];

    if (
      refs.proveedorId !== undefined &&
      refs.proveedorId !== before?.proveedorId
    ) {
      const proveedor = await proveedoresRepository.findById(refs.proveedorId);

      if (!proveedor)
        details.push({
          field: "proveedorId",
          message: "El proveedor indicado no existe",
        });
      else if (!proveedor.activo)
        details.push({
          field: "proveedorId",
          message: "El proveedor está inactivo",
        });
    }

    if (
      refs.vehiculoId !== undefined &&
      refs.vehiculoId !== before?.vehiculoId
    ) {
      if (!(await vehiculosRepository.findById(refs.vehiculoId))) {
        details.push({
          field: "vehiculoId",
          message: "El vehículo indicado no existe",
        });
      }
    }

    if (
      refs.propietarioId !== undefined &&
      refs.propietarioId !== null &&
      refs.propietarioId !== before?.propietarioId
    ) {
      if (!(await propietariosRepository.findById(refs.propietarioId))) {
        details.push({
          field: "propietarioId",
          message: "El propietario indicado no existe",
        });
      }
    }

    if (details.length > 0) throw new ValidationError(details);
  }

  /**
   * @throws {ValidationError} Si el proveedor, vehículo o propietario no existen o el proveedor está inactivo (400).
   * @throws {ConflictError} Si la orden de compra o la factura ya existen (409).
   */
  async create(
    input: CreateCompraInput,
    actorId: number,
  ): Promise<CompraDetalle> {
    await this.checkReferences(input);

    const conflicts = await comprasRepository.findConflicts({
      proveedorId: input.proveedorId,
      ordenCompra: input.ordenCompra ?? null,
      facturaSerie: input.facturaSerie ?? null,
      facturaCorrelativo: input.facturaCorrelativo ?? null,
    });
    if (conflicts.length > 0) throw conflictError(conflicts);

    let id: number;
    try {
      id = await comprasRepository.create(input, actorId);
    } catch (error) {
      translateDuplicate(error);
    }

    const compra = await this.getById(id);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: id,
      accion: "CREATE",
      cambios: Object.fromEntries(
        COMPRA_FIELDS.filter((field) => compra[field] !== null).map((field) => [
          field,
          compra[field],
        ]),
      ),
    });

    return compra;
  }

  /**
   * @throws {NotFoundError} Si no existe (404).
   * @throws {ValidationError} Si el nuevo proveedor, vehículo o propietario no son válidos (400).
   * @throws {ConflictError} Si la orden de compra o la factura ya pertenecen a otra compra (409).
   */
  async update(
    id: number,
    input: UpdateCompraInput,
    actorId: number,
  ): Promise<CompraDetalle> {
    const before = await this.getCompra(id);

    await this.checkReferences(input, before);

    // Valores resultantes tras aplicar el cambio: es lo que no debe chocar con otra compra.
    const effective = {
      proveedorId: input.proveedorId ?? before.proveedorId,
      ordenCompra:
        input.ordenCompra === undefined
          ? before.ordenCompra
          : input.ordenCompra,
      facturaSerie:
        input.facturaSerie === undefined
          ? before.facturaSerie
          : input.facturaSerie,
      facturaCorrelativo:
        input.facturaCorrelativo === undefined
          ? before.facturaCorrelativo
          : input.facturaCorrelativo,
    };

    const conflicts = await comprasRepository.findConflicts(effective, id);
    if (conflicts.length > 0) throw conflictError(conflicts);

    try {
      await comprasRepository.update(id, input, actorId);
    } catch (error) {
      translateDuplicate(error);
    }

    const after = await this.getById(id);
    const cambios = diffFields(before, after, [...COMPRA_FIELDS]);

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

  /** Elimina la compra con sus pagos y documentos. Queda una copia de sus datos en auditoría. */
  async remove(id: number, actorId: number): Promise<void> {
    const compra = await this.getCompra(id);

    await comprasRepository.delete(id);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: id,
      accion: "DELETE",
      cambios: Object.fromEntries(
        COMPRA_FIELDS.map((field) => [field, compra[field]]),
      ),
    });
  }

  /** Excel con todas las compras que cumplen los filtros. */
  async exportToExcel(
    filters: ExportComprasQuery,
    actorId: number,
  ): Promise<Buffer> {
    const compras = await comprasRepository.findAll(filters);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: null,
      accion: "EXPORT",
      cambios: { filtros: filters, filas: compras.length },
    });

    const documento = (c: Compra) =>
      c.propietarioTipoDocumento && c.propietarioNumeroDocumento
        ? `${c.propietarioTipoDocumento} ${c.propietarioNumeroDocumento}`
        : "";

    return buildXlsx(
      "Compras",
      [
        { header: "RUC proveedor", key: "proveedorRuc", width: 14 },
        { header: "Proveedor", key: "proveedor", width: 36 },
        { header: "VIN / Serie", key: "vin", width: 22 },
        { header: "Marca", key: "marca", width: 12 },
        { header: "Modelo", key: "modelo", width: 26 },
        { header: "Color", key: "color", width: 12 },
        { header: "Año", key: "anio", width: 8 },
        { header: "N° motor", key: "motor", width: 18 },
        { header: "Placa", key: "placa", width: 11 },
        { header: "Propietario", key: "propietario", width: 36 },
        { header: "Documento", key: "documento", width: 18 },
        { header: "Cotización", key: "cotizacion", width: 14 },
        { header: "Orden de compra", key: "orden", width: 16 },
        { header: "Nota de venta", key: "notaVenta", width: 14 },
        { header: "Fecha reserva", key: "fechaReserva", width: 14 },
        { header: "Moneda", key: "moneda", width: 9 },
        { header: "Precio", key: "precio", width: 13 },
        { header: "Tipo de cambio", key: "tipoCambio", width: 14 },
        { header: "Factura", key: "factura", width: 16 },
        { header: "F. emisión factura", key: "fechaFactura", width: 17 },
        { header: "Estado", key: "estado", width: 13 },
        { header: "Destino", key: "destino", width: 14 },
        { header: "F. entrega", key: "fechaEntrega", width: 13 },
        {
          header: "F. envío contabilidad",
          key: "fechaContabilidad",
          width: 20,
        },
        { header: "Observaciones", key: "observaciones", width: 40 },
      ],
      compras.map((c) => ({
        proveedorRuc: c.proveedorRuc,
        proveedor: c.proveedorRazonSocial,
        vin: c.vehiculoVin,
        marca: c.vehiculoMarca,
        modelo: c.vehiculoModelo,
        color: c.vehiculoColor ?? "",
        anio: c.vehiculoAnioModelo ?? "",
        motor: c.vehiculoNumeroMotor ?? "",
        placa: c.vehiculoPlaca ?? "",
        propietario: c.propietarioNombre ?? "",
        documento: documento(c),
        cotizacion: c.numeroCotizacion ?? "",
        orden: c.ordenCompra ?? "",
        notaVenta: c.notaVenta ?? "",
        fechaReserva: c.fechaReserva ?? "",
        moneda: c.monedaPrecio,
        precio: c.precioTotalOriginal ?? "",
        tipoCambio: c.tipoCambio ?? "",
        factura: c.facturaSerie
          ? `${c.facturaSerie}-${c.facturaCorrelativo}`
          : "",
        fechaFactura: c.fechaEmisionFactura ?? "",
        estado: c.estadoLogistico,
        destino: c.destino ?? "",
        fechaEntrega: c.fechaEntrega ?? "",
        fechaContabilidad: c.fechaEnvioContabilidad ?? "",
        observaciones: c.observaciones ?? "",
      })),
    );
  }
}

export const comprasService = new ComprasService();
