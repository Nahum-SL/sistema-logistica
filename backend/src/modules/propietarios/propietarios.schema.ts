import { z } from "zod";
import { isValidRuc } from "../../shared/utils/ruc.js";
import { DOCUMENT_TYPES, type DocumentType } from "./propietarios.types.js";

const nombreSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(150, "El nombre no puede superar los 150 caracteres")
  // Se guarda normalizado: sin espacios repetidos y en mayúsculas, como en los Excel.
  .transform((value) => value.replace(/\s+/g, " ").toUpperCase());

/** "" se trata como "sin valor" (null) para que un formulario vacío no falle. */
const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const tipoDocumentoSchema = z.preprocess(
  emptyToNull,
  z
    .enum(DOCUMENT_TYPES, { error: "El tipo de documento no es válido" })
    .nullish(),
);

const numeroDocumentoSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().max(20, "El número de documento es demasiado largo"))
    .nullish(),
);

const DOCUMENT_RULES: Record<
  DocumentType,
  { valid: (value: string) => boolean; message: string }
> = {
  DNI: {
    valid: (v) => /^\d{8}$/.test(v),
    message: "El DNI debe tener 8 dígitos",
  },
  RUC: {
    valid: isValidRuc,
    message: "El RUC no es válido (11 dígitos, prefijo y dígito verificador)",
  },
  CE: {
    valid: (v) => /^[A-Z0-9]{9,12}$/.test(v),
    message: "El carné de extranjería debe tener entre 9 y 12 caracteres",
  },
  PAS: {
    valid: (v) => /^[A-Z0-9]{6,12}$/.test(v),
    message: "El pasaporte debe tener entre 6 y 12 caracteres",
  },
};

/**
 * Reglas del documento: tipo y número se envían juntos (ambos con valor, o ambos null
 * para quitarlo) y el número debe cumplir el formato de su tipo.
 */
function validateDocument(
  data: {
    tipoDocumento?: DocumentType | null;
    numeroDocumento?: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  const { tipoDocumento: tipo, numeroDocumento: numero } = data;

  if (tipo === undefined && numero === undefined) return;

  if (tipo === undefined || numero === undefined) {
    ctx.addIssue({
      code: "custom",
      path: [tipo === undefined ? "tipoDocumento" : "numeroDocumento"],
      message: "Envía el tipo y el número de documento juntos",
    });
    return;
  }

  if ((tipo === null) !== (numero === null)) {
    ctx.addIssue({
      code: "custom",
      path: [tipo === null ? "tipoDocumento" : "numeroDocumento"],
      message: "Indica el tipo y el número de documento, o ninguno de los dos",
    });
    return;
  }

  if (tipo !== null && numero !== null && !DOCUMENT_RULES[tipo].valid(numero)) {
    ctx.addIssue({
      code: "custom",
      path: ["numeroDocumento"],
      message: DOCUMENT_RULES[tipo].message,
    });
  }
}

export const createPropietarioSchema = z
  .object({
    nombreCompleto: nombreSchema,
    tipoDocumento: tipoDocumentoSchema,
    numeroDocumento: numeroDocumentoSchema,
  })
  .superRefine((data, ctx) => {
    // En la creación, omitir ambos campos equivale a "sin documento".
    validateDocument(
      {
        tipoDocumento: data.tipoDocumento ?? null,
        numeroDocumento: data.numeroDocumento ?? null,
      },
      ctx,
    );
  });

export const updatePropietarioSchema = z
  .object({
    nombreCompleto: nombreSchema.optional(),
    tipoDocumento: tipoDocumentoSchema,
    numeroDocumento: numeroDocumentoSchema,
  })
  .superRefine((data, ctx) => {
    if (Object.values(data).every((value) => value === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "Debes enviar al menos un campo para actualizar",
      });
      return;
    }

    validateDocument(data, ctx);
  });

const filtersShape = {
  search: z.string().trim().max(100).optional(),
  tipoDocumento: z.enum(DOCUMENT_TYPES).optional(),
};

export const listPropietariosQuerySchema = z.object({
  ...filtersShape,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportPropietariosQuerySchema = z.object(filtersShape);

export type CreatePropietarioInput = z.infer<typeof createPropietarioSchema>;
export type UpdatePropietarioInput = z.infer<typeof updatePropietarioSchema>;
export type ListPropietariosQuery = z.infer<typeof listPropietariosQuerySchema>;
export type ExportPropietariosQuery = z.infer<
  typeof exportPropietariosQuerySchema
>;
