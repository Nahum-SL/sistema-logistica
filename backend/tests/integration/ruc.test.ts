import { describe, expect, it } from "vitest";
import { isValidRuc } from "../../src/shared/utils/ruc.js";

describe("isValidRuc", () => {
  it("acepta RUC con dígito verificador correcto", () => {
    expect(isValidRuc("20455307954")).toBe(true);
  });

  it("acepta el caso en que el verificador sale 0 (resto 1)", () => {
    expect(isValidRuc("20100070970")).toBe(true);
  });

  it("acepta el caso en que el verificador sale 1 (resto 0)", () => {
    expect(isValidRuc("20101000011")).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    expect(isValidRuc("20455307955")).toBe(false);
  });

  it("rechaza un prefijo inexistente", () => {
    expect(isValidRuc("30455307954")).toBe(false);
  });

  it("rechaza largo distinto de 11 o caracteres no numéricos", () => {
    expect(isValidRuc("2045530795")).toBe(false);
    expect(isValidRuc("204553079544")).toBe(false);
    expect(isValidRuc("2045530795A")).toBe(false);
    expect(isValidRuc("")).toBe(false);
  });
});

