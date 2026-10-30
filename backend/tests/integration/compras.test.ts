import ExcelJS from "exceljs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import db from "../../src/db/knex.js";
import type { TestData } from "../setup/db.js";
import { app, bearer, binaryParser, prepareTest } from "../setup/helpers.js";

let data: TestData;
let adminToken: string;
let userToken: string;

beforeEach(async () => {
  ({ data, adminToken, userToken } = await prepareTest());
});

const post = (body: object, token = userToken) =>
  request(app).post("/api/compras").set(bearer(token)).send(body);
const patch = (id: number, body: object, token = userToken) =>
  request(app).patch(`/api/compras/${id}`).set(bearer(token)).send(body);
const get = (path: string, token = userToken) =>
  request(app).get(path).set(bearer(token));

/** Primera fila del Excel de ejemplo. */
const excelFila1 = () => ({
  proveedorId: data.proveedores.incamotorsId,
  vehiculoId: data.vehiculos.vehiculo1Id,
  propietarioId: data.propietarios.conDniId,
  numeroCotizacion: "cot-243878",
  ordenCompra: "2026-00006",
  notaVenta: "35",
  fechaReserva: "2026-06-09",
  monedaPrecio: "USD",
  precioTotalOriginal: 12050,
  tipoCambio: 3.53,
  facturaSerie: "f017",
  facturaCorrelativo: "147",
  fechaEmisionFactura: "2026-06-12",
  estadoLogistico: "ENTREGADO",
  destino: "chincha",
  fechaEntrega: "2026-06-13",
  fechaEnvioContabilidad: "2026-06-20",
});

/** Segunda fila: contiene la inconsistencia real (contabilidad antes de la factura). */
const excelFila2 = () => ({
  proveedorId: data.proveedores.incamotorsId,
  vehiculoId: data.vehiculos.vehiculo2Id,
  propietarioId: data.propietarios.sinDocumentoId,
  numeroCotizacion: "COT-247470",
  ordenCompra: "2026-000020",
  notaVenta: "36",
  fechaReserva: "2026-06-26",
  precioTotalOriginal: 12050,
  tipoCambio: 3.46,
  facturaSerie: "F018",
  facturaCorrelativo: "0001308",
  fechaEmisionFactura: "2026-06-26",
  estadoLogistico: "ENTREGADO",
  destino: "CHINCHA",
  fechaEntrega: "2026-06-26",
  fechaEnvioContabilidad: "2026-06-19",
});

const minima = () => ({
  proveedorId: data.proveedores.incamotorsId,
  vehiculoId: data.vehiculos.vehiculo1Id,
});

const codigos = (alertas: { codigo: string }[]) => alertas.map((a) => a.codigo);

describe("permisos y catálogos", () => {
  it("exige sesión en todas las rutas", async () => {
    expect((await request(app).get("/api/compras")).status).toBe(401);
    expect((await request(app).get("/api/compras/export")).status).toBe(401);
    expect(
      (await request(app).post("/api/compras").send(minima())).status,
    ).toBe(401);
  });

  it("GET /catalogos devuelve los estados y monedas válidos", async () => {
    const res = await get("/api/compras/catalogos");

    expect(res.status).toBe(200);
    expect(res.body.data.estadosLogisticos).toEqual([
      "PENDIENTE",
      "EN_PROCESO",
      "ENTREGADO",
    ]);
    expect(res.body.data.monedas).toEqual(["USD", "PEN"]);
  });
});

