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
  request(app).post("/api/vehiculos").set(bearer(userToken)).send(body);
const patch = (id: number, body: object) =>
  request(app).patch(`/api/vehiculos/${id}`).set(bearer(userToken)).send(body);

const valid = {
  vin: "malb251aavm111111",
  marca: "hyundai",
  modelo: "grand i10 sedan",
  color: "rojo",
  anioModelo: 2027,
  numeroMotor: "g3latm000001",
  tipoCombustible: "gasolina",
  placa: "abc123",
};

describe("GET /api/vehiculos", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/vehiculos")).status).toBe(401);
  });

  it("lista paginado, del más reciente al más antiguo", async () => {
    const res = await request(app).get("/api/vehiculos").set(bearer(userToken));

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.data[0].vin).toBe("MALB251AAVM739919");
  });

  it("busca por VIN, motor o placa", async () => {
    const byVin = await request(app)
      .get("/api/vehiculos?search=748526")
      .set(bearer(userToken));
    const byMotor = await request(app)
      .get("/api/vehiculos?search=G3LATM6149")
      .set(bearer(userToken));
    const byPlaca = await request(app)
      .get("/api/vehiculos?search=y2n")
      .set(bearer(userToken));

    expect(byVin.body.data.map((v: { id: number }) => v.id)).toEqual([
      data.vehiculos.vehiculo1Id,
    ]);
    expect(byMotor.body.data.map((v: { id: number }) => v.id)).toEqual([
      data.vehiculos.vehiculo2Id,
    ]);
    expect(byPlaca.body.data.map((v: { id: number }) => v.id)).toEqual([
      data.vehiculos.vehiculo1Id,
    ]);
  });

  it("filtra por marca y año modelo", async () => {
    const all = await request(app)
      .get("/api/vehiculos?marca=HYUNDAI&anioModelo=2027")
      .set(bearer(userToken));
    const none = await request(app)
      .get("/api/vehiculos?marca=KIA")
      .set(bearer(userToken));

    expect(all.body.results).toBe(2);
    expect(none.body.results).toBe(0);
  });

  it("trata los comodines de LIKE como texto literal", async () => {
    const res = await request(app)
      .get("/api/vehiculos?search=%25")
      .set(bearer(userToken));

    expect(res.body.results).toBe(0);
  });
});

describe("GET /api/vehiculos/options", () => {
  it("devuelve las marcas y modelos ya registrados, sin confundirse con un id", async () => {
    await post(valid);
    const res = await request(app)
      .get("/api/vehiculos/options")
      .set(bearer(userToken));

    expect(res.status).toBe(200);
    expect(res.body.data.marcas).toEqual(["HYUNDAI"]);
    expect(res.body.data.modelos).toEqual([
      { marca: "HYUNDAI", modelo: "GRAND I10 HB COMFORT" },
      { marca: "HYUNDAI", modelo: "GRAND I10 SEDAN" },
    ]);
  });
});

