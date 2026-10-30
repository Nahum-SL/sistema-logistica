import type { Knex } from "knex";
import db from "../../db/knex.js";
import { escapeLike } from "../../shared/utils/escapeLike.js";

import type { Moneda } from "../../shared/constants/compras.constants.js";

import type {
  Compra,
  CompraConflictField,
  CompraData,
  CompraFilters,
  CreateCompraData,
  UpdateCompraData,
} from "./compras.types.js";

/** Propiedad de la API → columna de la tabla `compras`. */
const COLUMNS: Record<keyof CompraData, string> = {
  proveedorId: "proveedor_id",
  vehiculoId: "vehiculo_id",
  propietarioId: "propietario_id",
  numeroCotizacion: "numero_cotizacion",
  ordenCompra: "orden_compra",
  notaVenta: "nota_venta",
  fechaReserva: "fecha_reserva",
  monedaPrecio: "moneda_precio",
  precioTotalOriginal: "precio_total_original",
  tipoCambio: "tipo_cambio",
  facturaSerie: "factura_serie",
  facturaCorrelativo: "factura_correlativo",
  fechaEmisionFactura: "fecha_emision_factura",
  estadoLogistico: "estado_logistico",
  destino: "destino",
  fechaEntrega: "fecha_entrega",
  fechaEnvioContabilidad: "fecha_envio_contabilidad",
  observaciones: "observaciones",
};

