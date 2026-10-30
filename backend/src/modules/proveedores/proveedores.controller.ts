import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { XLSX_MIME, todayInLima } from "../../shared/utils/excel.js";
import { parseId } from "../../shared/utils/parseId.js";
import { requireAuth } from "../../shared/utils/requireAuth.js";
import { proveedoresService } from "./proveedores.service.js";
import type {
  ExportProveedoresQuery,
  ListProveedoresQuery,
} from "./proveedores.schema.js";

/** Lista paginada con búsqueda por RUC o razón social. La query llega validada. */
export const listProveedores = asyncHandler(async (req, res) => {
  const { items, pagination } = await proveedoresService.list(
    req.query as unknown as ListProveedoresQuery,
  );

  res.status(200).json({
    status: "success",
    results: items.length,
    pagination,
    data: items,
  });
});

/** Exporta a Excel todos los proveedores que cumplen los filtros. */
export const exportProveedores = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const buffer = await proveedoresService.exportToExcel(
    req.query as unknown as ExportProveedoresQuery,
    auth.id,
  );

  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="proveedores-${todayInLima()}.xlsx"`,
  );
  res.status(200).send(buffer);
});

export const getProveedorById = asyncHandler(async (req, res) => {
  const proveedor = await proveedoresService.getById(
    parseId(req.params.id, "del proveedor"),
  );

  res.status(200).json({ status: "success", data: proveedor });
});

export const createProveedor = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const proveedor = await proveedoresService.create(req.body, auth.id);

  res.status(201).json({
    status: "success",
    message: "Proveedor creado correctamente",
    data: proveedor,
  });
});

export const updateProveedor = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const proveedor = await proveedoresService.update(
    parseId(req.params.id, "del proveedor"),
    req.body,
    auth.id,
  );

  res.status(200).json({
    status: "success",
    message: "Proveedor actualizado correctamente",
    data: proveedor,
  });
});

/** Activa o desactiva un proveedor (solo admin). */
export const setProveedorStatus = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const proveedor = await proveedoresService.setStatus(
    parseId(req.params.id, "del proveedor"),
    req.body,
    auth.id,
  );

  res.status(200).json({
    status: "success",
    message: proveedor.activo ? "Proveedor activado" : "Proveedor desactivado",
    data: proveedor,
  });
});
