import ExcelJS from "exceljs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import db from "../../src/db/knex";
import type { TestData } from "../setup/db.js";
import { app, bearer, binaryParser, prepareTest } from "../setup/helpers.js";

let data: TestData;
let adminToken: string;
let userToken: string;

beforeEach(async () => {
  ({ data, adminToken, userToken } = await prepareTest());
});

describe("GET /api/proveedores", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/proveedores")).status).toBe(401);
  });

  it("lista paginado y ordenado por razón social", async () => {
    const res = await request(app)
      .get("/api/proveedores")
      .set(bearer(userToken));

    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(res.body.data[0].razonSocial).toBe("AUTOMOTRIZ INCAMOTORS S.A.C.");
  });

  it("busca por RUC o razón social y filtra por estado", async () => {
    const byName = await request(app)
      .get("/api/proveedores?search=incamotors")
      .set(bearer(userToken));
    const byRuc = await request(app)
      .get("/api/proveedores?search=2010007")
      .set(bearer(userToken));
    const inactive = await request(app)
      .get("/api/proveedores?activo=false")
      .set(bearer(userToken));

    expect(byName.body.data.map((p: { ruc: string }) => p.ruc)).toEqual([
      "20455307954",
    ]);
    expect(byRuc.body.data.map((p: { ruc: string }) => p.ruc)).toEqual([
      "20100070970",
    ]);
    expect(inactive.body.results).toBe(1);
  });

  it("trata los comodines de LIKE como texto literal", async () => {
    const res = await request(app)
      .get("/api/proveedores?search=%25")
      .set(bearer(userToken));

    expect(res.body.results).toBe(0);
  });

  it("pagina los resultados", async () => {
    const res = await request(app)
      .get("/api/proveedores?limit=1&page=2")
      .set(bearer(userToken));

    expect(res.body.results).toBe(1);
    expect(res.body.pagination).toMatchObject({
      page: 2,
      total: 2,
      totalPages: 2,
    });
  });

  it("rechaza parámetros inválidos", async () => {
    expect(
      (
        await request(app)
          .get("/api/proveedores?limit=500")
          .set(bearer(userToken))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/api/proveedores?activo=quizas")
          .set(bearer(userToken))
      ).status,
    ).toBe(400);
  });
});

