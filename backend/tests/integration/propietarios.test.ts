import ExcelJS from "exceljs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import db from "../../src/db/knex.js";
import type { TestData } from "../setup/db.js";
import { app, bearer, binaryParser, prepareTest } from "../setup/helpers.js";

let data: TestData;
let userToken: string;

beforeEach(async () => {
  ({ data, userToken } = await prepareTest());
});

const post = (body: object) =>
  request(app).post("/api/propietarios").set(bearer(userToken)).send(body);

describe("GET /api/propietarios", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/propietarios")).status).toBe(401);
  });

  it("lista paginado y ordenado por nombre", async () => {
    const res = await request(app)
      .get("/api/propietarios")
      .set(bearer(userToken));

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.data[0].nombreCompleto).toBe("ASTORAYME ECHEGARAY MARISOL");
    expect(res.body.data[0]).toMatchObject({
      tipoDocumento: null,
      numeroDocumento: null,
    });
  });

  it("busca por nombre o por número de documento", async () => {
    const byName = await request(app)
      .get("/api/propietarios?search=sanchez")
      .set(bearer(userToken));
    const byDoc = await request(app)
      .get("/api/propietarios?search=7000000")
      .set(bearer(userToken));

    expect(byName.body.data.map((p: { id: number }) => p.id)).toEqual([
      data.propietarios.conDniId,
    ]);
    expect(byDoc.body.data.map((p: { id: number }) => p.id)).toEqual([
      data.propietarios.conDniId,
    ]);
  });

  it("filtra por tipo de documento y rechaza uno inexistente", async () => {
    const ruc = await request(app)
      .get("/api/propietarios?tipoDocumento=RUC")
      .set(bearer(userToken));
    expect(ruc.body.data.map((p: { id: number }) => p.id)).toEqual([
      data.propietarios.conRucId,
    ]);

    expect(
      (
        await request(app)
          .get("/api/propietarios?tipoDocumento=LIC")
          .set(bearer(userToken))
      ).status,
    ).toBe(400);
  });
});

