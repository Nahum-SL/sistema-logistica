import type { Moneda } from "../../shared/constants/compras.constants.js";

/** Campos que el usuario puede enviar (todos los de la tabla `compras` salvo los de control). */
export interface CompraData {
  proveedorId: number;
  vehiculoId: number;
  propietarioId: number | null;
  numeroCotizacion: string | null;
  ordenCompra: string | null;
  notaVenta: string | null;
  fechaReserva: string | null;
  monedaPrecio: Moneda;
  precioTotalOriginal: number | null;
  tipoCambio: number | null;
  facturaSerie: string | null;
  facturaCorrelativo: string | null;
  fechaEmisionFactura: string | null;
  estadoLogistico: string;
  destino: string | null;
  fechaEntrega: string | null;
  fechaEnvioContabilidad: string | null;
  observaciones: string | null;
}

/** Solo proveedor y vehículo son obligatorios: los Excel se llenan por etapas. */
export type CreateCompraData = Pick<CompraData, "proveedorId" | "vehiculoId"> &
  Partial<Omit<CompraData, "proveedorId" | "vehiculoId">>;

/** `null` borra el valor (en los campos que lo admiten); `undefined` lo deja igual. */
export type UpdateCompraData = Partial<CompraData>;

/** Compra con los datos de proveedor, vehículo y propietario ya unidos (una sola fila plana). */
export interface Compra extends CompraData {
  id: number;
  proveedorRuc: string;
  proveedorRazonSocial: string;
  vehiculoVin: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoColor: string | null;
  vehiculoAnioModelo: number | null;
  vehiculoNumeroMotor: string | null;
  vehiculoPlaca: string | null;
  propietarioNombre: string | null;
  propietarioTipoDocumento: string | null;
  propietarioNumeroDocumento: string | null;
  creadoPor: number | null;
  actualizadoPor: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompraFilters {
  /** Busca en cotización, orden, nota de venta, factura, VIN, placa, marca, modelo, proveedor y propietario. */
  search?: string;
  proveedorId?: number;
  vehiculoId?: number;
  propietarioId?: number;
  estadoLogistico?: string;
  /** Rango sobre la fecha de reserva (AAAA-MM-DD, ambos inclusivos). */
  desde?: string;
  hasta?: string;
}

/** Campos únicos que pueden chocar con otra compra. */
export type CompraConflictField = "ordenCompra" | "factura";

/** Contradicción entre datos registrados. Es una advertencia: no impide guardar. */
export interface Alerta {
  codigo: string;
  mensaje: string;
  campos: string[];
}

/** Dato que falta completar. */
export interface Pendiente {
  campo: string;
  mensaje: string;
}

export interface EvaluacionCompra {
  alertas: Alerta[];
  pendientes: Pendiente[];
}

export type CompraDetalle = Compra & EvaluacionCompra;
