import { z } from "zod";
import { ESTADOS_LOGISTICOS, MONEDAS } from "../../shared/constants/compras.constants.js";

/** "" se trata como "sin valor" (null) para que un formulario vacío no falle. */
const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalUpper = (max: number, label: string) =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .toUpperCase()
      .max(max, `${label} no puede superar los ${max} caracteres`)
      .transform((value) => value.replace(/\s+/g, " "))
      .nullish(),
  );

const dateField = z.preprocess(
  emptyToNull,
  z.iso
    .date({ error: "La fecha debe tener el formato AAAA-MM-DD" })
    .refine(
      (value) => value >= "2000-01-01" && value <= "2100-12-31",
      "La fecha no es válida",
    )
    .nullish(),
);

const decimalPlaces = (value: number, places: number) =>
  Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 1e-6;

const precioField = z.preprocess(
  emptyToNull,
  z
    .number({ error: "El precio debe ser un número" })
    .positive("El precio debe ser mayor a 0")
    .max(9_999_999_999.99, "El precio es demasiado grande")
    .refine(
      (value) => decimalPlaces(value, 2),
      "El precio admite como máximo 2 decimales",
    )
    .nullish(),
);

const tipoCambioField = z.preprocess(
  emptyToNull,
  z
    .number({ error: "El tipo de cambio debe ser un número" })
    .positive("El tipo de cambio debe ser mayor a 0")
    .max(100, "El tipo de cambio no es válido")
    .refine(
      (value) => decimalPlaces(value, 4),
      "El tipo de cambio admite como máximo 4 decimales",
    )
    .nullish(),
);

const idField = (label: string) =>
  z
    .number({ error: `${label} es obligatorio y debe ser un número` })
    .int(`${label} no es válido`)
    .positive(`${label} no es válido`);

const propietarioIdField = z.preprocess(
  emptyToNull,
  z
    .number({ error: "El propietario debe ser un número" })
    .int("El propietario no es válido")
    .positive("El propietario no es válido")
    .nullish(),
);

const serieField = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4}$/, "La serie debe tener 4 caracteres (p. ej. F017)")
    .nullish(),
);

// Se guarda con 8 dígitos (0000147 → 00000147) para que la unicidad no dependa de los ceros.
const correlativoField = z.preprocess(
  (value) => emptyToNull(typeof value === "number" ? String(value) : value),
  z
    .string()
    .trim()
    .regex(/^\d{1,8}$/, "El correlativo debe tener hasta 8 dígitos")
    .transform((value) => value.padStart(8, "0"))
    .nullish(),
);

const estadoField = z.enum(ESTADOS_LOGISTICOS, {
  error: `El estado debe ser uno de: ${ESTADOS_LOGISTICOS.join(", ")}`,
});
const monedaField = z.enum(MONEDAS, {
  error: `La moneda debe ser: ${MONEDAS.join(" o ")}`,
});

/** Serie y correlativo van juntos: ambos con valor, o ambos null para quitar la factura. */
function validateFactura(
  data: { facturaSerie?: string | null; facturaCorrelativo?: string | null },
  ctx: z.RefinementCtx,
  isUpdate: boolean,
): void {
  const serie = data.facturaSerie;
  const correlativo = data.facturaCorrelativo;

  if (isUpdate) {
    if (serie === undefined && correlativo === undefined) return;

    // Al editar, ambos campos viajan juntos: si no, la compra podría quedar con la mitad de la factura.
    if (serie === undefined || correlativo === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [serie === undefined ? "facturaSerie" : "facturaCorrelativo"],
        message: "Envía la serie y el correlativo de la factura juntos",
      });
      return;
    }
  }

  const hasSerie = serie !== undefined && serie !== null;
  const hasCorrelativo = correlativo !== undefined && correlativo !== null;

  if (hasSerie !== hasCorrelativo) {
    ctx.addIssue({
      code: "custom",
      path: [hasSerie ? "facturaCorrelativo" : "facturaSerie"],
      message:
        "Indica la serie y el correlativo de la factura, o ninguno de los dos",
    });
  }
}

const textFields = {
  numeroCotizacion: optionalUpper(50, "La cotización"),
  ordenCompra: optionalUpper(50, "La orden de compra"),
  notaVenta: optionalUpper(50, "La nota de venta"),
  destino: optionalUpper(50, "El destino"),
  observaciones: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(2000, "Las observaciones no pueden superar los 2000 caracteres")
      .nullish(),
  ),
};

const dateFields = {
  fechaReserva: dateField,
  fechaEmisionFactura: dateField,
  fechaEntrega: dateField,
  fechaEnvioContabilidad: dateField,
};

export const createCompraSchema = z
  .object({
    proveedorId: idField("El proveedor"),
    vehiculoId: idField("El vehículo"),
    propietarioId: propietarioIdField,
    ...textFields,
    ...dateFields,
    monedaPrecio: monedaField.default("USD"),
    precioTotalOriginal: precioField,
    tipoCambio: tipoCambioField,
    facturaSerie: serieField,
    facturaCorrelativo: correlativoField,
    estadoLogistico: estadoField.default("PENDIENTE"),
  })
  .superRefine((data, ctx) => validateFactura(data, ctx, false));

export const updateCompraSchema = z
  .object({
    proveedorId: idField("El proveedor").optional(),
    vehiculoId: idField("El vehículo").optional(),
    propietarioId: propietarioIdField,
    ...textFields,
    ...dateFields,
    monedaPrecio: monedaField.optional(),
    precioTotalOriginal: precioField,
    tipoCambio: tipoCambioField,
    facturaSerie: serieField,
    facturaCorrelativo: correlativoField,
    estadoLogistico: estadoField.optional(),
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

    validateFactura(data, ctx, true);
  });

const isoDate = z.iso.date({
  error: "La fecha debe tener el formato AAAA-MM-DD",
});

const filtersShape = {
  search: z.string().trim().max(100).optional(),
  proveedorId: z.coerce.number().int().positive().optional(),
  vehiculoId: z.coerce.number().int().positive().optional(),
  propietarioId: z.coerce.number().int().positive().optional(),
  estadoLogistico: estadoField.optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
};

const validRange = (data: { desde?: string; hasta?: string }) =>
  !data.desde || !data.hasta || data.desde <= data.hasta;
const rangeError = {
  message: "La fecha 'hasta' no puede ser anterior a 'desde'",
  path: ["hasta"],
};

export const listComprasQuerySchema = z
  .object({
    ...filtersShape,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(validRange, rangeError);

export const exportComprasQuerySchema = z
  .object(filtersShape)
  .refine(validRange, rangeError);

export type CreateCompraInput = z.infer<typeof createCompraSchema>;
export type UpdateCompraInput = z.infer<typeof updateCompraSchema>;
export type ListComprasQuery = z.infer<typeof listComprasQuerySchema>;
export type ExportComprasQuery = z.infer<typeof exportComprasQuerySchema>;