describe("POST /api/compras", () => {
  it("con solo proveedor y vehículo crea la compra PENDIENTE en USD, con sus pendientes", async () => {
    const res = await post(minima());

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      estadoLogistico: "PENDIENTE",
      monedaPrecio: "USD",
      propietarioId: null,
      ordenCompra: null,
      precioTotalOriginal: null,
      proveedorRazonSocial: "AUTOMOTRIZ INCAMOTORS S.A.C.",
      vehiculoVin: "MALB251AAVM748526",
      creadoPor: data.users.userId,
    });
    expect(res.body.data.alertas).toEqual([]);
    expect(
      res.body.data.pendientes.map((p: { campo: string }) => p.campo),
    ).toEqual([
      "numeroCotizacion",
      "ordenCompra",
      "propietarioId",
      "fechaReserva",
      "precioTotalOriginal",
      "factura",
    ]);
  });

  it("registra la fila 1 del Excel normalizando textos, factura y precios como números", async () => {
    const res = await post(excelFila1());

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      numeroCotizacion: "COT-243878",
      ordenCompra: "2026-00006",
      notaVenta: "35",
      fechaReserva: "2026-06-09",
      precioTotalOriginal: 12050,
      tipoCambio: 3.53,
      facturaSerie: "F017",
      facturaCorrelativo: "00000147",
      destino: "CHINCHA",
      estadoLogistico: "ENTREGADO",
      propietarioNombre: "SANCHEZ MARCAQUISPE ALDO ALONSO",
      propietarioNumeroDocumento: "70000001",
      vehiculoPlaca: "Y2N-557",
    });
    expect(res.body.data.alertas).toEqual([]);
    expect(res.body.data.pendientes).toEqual([]);
  });

  it("la fila 2 del Excel se guarda y sale marcada con su inconsistencia real", async () => {
    const res = await post(excelFila2());

    expect(res.status).toBe(201);
    expect(res.body.data.facturaCorrelativo).toBe("00001308");
    expect(codigos(res.body.data.alertas)).toEqual([
      "CONTABILIDAD_ANTES_DE_FACTURA",
    ]);
  });

  it("deja rastro en auditoría con los datos registrados", async () => {
    const res = await post(excelFila1());

    const audit = await db("auditoria")
      .where({ entidad: "compra", accion: "CREATE" })
      .first();
    expect(audit.usuario_id).toBe(data.users.userId);
    expect(audit.entidad_id).toBe(res.body.data.id);

    const cambios =
      typeof audit.cambios === "string"
        ? JSON.parse(audit.cambios)
        : audit.cambios;
    expect(cambios.ordenCompra).toBe("2026-00006");
  });

  it("exige proveedor y vehículo", async () => {
    const res = await post({});

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["proveedorId", "vehiculoId"]),
    );
  });

  it("rechaza referencias inexistentes indicando el campo", async () => {
    const res = await post({
      proveedorId: 9999,
      vehiculoId: 9999,
      propietarioId: 9999,
    });

    expect(res.status).toBe(400);
    expect(
      res.body.details.map((d: { field: string }) => d.field).sort(),
    ).toEqual(["propietarioId", "proveedorId", "vehiculoId"]);
  });

  it("rechaza un proveedor inactivo", async () => {
    const res = await post({
      ...minima(),
      proveedorId: data.proveedores.distribuidoraId,
    });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({
      field: "proveedorId",
      message: "El proveedor está inactivo",
    });
  });

  it("rechaza datos mal formados con el detalle por campo", async () => {
    const res = await post({
      ...minima(),
      fechaReserva: "2026-02-30",
      tipoCambio: -3,
      precioTotalOriginal: 100.123,
      estadoLogistico: "ARCHIVADO",
      monedaPrecio: "EUR",
      facturaSerie: "F01",
    });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "fechaReserva",
        "tipoCambio",
        "precioTotalOriginal",
        "estadoLogistico",
        "monedaPrecio",
        "facturaSerie",
      ]),
    );
  });

  it("exige serie y correlativo de la factura juntos", async () => {
    const soloSerie = await post({ ...minima(), facturaSerie: "F017" });
    const soloNumero = await post({ ...minima(), facturaCorrelativo: "147" });

    expect(soloSerie.status).toBe(400);
    expect(soloSerie.body.details[0].field).toBe("facturaCorrelativo");
    expect(soloNumero.status).toBe(400);
    expect(soloNumero.body.details[0].field).toBe("facturaSerie");
  });

  it("trata los textos vacíos como sin valor", async () => {
    const res = await post({
      ...minima(),
      ordenCompra: "",
      fechaReserva: "",
      precioTotalOriginal: "",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ordenCompra: null,
      fechaReserva: null,
      precioTotalOriginal: null,
    });
  });

  it("rechaza una orden de compra repetida del mismo proveedor, pero la acepta en otro", async () => {
    await post(excelFila1());

    const repetida = await post({ ...excelFila2(), ordenCompra: "2026-00006" });
    expect(repetida.status).toBe(409);
    expect(repetida.body.details).toEqual([
      {
        field: "ordenCompra",
        message: "Este proveedor ya tiene registrada esa orden de compra",
      },
    ]);

    const [otroProveedor] = await db("proveedores").insert({
      ruc: "20512345876",
      razon_social: "COMERCIAL ANDINA S.A.C.",
    });
    const otro = await post({
      ...excelFila2(),
      proveedorId: Number(otroProveedor),
      ordenCompra: "2026-00006",
    });
    expect(otro.status).toBe(201);
  });

  it("rechaza una factura repetida aunque se escriba con otros ceros", async () => {
    await post(excelFila1());

    const res = await post({
      ...excelFila2(),
      facturaSerie: "f017",
      facturaCorrelativo: "0000147",
    });

    expect(res.status).toBe(409);
    expect(res.body.details[0].field).toBe("factura");
  });

  it("permite que un vehículo tenga más de una compra, avisándolo con una alerta", async () => {
    const primera = await post(minima());
    const segunda = await post(minima());

    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(codigos(segunda.body.data.alertas)).toEqual([
      "VEHICULO_CON_OTRAS_COMPRAS",
    ]);

    const releida = await get(`/api/compras/${primera.body.data.id}`);
    expect(codigos(releida.body.data.alertas)).toEqual([
      "VEHICULO_CON_OTRAS_COMPRAS",
    ]);
  });

  it("de dos peticiones simultáneas con la misma orden de compra, solo una se guarda", async () => {
    const body = { ...minima(), ordenCompra: "2026-00099" };
    const results = await Promise.all([post(body), post(body)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.details[0].field).toBe(
      "ordenCompra",
    );
  });
});

