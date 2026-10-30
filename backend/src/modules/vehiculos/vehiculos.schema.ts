import { z } from "zod";

// El año modelo puede ir adelantado (un 2027 se vende en 2026).
const MAX_ANIO_MODELO = new Date().getFullYear() + 2;

/** "" se trata como "sin valor" (null) para que un formulario vacío no falle. */
const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const upper = (max: number, label: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .max(max, `${label} no puede superar los ${max} caracteres`)
    .transform((value) => value.replace(/\s+/g, " "));

const vinSchema = z
  .string()
  .trim()
  .toUpperCase()
  // Un VIN estándar tiene 17 caracteres; se aceptan otros números de serie alfanuméricos.
  .regex(
    /^[A-Z0-9-]{5,30}$/,
    "El VIN / serie debe tener entre 5 y 30 caracteres (letras, números y guion)",
  );

const marcaSchema = upper(50, "La marca").pipe(
  z.string().min(1, "La marca es obligatoria"),
);
const modeloSchema = upper(80, "El modelo").pipe(
  z.string().min(1, "El modelo es obligatorio"),
);

const colorSchema = z.preprocess(emptyToNull, upper(30, "El color").nullish());
const combustibleSchema = z.preprocess(
  emptyToNull,
  upper(40, "El tipo de combustible").nullish(),
);

const anioSchema = z.preprocess(
  emptyToNull,
  z
    .number({ error: "El año modelo debe ser un número" })
    .int("El año modelo debe ser un entero")
    .min(1990, "El año modelo no es válido")
    .max(MAX_ANIO_MODELO, `El año modelo no puede superar ${MAX_ANIO_MODELO}`)
    .nullish(),
);

const motorSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9-]{3,50}$/,
      "El número de motor debe tener entre 3 y 50 caracteres (letras, números y guion)",
    )
    .nullish(),
);

// Se guarda como AAA-123: se tolera con o sin guion y en minúsculas.
const placaSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) =>
      value
        .replace(/\s+/g, "")
        .replace(/^([A-Z0-9]{3})-?([A-Z0-9]{3})$/, "$1-$2"),
    )
    .pipe(
      z
        .string()
        .regex(
          /^[A-Z0-9]{3}-[A-Z0-9]{3}$/,
          "La placa debe tener el formato AAA-123",
        ),
    )
    .nullish(),
);

export const createVehiculoSchema = z.object({
  vin: vinSchema,
  marca: marcaSchema,
  modelo: modeloSchema,
  color: colorSchema,
  anioModelo: anioSchema,
  numeroMotor: motorSchema,
  tipoCombustible: combustibleSchema,
  placa: placaSchema,
});

export const updateVehiculoSchema = z
  .object({
    vin: vinSchema.optional(),
    marca: marcaSchema.optional(),
    modelo: modeloSchema.optional(),
    color: colorSchema,
    anioModelo: anioSchema,
    numeroMotor: motorSchema,
    tipoCombustible: combustibleSchema,
    placa: placaSchema,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debes enviar al menos un campo para actualizar",
    path: ["body"],
  });

const filtersShape = {
  search: z.string().trim().max(100).optional(),
  marca: z.string().trim().max(50).optional(),
  anioModelo: z.coerce.number().int().optional(),
};

export const listVehiculosQuerySchema = z.object({
  ...filtersShape,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportVehiculosQuerySchema = z.object(filtersShape);

export type CreateVehiculoInput = z.infer<typeof createVehiculoSchema>;
export type UpdateVehiculoInput = z.infer<typeof updateVehiculoSchema>;
export type ListVehiculosQuery = z.infer<typeof listVehiculosQuerySchema>;
export type ExportVehiculosQuery = z.infer<typeof exportVehiculosQuerySchema>;