describe("GET /api/vehiculos/:id", () => {
  it("devuelve el vehículo, 404 si no existe y 400 si el id no es válido", async () => {
    const ok = await request(app)
      .get(`/api/vehiculos/${data.vehiculos.vehiculo1Id}`)
      .set(bearer(userToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      vin: "MALB251AAVM748526",
      anioModelo: 2027,
      placa: "Y2N-557",
    });

    expect(
      (await request(app).get("/api/vehiculos/9999").set(bearer(userToken)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/vehiculos/abc").set(bearer(userToken)))
        .status,
    ).toBe(400);
  });
});

describe("POST /api/vehiculos", () => {
  it("crea el vehículo normalizando a mayúsculas y la placa a AAA-123, y lo audita", async () => {
    const res = await post(valid);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      vin: "MALB251AAVM111111",
      marca: "HYUNDAI",
      modelo: "GRAND I10 SEDAN",
      color: "ROJO",
      anioModelo: 2027,
      numeroMotor: "G3LATM000001",
      placa: "ABC-123",
    });

    const audit = await db("auditoria")
      .where({ entidad: "vehiculo", accion: "CREATE" })
      .first();
    expect(audit.usuario_id).toBe(data.users.userId);
  });

  it("solo exige VIN, marca y modelo; el resto queda en null", async () => {
    const res = await post({ vin: "SERIE-0001", marca: "Kia", modelo: "Rio" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      color: null,
      anioModelo: null,
      numeroMotor: null,
      tipoCombustible: null,
      placa: null,
    });
  });

  it("permite varios vehículos sin placa ni motor (NULL no choca con NULL)", async () => {
    expect(
      (await post({ vin: "SERIE-0001", marca: "KIA", modelo: "RIO" })).status,
    ).toBe(201);
    expect(
      (
        await post({
          vin: "SERIE-0002",
          marca: "KIA",
          modelo: "RIO",
          placa: "",
          numeroMotor: "",
        })
      ).status,
    ).toBe(201);
  });

  it("rechaza un VIN repetido con 409 indicando el campo", async () => {
    const res = await post({ ...valid, vin: "malb251aavm748526" });

    expect(res.status).toBe(409);
    expect(res.body.details).toEqual([
      { field: "vin", message: "Ya existe un vehículo con este VIN / serie" },
    ]);
  });

  it("indica todos los campos en conflicto a la vez", async () => {
    const res = await post({
      ...valid,
      numeroMotor: "G3LATM635556",
      placa: "y2n557",
    });

    expect(res.status).toBe(409);
    expect(
      res.body.details.map((d: { field: string }) => d.field).sort(),
    ).toEqual(["numeroMotor", "placa"]);
  });

  it("rechaza datos inválidos con el detalle por campo", async () => {
    const res = await post({
      vin: "AB",
      marca: "",
      modelo: "X",
      placa: "12",
      anioModelo: 1980,
    });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(["vin", "marca", "placa", "anioModelo"]),
    );
  });

  it("rechaza un año modelo demasiado adelantado", async () => {
    const res = await post({ ...valid, anioModelo: 2099 });

    expect(res.status).toBe(400);
  });

  it("de dos peticiones simultáneas con el mismo VIN, solo una se guarda", async () => {
    const results = await Promise.all([post(valid), post(valid)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe("PATCH /api/vehiculos/:id", () => {
  it("asigna la placa a un vehículo que no la tenía y audita solo ese campo", async () => {
    const res = await patch(data.vehiculos.vehiculo2Id, { placa: "y2n-524" });

    expect(res.status).toBe(200);
    expect(res.body.data.placa).toBe("Y2N-524");

    const audit = await db("auditoria")
      .where({ entidad: "vehiculo", accion: "UPDATE" })
      .first();
    const cambios =
      typeof audit.cambios === "string"
        ? JSON.parse(audit.cambios)
        : audit.cambios;
    expect(Object.keys(cambios)).toEqual(["placa"]);
  });

  it("borra un dato opcional enviando null o texto vacío", async () => {
    const res = await patch(data.vehiculos.vehiculo1Id, {
      placa: null,
      color: "",
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      placa: null,
      color: null,
      marca: "HYUNDAI",
    });
  });

  it("no permite usar la placa, el motor ni el VIN de otro vehículo", async () => {
    const placa = await patch(data.vehiculos.vehiculo2Id, { placa: "Y2N-557" });
    const motor = await patch(data.vehiculos.vehiculo2Id, {
      numeroMotor: "G3LATM635556",
    });
    const vin = await patch(data.vehiculos.vehiculo2Id, {
      vin: "MALB251AAVM748526",
    });

    expect(placa.status).toBe(409);
    expect(placa.body.details[0].field).toBe("placa");
    expect(motor.status).toBe(409);
    expect(motor.body.details[0].field).toBe("numeroMotor");
    expect(vin.status).toBe(409);
    expect(vin.body.details[0].field).toBe("vin");
  });

  it("permite reenviar sus propios valores únicos sin conflicto", async () => {
    const res = await patch(data.vehiculos.vehiculo1Id, {
      vin: "MALB251AAVM748526",
      numeroMotor: "G3LATM635556",
      placa: "Y2N-557",
      color: "NEGRO",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.color).toBe("NEGRO");
  });

  it("responde 404 si no existe y 400 si no se envía ningún campo", async () => {
    expect((await patch(9999, { color: "AZUL" })).status).toBe(404);
    expect((await patch(data.vehiculos.vehiculo1Id, {})).status).toBe(400);
  });
});

describe("GET /api/vehiculos/export", () => {
  it("descarga un Excel con los vehículos filtrados y lo registra en auditoría", async () => {
    const res = await request(app)
      .get("/api/vehiculos/export?search=748526")
      .set(bearer(userToken))
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /vehiculos-\d{4}-\d{2}-\d{2}\.xlsx/,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet("Vehículos")!;

    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(2).getCell(1).value).toBe("MALB251AAVM748526");
    expect(sheet.getRow(2).getCell(8).value).toBe("Y2N-557");

    expect(
      await db("auditoria")
        .where({ accion: "EXPORT", entidad: "vehiculo" })
        .first(),
    ).toBeTruthy();
  });

  it("exige sesión", async () => {
    expect((await request(app).get("/api/vehiculos/export")).status).toBe(401);
  });
});