describe("GET /api/compras", () => {
  beforeEach(async () => {
    await post(excelFila1());
    await post(excelFila2());
    await post({ ...minima(), fechaReserva: "2026-07-15" });
  });

  it("lista las más recientes primero, con los datos unidos de proveedor y vehículo", async () => {
    const res = await get("/api/compras");

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
    expect(
      res.body.data.map((c: { fechaReserva: string }) => c.fechaReserva),
    ).toEqual(["2026-07-15", "2026-06-26", "2026-06-09"]);
    expect(res.body.data[0]).toMatchObject({
      vehiculoVin: "MALB251AAVM748526",
      proveedorRuc: "20455307954",
    });
  });

  it("busca por factura (serie, número o ambos), VIN, placa, propietario y cotización", async () => {
    const ids = async (q: string) =>
      (await get(`/api/compras?search=${encodeURIComponent(q)}`)).body.data.map(
        (c: { ordenCompra: string | null }) => c.ordenCompra,
      );

    expect(await ids("F017-00000147")).toEqual(["2026-00006"]);
    expect(await ids("F018")).toEqual(["2026-000020"]);
    expect(await ids("1308")).toEqual(["2026-000020"]);
    expect(await ids("739919")).toEqual(["2026-000020"]);
    expect(await ids("y2n-557")).toEqual([null, "2026-00006"]);
    expect(await ids("astorayme")).toEqual(["2026-000020"]);
    expect(await ids("247470")).toEqual(["2026-000020"]);
  });

  it("filtra por estado, proveedor, vehículo, propietario y rango de fechas de reserva", async () => {
    const count = async (q: string) =>
      (await get(`/api/compras?${q}`)).body.results;

    expect(await count("estadoLogistico=ENTREGADO")).toBe(2);
    expect(await count("estadoLogistico=PENDIENTE")).toBe(1);
    expect(await count(`proveedorId=${data.proveedores.incamotorsId}`)).toBe(3);
    expect(await count(`vehiculoId=${data.vehiculos.vehiculo2Id}`)).toBe(1);
    expect(await count(`propietarioId=${data.propietarios.conDniId}`)).toBe(1);
    expect(await count("desde=2026-06-10&hasta=2026-06-30")).toBe(1);
    expect(await count("desde=2026-06-26")).toBe(2);
  });

  it("pagina los resultados", async () => {
    const res = await get("/api/compras?limit=2&page=2");

    expect(res.body.results).toBe(1);
    expect(res.body.pagination).toMatchObject({
      page: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("rechaza filtros inválidos", async () => {
    expect((await get("/api/compras?estadoLogistico=ARCHIVADO")).status).toBe(
      400,
    );
    expect((await get("/api/compras?desde=ayer")).status).toBe(400);
    expect(
      (await get("/api/compras?desde=2026-07-01&hasta=2026-06-01")).status,
    ).toBe(400);
    expect((await get("/api/compras?limit=500")).status).toBe(400);
  });

  it("trata los comodines de LIKE como texto literal", async () => {
    expect((await get("/api/compras?search=%25")).body.results).toBe(0);
  });
});

describe("GET /api/compras/:id", () => {
  it("devuelve la compra, 404 si no existe y 400 si el id no es válido", async () => {
    const creada = await post(excelFila1());

    const ok = await get(`/api/compras/${creada.body.data.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.ordenCompra).toBe("2026-00006");

    expect((await get("/api/compras/9999")).status).toBe(404);
    expect((await get("/api/compras/abc")).status).toBe(400);
  });
});

describe("PATCH /api/compras/:id", () => {
  it("cambia el estado y la alerta aparece o desaparece según los datos", async () => {
    const { id } = (await post(minima())).body.data;

    const entregado = await patch(id, { estadoLogistico: "ENTREGADO" });
    expect(entregado.status).toBe(200);
    expect(codigos(entregado.body.data.alertas)).toContain(
      "ENTREGADO_SIN_FECHA_ENTREGA",
    );

    const conFecha = await patch(id, { fechaEntrega: "2026-10-01" });
    expect(codigos(conFecha.body.data.alertas)).not.toContain(
      "ENTREGADO_SIN_FECHA_ENTREGA",
    );
  });

  it("completa los datos por etapas sin tocar lo ya registrado", async () => {
    const { id } = (await post(minima())).body.data;

    await patch(id, { numeroCotizacion: "cot-1", fechaReserva: "2026-06-09" });
    const res = await patch(id, {
      ordenCompra: "2026-00010",
      propietarioId: data.propietarios.conDniId,
    });

    expect(res.body.data).toMatchObject({
      numeroCotizacion: "COT-1",
      fechaReserva: "2026-06-09",
      ordenCompra: "2026-00010",
      propietarioNombre: "SANCHEZ MARCAQUISPE ALDO ALONSO",
    });
  });

  it("audita solo los campos que cambiaron y guarda quién editó", async () => {
    const { id } = (await post(excelFila1())).body.data;
    await patch(id, { destino: "Lima", notaVenta: "35" }, adminToken);

    const audit = await db("auditoria")
      .where({ entidad: "compra", accion: "UPDATE" })
      .first();
    const cambios =
      typeof audit.cambios === "string"
        ? JSON.parse(audit.cambios)
        : audit.cambios;
    expect(Object.keys(cambios)).toEqual(["destino"]);
    expect(cambios.destino).toEqual({ antes: "CHINCHA", despues: "LIMA" });
    expect(audit.usuario_id).toBe(data.users.adminId);

    expect((await get(`/api/compras/${id}`)).body.data.actualizadoPor).toBe(
      data.users.adminId,
    );
  });

  it("borra un dato opcional enviando null, y la factura enviando ambos campos en null", async () => {
    const { id } = (await post(excelFila1())).body.data;

    const res = await patch(id, {
      propietarioId: null,
      facturaSerie: null,
      facturaCorrelativo: null,
      notaVenta: "",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      propietarioId: null,
      propietarioNombre: null,
      facturaSerie: null,
      facturaCorrelativo: null,
      notaVenta: null,
    });
  });

  it("no permite quedarse con solo la serie o solo el correlativo", async () => {
    const { id } = (await post(excelFila1())).body.data;

    expect((await patch(id, { facturaCorrelativo: "200" })).status).toBe(400);
    expect((await patch(id, { facturaSerie: null })).status).toBe(400);
  });

  it("no permite usar la orden de compra o la factura de otra compra", async () => {
    await post(excelFila1());
    const { id } = (await post(excelFila2())).body.data;

    const orden = await patch(id, { ordenCompra: "2026-00006" });
    expect(orden.status).toBe(409);
    expect(orden.body.details[0].field).toBe("ordenCompra");

    const factura = await patch(id, {
      facturaSerie: "F017",
      facturaCorrelativo: "147",
    });
    expect(factura.status).toBe(409);
    expect(factura.body.details[0].field).toBe("factura");
  });

  it("permite reenviar sus propios valores únicos sin conflicto", async () => {
    const { id } = (await post(excelFila1())).body.data;

    const res = await patch(id, {
      ordenCompra: "2026-00006",
      facturaSerie: "F017",
      facturaCorrelativo: "147",
      destino: "ICA",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.destino).toBe("ICA");
  });

  it("cambiar de proveedor revalida la orden de compra en el proveedor nuevo", async () => {
    const [otroId] = await db("proveedores").insert({
      ruc: "20512345876",
      razon_social: "COMERCIAL ANDINA S.A.C.",
    });
    await post({
      ...minima(),
      proveedorId: Number(otroId),
      vehiculoId: data.vehiculos.vehiculo2Id,
      ordenCompra: "2026-00006",
    });
    const { id } = (await post(excelFila1())).body.data;

    const res = await patch(id, { proveedorId: Number(otroId) });

    expect(res.status).toBe(409);
    expect(res.body.details[0].field).toBe("ordenCompra");
  });

  it("no permite cambiar a un proveedor inactivo, pero sí editar una compra cuyo proveedor se desactivó", async () => {
    const { id } = (await post(excelFila1())).body.data;

    const aInactivo = await patch(id, {
      proveedorId: data.proveedores.distribuidoraId,
    });
    expect(aInactivo.status).toBe(400);

    await db("proveedores")
      .where({ id: data.proveedores.incamotorsId })
      .update({ activo: false });
    const sigueEditable = await patch(id, { destino: "ICA" });
    expect(sigueEditable.status).toBe(200);
  });

  it("responde 404 si no existe y 400 si no se envía ningún campo", async () => {
    const { id } = (await post(minima())).body.data;

    expect((await patch(9999, { destino: "ICA" })).status).toBe(404);
    expect((await patch(id, {})).status).toBe(400);
  });
});

describe("DELETE /api/compras/:id", () => {
  it("solo el admin puede eliminar, y queda una copia de los datos en auditoría", async () => {
    const { id } = (await post(excelFila1())).body.data;

    expect(
      (await request(app).delete(`/api/compras/${id}`).set(bearer(userToken)))
        .status,
    ).toBe(403);
    expect((await get(`/api/compras/${id}`)).status).toBe(200);

    const res = await request(app)
      .delete(`/api/compras/${id}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect((await get(`/api/compras/${id}`)).status).toBe(404);

    const audit = await db("auditoria")
      .where({ entidad: "compra", accion: "DELETE" })
      .first();
    const cambios =
      typeof audit.cambios === "string"
        ? JSON.parse(audit.cambios)
        : audit.cambios;
    expect(cambios.ordenCompra).toBe("2026-00006");
  });

  it("responde 404 si no existe", async () => {
    expect(
      (await request(app).delete("/api/compras/9999").set(bearer(adminToken)))
        .status,
    ).toBe(404);
  });
});

describe("GET /api/compras/export", () => {
  it("descarga un Excel con las compras filtradas y lo registra en auditoría", async () => {
    await post(excelFila1());
    await post(excelFila2());

    const res = await request(app)
      .get("/api/compras/export?search=F017")
      .set(bearer(userToken))
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /compras-\d{4}-\d{2}-\d{2}\.xlsx/,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet("Compras")!;

    expect(sheet.rowCount).toBe(2);
    const row = sheet.getRow(2);
    expect(row.getCell(3).value).toBe("MALB251AAVM748526");
    expect(row.getCell(13).value).toBe("2026-00006");
    expect(row.getCell(17).value).toBe(12050);
    expect(row.getCell(19).value).toBe("F017-00000147");

    expect(
      await db("auditoria")
        .where({ accion: "EXPORT", entidad: "compra" })
        .first(),
    ).toBeTruthy();
  });

  it("no se confunde con el id", async () => {
    expect((await get("/api/compras/export")).status).toBe(200);
  });
});
