import type {
  Alerta,
  Compra,
  EvaluacionCompra,
  Pendiente,
} from "../../modules/compras/compras.types.js";

type EvaluableFields = Pick<
  Compra,
  | "estadoLogistico"
  | "fechaReserva"
  | "fechaEmisionFactura"
  | "fechaEntrega"
  | "fechaEnvioContabilidad"
  | "numeroCotizacion"
  | "ordenCompra"
  | "propietarioId"
  | "precioTotalOriginal"
  | "facturaSerie"
>;

/**
 * Detecta contradicciones y datos faltantes de una compra.
 *
 * PROVISIONAL: las reglas salen del Excel de ejemplo y de lo hablado hasta ahora;
 * se ajustan cuando el área de logística confirme las suyas. Las fechas son
 * "AAAA-MM-DD", por lo que se comparan como texto.
 *
 * @param otrasComprasDelVehiculo - Cuántas compras más tiene el mismo vehículo.
 */
export function evaluarCompra(
  compra: EvaluableFields,
  otrasComprasDelVehiculo: number,
): EvaluacionCompra {
  const alertas: Alerta[] = [];
  const pendientes: Pendiente[] = [];

  const antes = (a: string | null, b: string | null) =>
    a !== null && b !== null && a < b;

  if (antes(compra.fechaEnvioContabilidad, compra.fechaEmisionFactura)) {
    alertas.push({
      codigo: "CONTABILIDAD_ANTES_DE_FACTURA",
      mensaje:
        "La fecha de envío a contabilidad es anterior a la fecha de emisión de la factura",
      campos: ["fechaEnvioContabilidad", "fechaEmisionFactura"],
    });
  }

  if (antes(compra.fechaEntrega, compra.fechaReserva)) {
    alertas.push({
      codigo: "ENTREGA_ANTES_DE_RESERVA",
      mensaje: "La fecha de entrega es anterior a la fecha de reserva",
      campos: ["fechaEntrega", "fechaReserva"],
    });
  }

  if (antes(compra.fechaEmisionFactura, compra.fechaReserva)) {
    alertas.push({
      codigo: "FACTURA_ANTES_DE_RESERVA",
      mensaje:
        "La fecha de emisión de la factura es anterior a la fecha de reserva",
      campos: ["fechaEmisionFactura", "fechaReserva"],
    });
  }

  if (compra.estadoLogistico === "ENTREGADO" && compra.fechaEntrega === null) {
    alertas.push({
      codigo: "ENTREGADO_SIN_FECHA_ENTREGA",
      mensaje: "El estado es ENTREGADO pero no hay fecha de entrega",
      campos: ["estadoLogistico", "fechaEntrega"],
    });
  }

  if (compra.estadoLogistico !== "ENTREGADO" && compra.fechaEntrega !== null) {
    alertas.push({
      codigo: "FECHA_ENTREGA_SIN_ESTADO_ENTREGADO",
      mensaje: "Hay fecha de entrega pero el estado no es ENTREGADO",
      campos: ["estadoLogistico", "fechaEntrega"],
    });
  }

  if (otrasComprasDelVehiculo > 0) {
    alertas.push({
      codigo: "VEHICULO_CON_OTRAS_COMPRAS",
      mensaje: `Este vehículo tiene ${otrasComprasDelVehiculo} compra(s) más registrada(s)`,
      campos: ["vehiculoId"],
    });
  }

  const falta = (campo: string, mensaje: string) =>
    pendientes.push({ campo, mensaje });

  if (compra.numeroCotizacion === null)
    falta("numeroCotizacion", "Falta el número de cotización");
  if (compra.ordenCompra === null)
    falta("ordenCompra", "Falta la orden de compra");
  if (compra.propietarioId === null)
    falta("propietarioId", "Falta el propietario");
  if (compra.fechaReserva === null)
    falta("fechaReserva", "Falta la fecha de reserva");
  if (compra.precioTotalOriginal === null)
    falta("precioTotalOriginal", "Falta el precio");
  if (compra.facturaSerie === null) falta("factura", "Falta la factura");

  if (compra.facturaSerie !== null && compra.fechaEnvioContabilidad === null) {
    falta(
      "fechaEnvioContabilidad",
      "Falta enviar la documentación a contabilidad",
    );
  }

  return { alertas, pendientes };
}