/** Convierte solo los campos presentes (`undefined` se omite; `null` se guarda como NULL). */
function toColumns(data: Partial<CompraData>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};

  for (const key of Object.keys(COLUMNS) as (keyof CompraData)[]) {
    if (data[key] !== undefined) columns[COLUMNS[key]] = data[key];
  }

  return columns;
}

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export class ComprasRepository {
  /** Compras unidas con proveedor, vehículo y propietario (relaciones 1 a 1, sin duplicar filas). */
  private joined() {
    return db("compras as c")
      .innerJoin("proveedores as pr", "pr.id", "c.proveedor_id")
      .innerJoin("vehiculos as v", "v.id", "c.vehiculo_id")
      .leftJoin("propietarios as po", "po.id", "c.propietario_id");
  }

  private select() {
    return this.joined().select({
      id: "c.id",
      proveedorId: "c.proveedor_id",
      vehiculoId: "c.vehiculo_id",
      propietarioId: "c.propietario_id",
      numeroCotizacion: "c.numero_cotizacion",
      ordenCompra: "c.orden_compra",
      notaVenta: "c.nota_venta",
      fechaReserva: "c.fecha_reserva",
      monedaPrecio: "c.moneda_precio",
      precioTotalOriginal: "c.precio_total_original",
      tipoCambio: "c.tipo_cambio",
      facturaSerie: "c.factura_serie",
      facturaCorrelativo: "c.factura_correlativo",
      fechaEmisionFactura: "c.fecha_emision_factura",
      estadoLogistico: "c.estado_logistico",
      destino: "c.destino",
      fechaEntrega: "c.fecha_entrega",
      fechaEnvioContabilidad: "c.fecha_envio_contabilidad",
      observaciones: "c.observaciones",
      creadoPor: "c.creado_por",
      actualizadoPor: "c.actualizado_por",
      createdAt: "c.created_at",
      updatedAt: "c.updated_at",
      proveedorRuc: "pr.ruc",
      proveedorRazonSocial: "pr.razon_social",
      vehiculoVin: "v.vin",
      vehiculoMarca: "v.marca",
      vehiculoModelo: "v.modelo",
      vehiculoColor: "v.color",
      vehiculoAnioModelo: "v.anio_modelo",
      vehiculoNumeroMotor: "v.numero_motor",
      vehiculoPlaca: "v.placa",
      propietarioNombre: "po.nombre_completo",
      propietarioTipoDocumento: "po.tipo_documento",
      propietarioNumeroDocumento: "po.numero_documento",
    });
  }

  private map(row: Record<string, unknown>): Compra {
    return {
      id: Number(row.id),
      proveedorId: Number(row.proveedorId),
      vehiculoId: Number(row.vehiculoId),
      propietarioId: num(row.propietarioId),
      numeroCotizacion: text(row.numeroCotizacion),
      ordenCompra: text(row.ordenCompra),
      notaVenta: text(row.notaVenta),
      fechaReserva: text(row.fechaReserva),
      monedaPrecio: String(row.monedaPrecio) as Moneda,
      // DECIMAL llega como texto desde MySQL; se entrega como número a la API.
      precioTotalOriginal: num(row.precioTotalOriginal),
      tipoCambio: num(row.tipoCambio),
      facturaSerie: text(row.facturaSerie),
      facturaCorrelativo: text(row.facturaCorrelativo),
      fechaEmisionFactura: text(row.fechaEmisionFactura),
      estadoLogistico: String(row.estadoLogistico),
      destino: text(row.destino),
      fechaEntrega: text(row.fechaEntrega),
      fechaEnvioContabilidad: text(row.fechaEnvioContabilidad),
      observaciones: text(row.observaciones),
      creadoPor: num(row.creadoPor),
      actualizadoPor: num(row.actualizadoPor),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      proveedorRuc: String(row.proveedorRuc),
      proveedorRazonSocial: String(row.proveedorRazonSocial),
      vehiculoVin: String(row.vehiculoVin),
      vehiculoMarca: String(row.vehiculoMarca),
      vehiculoModelo: String(row.vehiculoModelo),
      vehiculoColor: text(row.vehiculoColor),
      vehiculoAnioModelo: num(row.vehiculoAnioModelo),
      vehiculoNumeroMotor: text(row.vehiculoNumeroMotor),
      vehiculoPlaca: text(row.vehiculoPlaca),
      propietarioNombre: text(row.propietarioNombre),
      propietarioTipoDocumento: text(row.propietarioTipoDocumento),
      propietarioNumeroDocumento: text(row.propietarioNumeroDocumento),
    };
  }

  private applyFilters<T extends Knex.QueryBuilder>(
    query: T,
    filters: CompraFilters,
  ): T {
    if (filters.proveedorId !== undefined)
      query.where("c.proveedor_id", filters.proveedorId);
    if (filters.vehiculoId !== undefined)
      query.where("c.vehiculo_id", filters.vehiculoId);
    if (filters.propietarioId !== undefined)
      query.where("c.propietario_id", filters.propietarioId);
    if (filters.estadoLogistico)
      query.where("c.estado_logistico", filters.estadoLogistico);
    if (filters.desde) query.where("c.fecha_reserva", ">=", filters.desde);
    if (filters.hasta) query.where("c.fecha_reserva", "<=", filters.hasta);

    if (filters.search) {
      const pattern = `%${escapeLike(filters.search)}%`;
      query.where((builder) => {
        for (const column of [
          "c.numero_cotizacion",
          "c.orden_compra",
          "c.nota_venta",
          "v.vin",
          "v.placa",
          "v.marca",
          "v.modelo",
          "pr.razon_social",
          "po.nombre_completo",
        ]) {
          builder.orWhere(column, "like", pattern);
        }
        // Factura como "F017-00000147": se puede buscar por serie, por número o por ambos.
        builder.orWhereRaw(
          "CONCAT_WS('-', c.factura_serie, c.factura_correlativo) LIKE ?",
          [pattern],
        );
      });
    }

    return query;
  }

  async findPage(
    filters: CompraFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Compra[]; total: number }> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("c.fecha_reserva", "desc")
      .orderBy("c.id", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    const counted = await this.applyFilters(this.joined(), filters)
      .count({ total: "*" })
      .first();

    return {
      items: rows.map((row) => this.map(row)),
      total: Number(counted?.total ?? 0),
    };
  }

  async findAll(filters: CompraFilters): Promise<Compra[]> {
    const rows = await this.applyFilters(this.select(), filters)
      .orderBy("c.fecha_reserva", "desc")
      .orderBy("c.id", "desc");

    return rows.map((row) => this.map(row));
  }

  async findById(id: number): Promise<Compra | null> {
    const row = await this.select().where("c.id", id).first();
    return row ? this.map(row) : null;
  }

  /** Cuántas compras más tiene el mismo vehículo. */
  async countOthersByVehiculo(
    vehiculoId: number,
    exceptId?: number,
  ): Promise<number> {
    const query = db("compras").where({ vehiculo_id: vehiculoId });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });

    const row = await query.count({ total: "*" }).first();
    return Number(row?.total ?? 0);
  }

  /** Indica cuáles de los valores únicos dados ya los usa otra compra. */
  async findConflicts(
    candidate: {
      proveedorId: number;
      ordenCompra: string | null;
      facturaSerie: string | null;
      facturaCorrelativo: string | null;
    },
    exceptId?: number,
  ): Promise<CompraConflictField[]> {
    const { proveedorId, ordenCompra, facturaSerie, facturaCorrelativo } =
      candidate;
    const hasFactura = facturaSerie !== null && facturaCorrelativo !== null;

    if (ordenCompra === null && !hasFactura) return [];

    const query = db("compras")
      .select(
        "proveedor_id",
        "orden_compra",
        "factura_serie",
        "factura_correlativo",
      )
      .where((builder) => {
        if (ordenCompra !== null) {
          builder.orWhere({
            proveedor_id: proveedorId,
            orden_compra: ordenCompra,
          });
        }
        if (hasFactura) {
          builder.orWhere({
            factura_serie: facturaSerie,
            factura_correlativo: facturaCorrelativo,
          });
        }
      });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });

    const rows = await query;
    const conflicts = new Set<CompraConflictField>();

    for (const row of rows) {
      if (
        ordenCompra !== null &&
        row.proveedor_id === proveedorId &&
        row.orden_compra === ordenCompra
      ) {
        conflicts.add("ordenCompra");
      }
      if (
        hasFactura &&
        row.factura_serie === facturaSerie &&
        row.factura_correlativo === facturaCorrelativo
      ) {
        conflicts.add("factura");
      }
    }

    return [...conflicts];
  }

  /** @throws Errores del driver (`ER_DUP_ENTRY`) se propagan sin envolver. */
  async create(data: CreateCompraData, actorId: number): Promise<number> {
    const [insertedId] = await db("compras").insert({
      ...toColumns(data),
      creado_por: actorId,
      actualizado_por: actorId,
    });

    return Number(insertedId);
  }

  /** Devuelve `false` si la compra no existe. */
  async update(
    id: number,
    data: UpdateCompraData,
    actorId: number,
  ): Promise<boolean> {
    const updated = await db("compras")
      .where({ id })
      .update({
        ...toColumns(data),
        actualizado_por: actorId,
        updated_at: db.fn.now(),
      });

    return updated > 0;
  }

  async delete(id: number): Promise<boolean> {
    return (await db("compras").where({ id }).delete()) > 0;
  }
}

export const comprasRepository = new ComprasRepository();