describe("GET /api/proveedores/:id", () => {
  it("devuelve el proveedor, 404 si no existe y 400 si el id no es válido", async () => {
    const ok = await request(app)
      .get(`/api/proveedores/${data.proveedores.incamotorsId}`)
      .set(bearer(userToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data.ruc).toBe("20455307954");

    expect(
      (await request(app).get("/api/proveedores/9999").set(bearer(userToken)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/proveedores/abc").set(bearer(userToken)))
        .status,
    ).toBe(400);
  });
});

describe("POST /api/proveedores", () => {
  // RUC válido distinto de los sembrados.
  const valid = {
    ruc: "20512345876",
    razonSocial: "  comercial   andina s.a.c. ",
  };

  it("crea el proveedor normalizando la razón social y deja rastro en auditoría", async () => {
    const res = await request(app)
      .post("/api/proveedores")
      .set(bearer(userToken))
      .send(valid);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ruc: valid.ruc,
      razonSocial: "COMERCIAL ANDINA S.A.C.",
      activo: true,
    });

    const audit = await db("auditoria")
      .where({ entidad: "proveedor", accion: "CREATE" })
      .first();
    expect(audit.usuario_id).toBe(data.users.userId);
    expect(audit.entidad_id).toBe(res.body.data.id);
  });

  it("rechaza un RUC repetido con 409", async () => {
    const res = await request(app)
      .post("/api/proveedores")
      .set(bearer(userToken))
      .send({ ruc: "20455307954", razonSocial: "OTRA EMPRESA" });

    expect(res.status).toBe(409);
  });

  it("rechaza un RUC con dígito verificador incorrecto", async () => {
    const res = await request(app)
      .post("/api/proveedores")
      .set(bearer(userToken))
      .send({ ruc: "20455307955", razonSocial: "EMPRESA FALSA" });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("ruc");
  });

  it("exige RUC y razón social", async () => {
    const res = await request(app)
      .post("/api/proveedores")
      .set(bearer(userToken))
      .send({});

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["ruc", "razonSocial"]));
  });

  it("de dos peticiones simultáneas con el mismo RUC, solo una se guarda", async () => {
    const results = await Promise.all([
      request(app).post("/api/proveedores").set(bearer(userToken)).send(valid),
      request(app).post("/api/proveedores").set(bearer(userToken)).send(valid),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe("PATCH /api/proveedores/:id", () => {
  it("edita la razón social y registra solo lo que cambió", async () => {
    const id = data.proveedores.incamotorsId;
    const res = await request(app)
      .patch(`/api/proveedores/${id}`)
      .set(bearer(userToken))
      .send({ razonSocial: "incamotors del peru s.a.c." });

    expect(res.status).toBe(200);
    expect(res.body.data.razonSocial).toBe("INCAMOTORS DEL PERU S.A.C.");

    const audit = await db("auditoria")
      .where({ entidad: "proveedor", accion: "UPDATE" })
      .first();
    const cambios =
      typeof audit.cambios === "string"
        ? JSON.parse(audit.cambios)
        : audit.cambios;
    expect(Object.keys(cambios)).toEqual(["razonSocial"]);
  });

  it("no permite usar el RUC de otro proveedor", async () => {
    const res = await request(app)
      .patch(`/api/proveedores/${data.proveedores.incamotorsId}`)
      .set(bearer(userToken))
      .send({ ruc: "20100070970" });

    expect(res.status).toBe(409);
  });

  it("permite reenviar el mismo RUC sin conflicto", async () => {
    const res = await request(app)
      .patch(`/api/proveedores/${data.proveedores.incamotorsId}`)
      .set(bearer(userToken))
      .send({
        ruc: "20455307954",
        razonSocial: "AUTOMOTRIZ INCAMOTORS S.A.C.",
      });

    expect(res.status).toBe(200);
  });

  it("responde 404 si no existe y 400 si no se envía ningún campo", async () => {
    expect(
      (
        await request(app)
          .patch("/api/proveedores/9999")
          .set(bearer(userToken))
          .send({ razonSocial: "X Y" })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/proveedores/${data.proveedores.incamotorsId}`)
          .set(bearer(userToken))
          .send({})
      ).status,
    ).toBe(400);
  });
});

describe("PATCH /api/proveedores/:id/status", () => {
  it("solo el admin puede activar o desactivar", async () => {
    const id = data.proveedores.incamotorsId;

    const asUser = await request(app)
      .patch(`/api/proveedores/${id}/status`)
      .set(bearer(userToken))
      .send({ activo: false });
    expect(asUser.status).toBe(403);

    const asAdmin = await request(app)
      .patch(`/api/proveedores/${id}/status`)
      .set(bearer(adminToken))
      .send({ activo: false });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.activo).toBe(false);
  });

  it("no genera auditoría si el estado ya era ese", async () => {
    await request(app)
      .patch(`/api/proveedores/${data.proveedores.incamotorsId}/status`)
      .set(bearer(adminToken))
      .send({ activo: true });

    expect(
      await db("auditoria")
        .where({ entidad: "proveedor" })
        .count({ total: "*" })
        .first(),
    ).toMatchObject({
      total: 0,
    });
  });

  it("exige un booleano", async () => {
    const res = await request(app)
      .patch(`/api/proveedores/${data.proveedores.incamotorsId}/status`)
      .set(bearer(adminToken))
      .send({ activo: "si" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/proveedores/export", () => {
  it("descarga un Excel con los proveedores filtrados y lo registra en auditoría", async () => {
    const res = await request(app)
      .get("/api/proveedores/export?activo=true")
      .set(bearer(userToken))
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(res.headers["content-disposition"]).toMatch(
      /attachment; filename="proveedores-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet("Proveedores")!;

    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      "RUC",
      "Razón social",
      "Estado",
      "Registrado",
    ]);
    expect(sheet.getRow(2).getCell(1).value).toBe("20455307954");
    expect(sheet.getRow(2).getCell(3).value).toBe("ACTIVO");

    expect(
      await db("auditoria")
        .where({ accion: "EXPORT", entidad: "proveedor" })
        .first(),
    ).toBeTruthy();
  });

  it("no se confunde con el id y exige sesión", async () => {
    expect((await request(app).get("/api/proveedores/export")).status).toBe(
      401,
    );
  });
});
