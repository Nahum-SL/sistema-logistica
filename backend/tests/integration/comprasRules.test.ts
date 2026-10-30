import { describe, expect, it } from "vitest";
import { evaluarCompra } from "../../src/shared/constants/compras.rules";

const completa = {
  estadoLogistico: "ENTREGADO",
  fechaReserva: "2026-06-09",
  fechaEmisionFactura: "2026-06-12",
  fechaEntrega: "2026-06-13",
  fechaEnvioContabilidad: "2026-06-20",
  numeroCotizacion: "COT-243878",
  ordenCompra: "2026-00006",
  propietarioId: 1,
  precioTotalOriginal: 12050,
  facturaSerie: "F017",
};

const codigos = (alertas: { codigo: string }[]) => alertas.map((a) => a.codigo);

describe("evaluarCompra", () => {
  it("una compra coherente y completa no tiene alertas ni pendientes", () => {
    const { alertas, pendientes } = evaluarCompra(completa, 0);

    expect(alertas).toEqual([]);
    expect(pendientes).toEqual([]);
  });

  it("detecta el caso real del Excel: envío a contabilidad antes de la factura", () => {
    const { alertas } = evaluarCompra(
      {
        ...completa,
        fechaEmisionFactura: "2026-06-26",
        fechaReserva: "2026-06-26",
        fechaEntrega: "2026-06-26",
        fechaEnvioContabilidad: "2026-06-19",
      },
      0,
    );

    expect(codigos(alertas)).toEqual(["CONTABILIDAD_ANTES_DE_FACTURA"]);
    expect(alertas[0]!.campos).toEqual([
      "fechaEnvioContabilidad",
      "fechaEmisionFactura",
    ]);
  });

  it("la misma fecha en ambos campos no es una contradicción", () => {
    const { alertas } = evaluarCompra(
      { ...completa, fechaEnvioContabilidad: "2026-06-12" },
      0,
    );

    expect(alertas).toEqual([]);
  });

  it("detecta entrega o factura anteriores a la reserva", () => {
    const { alertas } = evaluarCompra(
      {
        ...completa,
        fechaReserva: "2026-07-01",
        fechaEnvioContabilidad: "2026-07-30",
      },
      0,
    );

    expect(codigos(alertas)).toEqual([
      "ENTREGA_ANTES_DE_RESERVA",
      "FACTURA_ANTES_DE_RESERVA",
    ]);
  });

  it("detecta ENTREGADO sin fecha de entrega y fecha de entrega sin ENTREGADO", () => {
    const sinFecha = evaluarCompra({ ...completa, fechaEntrega: null }, 0);
    const sinEstado = evaluarCompra(
      { ...completa, estadoLogistico: "EN_PROCESO" },
      0,
    );

    expect(codigos(sinFecha.alertas)).toEqual(["ENTREGADO_SIN_FECHA_ENTREGA"]);
    expect(codigos(sinEstado.alertas)).toEqual([
      "FECHA_ENTREGA_SIN_ESTADO_ENTREGADO",
    ]);
  });

  it("avisa cuando el vehículo tiene otras compras", () => {
    const { alertas } = evaluarCompra(completa, 2);

    expect(codigos(alertas)).toEqual(["VEHICULO_CON_OTRAS_COMPRAS"]);
    expect(alertas[0]!.mensaje).toContain("2");
  });

  it("una compra recién creada tiene todos sus datos pendientes", () => {
    const { alertas, pendientes } = evaluarCompra(
      {
        estadoLogistico: "PENDIENTE",
        fechaReserva: null,
        fechaEmisionFactura: null,
        fechaEntrega: null,
        fechaEnvioContabilidad: null,
        numeroCotizacion: null,
        ordenCompra: null,
        propietarioId: null,
        precioTotalOriginal: null,
        facturaSerie: null,
      },
      0,
    );

    expect(alertas).toEqual([]);
    expect(pendientes.map((p) => p.campo)).toEqual([
      "numeroCotizacion",
      "ordenCompra",
      "propietarioId",
      "fechaReserva",
      "precioTotalOriginal",
      "factura",
    ]);
  });

  it("con factura pero sin envío a contabilidad, queda pendiente el envío", () => {
    const { pendientes } = evaluarCompra(
      { ...completa, fechaEnvioContabilidad: null },
      0,
    );

    expect(pendientes.map((p) => p.campo)).toEqual(["fechaEnvioContabilidad"]);
  });
});
