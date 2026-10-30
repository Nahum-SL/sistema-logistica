/**
 * Valores válidos del estado logístico. PROVISIONAL: el área aún no define su lista.
 * Para agregar uno, basta añadirlo aquí (la columna es VARCHAR, no requiere migración).
 */
export const ESTADOS_LOGISTICOS = [
  "PENDIENTE",
  "EN_PROCESO",
  "ENTREGADO",
] as const;
export type EstadoLogistico = (typeof ESTADOS_LOGISTICOS)[number];

export const MONEDAS = ["USD", "PEN"] as const;
export type Moneda = (typeof MONEDAS)[number];

/** Campos editables de una compra (los que se auditan al cambiar). */
export const COMPRA_FIELDS = [
  "proveedorId",
  "vehiculoId",
  "propietarioId",
  "numeroCotizacion",
  "ordenCompra",
  "notaVenta",
  "fechaReserva",
  "monedaPrecio",
  "precioTotalOriginal",
  "tipoCambio",
  "facturaSerie",
  "facturaCorrelativo",
  "fechaEmisionFactura",
  "estadoLogistico",
  "destino",
  "fechaEntrega",
  "fechaEnvioContabilidad",
  "observaciones",
] as const;
