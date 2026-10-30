import { z } from "zod";
import { isValidRuc } from "../../shared/utils/ruc.js";

const rucSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "El RUC debe tener 11 dígitos")
  .refine(
    isValidRuc,
    "El RUC no es válido (revisa el prefijo y el dígito verificador)",
  );

const razonSocialSchema = z
  .string()
  .trim()
  .min(2, "La razón social debe tener al menos 2 caracteres")
  .max(150, "La razón social no puede superar los 150 caracteres")
  // Se guarda normalizada: sin espacios repetidos y en mayúsculas, como en los Excel.
  .transform((value) => value.replace(/\s+/g, " ").toUpperCase());

export const createProveedorSchema = z.object({
  ruc: rucSchema,
  razonSocial: razonSocialSchema,
});

export const updateProveedorSchema = z
  .object({
    ruc: rucSchema.optional(),
    razonSocial: razonSocialSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
    path: ["body"],
  });

export const setProveedorStatusSchema = z.object({
  activo: z.boolean({ error: "El estado es obligatorio" }),
});

const filtersShape = {
  search: z.string().trim().max(100).optional(),
  activo: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
};

export const listProveedoresQuerySchema = z.object({
  ...filtersShape,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** La exportación usa los mismos filtros, pero sin paginar. */
export const exportProveedoresQuerySchema = z.object(filtersShape);

export type CreateProveedorInput = z.infer<typeof createProveedorSchema>;
export type UpdateProveedorInput = z.infer<typeof updateProveedorSchema>;
export type SetProveedorStatusInput = z.infer<typeof setProveedorStatusSchema>;
export type ListProveedoresQuery = z.infer<typeof listProveedoresQuerySchema>;
export type ExportProveedoresQuery = z.infer<
  typeof exportProveedoresQuerySchema
>;
