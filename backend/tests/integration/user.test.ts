import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { USER, type TestData } from "../setup/db.js";
import { app, bearer, prepareTest } from "../setup/helpers.js";

let data: TestData;
let adminToken: string;
let userToken: string;

beforeEach(async () => {
  ({ data, adminToken, userToken } = await prepareTest());
});

describe("permisos de /api/users", () => {
  it("exige sesión y rol admin", async () => {
    expect((await request(app).get("/api/users")).status).toBe(401);
    expect(
      (await request(app).get("/api/users").set(bearer(userToken))).status,
    ).toBe(403);
  });
});

describe("GET /api/users", () => {
  it("lista las cuentas sin contraseñas", async () => {
    const res = await request(app).get("/api/users").set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("password");
  });

  it("responde 404 si el usuario no existe y 400 si el id no es válido", async () => {
    expect(
      (await request(app).get("/api/users/9999").set(bearer(adminToken)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/users/abc").set(bearer(adminToken))).status,
    ).toBe(400);
  });
});

describe("POST /api/users", () => {
  const valid = {
    username: "Practicante.1",
    nombre: "Ana Practicante",
    password: "clave-segura-123",
    rol: "usuario",
  };

  it("crea la cuenta normalizando el usuario a minúsculas", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(bearer(adminToken))
      .send(valid);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      username: "practicante.1",
      rol: "usuario",
      activo: true,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "practicante.1", password: valid.password });
    expect(login.status).toBe(200);
  });

  it("rechaza un usuario repetido con 409", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(bearer(adminToken))
      .send({ ...valid, username: USER.username });

    expect(res.status).toBe(409);
  });

  it("rechaza datos inválidos con el detalle por campo", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(bearer(adminToken))
      .send({ ...valid, password: "corta", rol: "superadmin" });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toContain("password");
    expect(fields).toContain("rol");
  });
});

describe("PATCH /api/users/:id", () => {
  it("desactivar una cuenta cierra sus sesiones e impide el login", async () => {
    const res = await request(app)
      .patch(`/api/users/${data.users.userId}`)
      .set(bearer(adminToken))
      .send({ activo: false });

    expect(res.status).toBe(200);
    expect(res.body.data.activo).toBe(false);

    expect(
      (await request(app).get("/api/auth/me").set(bearer(userToken))).status,
    ).toBe(401);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: USER.password });
    expect(login.status).toBe(401);
  });

  it("no permite que un admin se desactive ni se quite el rol a sí mismo", async () => {
    const deactivate = await request(app)
      .patch(`/api/users/${data.users.adminId}`)
      .set(bearer(adminToken))
      .send({ activo: false });
    const demote = await request(app)
      .patch(`/api/users/${data.users.adminId}`)
      .set(bearer(adminToken))
      .send({ rol: "usuario" });

    expect(deactivate.status).toBe(409);
    expect(demote.status).toBe(409);
  });

  it("exige al menos un campo", async () => {
    const res = await request(app)
      .patch(`/api/users/${data.users.userId}`)
      .set(bearer(adminToken))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/users/:id/password", () => {
  it("restablece la contraseña y cierra las sesiones de esa cuenta", async () => {
    const res = await request(app)
      .patch(`/api/users/${data.users.userId}/password`)
      .set(bearer(adminToken))
      .send({ password: "restablecida-456" });

    expect(res.status).toBe(200);
    expect(
      (await request(app).get("/api/auth/me").set(bearer(userToken))).status,
    ).toBe(401);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: "restablecida-456" });
    expect(login.status).toBe(200);
  });
});
