import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN, USER } from "../setup/db.js";
import { app, bearer, prepareTest } from "../setup/helpers.js";

let userToken: string;

beforeEach(async () => {
  ({ userToken } = await prepareTest());
});

describe("POST /api/auth/login", () => {
  it("devuelve token y datos de la cuenta, sin exponer contraseñas", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data.tokenType).toBe("Bearer");
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(res.body.data.user).toMatchObject({
      username: USER.username,
      nombre: USER.nombre,
      rol: "usuario",
    });
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("password");
  });

  it("no distingue entre usuario inexistente y contraseña incorrecta", async () => {
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ username: ADMIN.username, password: "incorrecta-123" });
    const unknownUser = await request(app)
      .post("/api/auth/login")
      .send({ username: "no-existe", password: "incorrecta-123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.message).toBe(wrongPassword.body.message);
  });

  it("rechaza un body incompleto con el detalle por campo", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin" });

    expect(res.status).toBe(400);
    expect(
      res.body.details.some((d: { field: string }) => d.field === "password"),
    ).toBe(true);
  });
});

describe("GET /api/auth/me", () => {
  it("devuelve la cuenta autenticada", async () => {
    const res = await request(app).get("/api/auth/me").set(bearer(userToken));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      username: USER.username,
      rol: "usuario",
    });
  });

  it("exige un token válido", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect(
      (await request(app).get("/api/auth/me").set(bearer("token.invalido.xyz")))
        .status,
    ).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  const newPassword = "nueva-clave-987";

  it("cambia la contraseña, invalida el token anterior y entrega uno nuevo", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(bearer(userToken))
      .send({ currentPassword: USER.password, newPassword });

    expect(res.status).toBe(200);
    const newToken = res.body.data.accessToken as string;

    expect(
      (await request(app).get("/api/auth/me").set(bearer(userToken))).status,
    ).toBe(401);
    expect(
      (await request(app).get("/api/auth/me").set(bearer(newToken))).status,
    ).toBe(200);

    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: newPassword });
    const loginOld = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: USER.password });

    expect(loginNew.status).toBe(200);
    expect(loginOld.status).toBe(401);
  });

  it("responde 400 (no 401) si la contraseña actual es incorrecta", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(bearer(userToken))
      .send({ currentPassword: "incorrecta-123", newPassword });

    expect(res.status).toBe(400);
  });

  it("rechaza una contraseña nueva igual a la actual o demasiado débil", async () => {
    const same = await request(app)
      .post("/api/auth/change-password")
      .set(bearer(userToken))
      .send({ currentPassword: USER.password, newPassword: USER.password });
    const weak = await request(app)
      .post("/api/auth/change-password")
      .set(bearer(userToken))
      .send({ currentPassword: USER.password, newPassword: "corta1" });

    expect(same.status).toBe(400);
    expect(weak.status).toBe(400);
  });
});