describe("GET /api/propietarios/:id", () => {
  it("devuelve el propietario, 404 si no existe y 400 si el id no es válido", async () => {
    const ok = await request(app)
      .get(`/api/propietarios/${data.propietarios.conDniId}`)
      .set(bearer(userToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      tipoDocumento: "DNI",
      numeroDocumento: "70000001",
    });

    expect(
      (await request(app).get("/api/propietarios/9999").set(bearer(userToken)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/propietarios/abc").set(bearer(userToken)))
        .status,
    ).toBe(400);
  });
});

describe("POST /api/propietarios", () => {
  it("crea con DNI normalizando el nombre y deja rastro en auditoría", async () => {
    const res = await post({
      nombreCompleto: "  rojas   quispe maria ",
      tipoDocumento: "DNI",
      numeroDocumento: "45678912",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      nombreCompleto: "ROJAS QUISPE MARIA",
      tipoDocumento: "DNI",
      numeroDocumento: "45678912",
    });

    const audit = await db("auditoria")
      .where({ entidad: "propietario", accion: "CREATE" })
      .first();
    expect(audit.usuario_id).toBe(data.users.userId);
  });

  it("acepta RUC válido", async () => {
    const res = await post({
      nombreCompleto: "Comercial Andina SAC",
      tipoDocumento: "RUC",
      numeroDocumento: "20512345876",
    });

    expect(res.status).toBe(201);
  });

  it("acepta propietarios sin documento, incluso varios (NULL no choca con NULL)", async () => {
    const first = await post({ nombreCompleto: "Cliente Uno" });
    const second = await post({
      nombreCompleto: "Cliente Dos",
      tipoDocumento: "",
      numeroDocumento: "",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data).toMatchObject({
      tipoDocumento: null,
      numeroDocumento: null,
    });
  });

  it("valida el formato según el tipo de documento", async () => {
    const badDni = await post({
      nombreCompleto: "Ana Perez",
      tipoDocumento: "DNI",
      numeroDocumento: "1234",
    });
    const badRuc = await post({
      nombreCompleto: "Ana Perez",
      tipoDocumento: "RUC",
      numeroDocumento: "20455307955",
    });

    expect(badDni.status).toBe(400);
    expect(badDni.body.details[0]).toMatchObject({ field: "numeroDocumento" });
    expect(badRuc.status).toBe(400);
  });

  it("exige tipo y número juntos", async () => {
    const onlyType = await post({
      nombreCompleto: "Ana Perez",
      tipoDocumento: "DNI",
    });
    const onlyNumber = await post({
      nombreCompleto: "Ana Perez",
      numeroDocumento: "45678912",
    });

    expect(onlyType.status).toBe(400);
    expect(onlyNumber.status).toBe(400);
  });

  it("rechaza un documento repetido con 409", async () => {
    const res = await post({
      nombreCompleto: "Otra Persona",
      tipoDocumento: "DNI",
      numeroDocumento: "70000001",
    });

    expect(res.status).toBe(409);
  });

  it("de dos peticiones simultáneas con el mismo documento, solo una se guarda", async () => {
    const body = {
      nombreCompleto: "Carrera Test",
      tipoDocumento: "DNI",
      numeroDocumento: "11112222",
    };
    const results = await Promise.all([post(body), post(body)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("exige el nombre", async () => {
    const res = await post({});

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain(
      "nombreCompleto",
    );
  });
});

describe("PATCH /api/propietarios/:id", () => {
  const patch = (id: number, body: object) =>
    request(app)
      .patch(`/api/propietarios/${id}`)
      .set(bearer(userToken))
      .send(body);

  it("agrega el documento a un propietario que no tenía", async () => {
    const res = await patch(data.propietarios.sinDocumentoId, {
      tipoDocumento: "DNI",
      numeroDocumento: "45678912",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      tipoDocumento: "DNI",
      numeroDocumento: "45678912",
    });
  });

  it("quita el documento enviando ambos campos en null", async () => {
    const res = await patch(data.propietarios.conDniId, {
      tipoDocumento: null,
      numeroDocumento: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      tipoDocumento: null,
      numeroDocumento: null,
    });
  });

  it("cambiar solo el nombre no toca el documento y se audita únicamente ese campo", async () => {
    const res = await patch(data.propietarios.conDniId, {
      nombreCompleto: "sanchez aldo",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      nombreCompleto: "SANCHEZ ALDO",
      tipoDocumento: "DNI",
      numeroDocumento: "70000001",
    });

    const audit = await db("auditoria")
      .where({ entidad: "propietario", accion: "UPDATE" })
      .first();
    const cambios =
      typeof audit.cambios === "string"
        ? JSON.parse(audit.cambios)
        : audit.cambios;
    expect(Object.keys(cambios)).toEqual(["nombreCompleto"]);
  });

  it("no permite enviar solo uno de los dos campos del documento", async () => {
    expect(
      (await patch(data.propietarios.conDniId, { tipoDocumento: "RUC" }))
        .status,
    ).toBe(400);
    expect(
      (await patch(data.propietarios.conDniId, { numeroDocumento: "12345678" }))
        .status,
    ).toBe(400);
  });

  it("no permite usar el documento de otro propietario", async () => {
    const res = await patch(data.propietarios.sinDocumentoId, {
      tipoDocumento: "DNI",
      numeroDocumento: "70000001",
    });

    expect(res.status).toBe(409);
  });

  it("permite reenviar el mismo documento sin conflicto", async () => {
    const res = await patch(data.propietarios.conDniId, {
      tipoDocumento: "DNI",
      numeroDocumento: "70000001",
    });

    expect(res.status).toBe(200);
  });

  it("responde 404 si no existe y 400 si no se envía ningún campo", async () => {
    expect((await patch(9999, { nombreCompleto: "Nadie Existe" })).status).toBe(
      404,
    );
    expect((await patch(data.propietarios.conDniId, {})).status).toBe(400);
  });
});

describe("GET /api/propietarios/export", () => {
  it("descarga un Excel con los propietarios filtrados y lo registra en auditoría", async () => {
    const res = await request(app)
      .get("/api/propietarios/export?tipoDocumento=DNI")
      .set(bearer(userToken))
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /propietarios-\d{4}-\d{2}-\d{2}\.xlsx/,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet("Propietarios")!;

    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(2).getCell(1).value).toBe("DNI");
    expect(sheet.getRow(2).getCell(2).value).toBe("70000001");

    expect(
      await db("auditoria")
        .where({ accion: "EXPORT", entidad: "propietario" })
        .first(),
    ).toBeTruthy();
  });

  it("deja vacías las celdas de quien no tiene documento", async () => {
    const res = await request(app)
      .get("/api/propietarios/export?search=astorayme")
      .set(bearer(userToken))
      .buffer(true)
      .parse(binaryParser);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const row = workbook.getWorksheet("Propietarios")!.getRow(2);

    expect(row.getCell(1).value ?? "").toBe("");
    expect(row.getCell(3).value).toBe("ASTORAYME ECHEGARAY MARISOL");
  });
});
