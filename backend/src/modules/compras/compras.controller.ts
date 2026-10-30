import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { XLSX_MIME, todayInLima } from "../../shared/utils/excel.js";
import { parseId } from "../../shared/utils/parseId.js";
import { requireAuth } from "../../shared/utils/requireAuth.js";
import { comprasService } from "./compras.service.js";
import type { ExportComprasQuery, ListComprasQuery } from "./compras.schema.js";

export const listCompras = asyncHandler(async (req, res) => {
  const { items, pagination } = await comprasService.list(
    req.query as unknown as ListComprasQuery,
  );

  res.status(200).json({
    status: "success",
    results: items.length,
    pagination,
    data: items,
  });
});

/** Estados y monedas válidos, para los selectores del formulario. */
export const getCatalogos = asyncHandler(async (_req, res) => {
  res.status(200).json({ status: "success", data: comprasService.catalogos() });
});

export const exportCompras = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const buffer = await comprasService.exportToExcel(
    req.query as unknown as ExportComprasQuery,
    auth.id,
  );

  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="compras-${todayInLima()}.xlsx"`,
  );
  res.status(200).send(buffer);
});

export const getCompraById = asyncHandler(async (req, res) => {
  const compra = await comprasService.getById(
    parseId(req.params.id, "de la compra"),
  );

  res.status(200).json({ status: "success", data: compra });
});

export const createCompra = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const compra = await comprasService.create(req.body, auth.id);

  res.status(201).json({
    status: "success",
    message: "Compra registrada correctamente",
    data: compra,
  });
});

export const updateCompra = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const compra = await comprasService.update(
    parseId(req.params.id, "de la compra"),
    req.body,
    auth.id,
  );

  res.status(200).json({
    status: "success",
    message: "Compra actualizada correctamente",
    data: compra,
  });
});

/** Elimina una compra (solo admin). */
export const deleteCompra = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  await comprasService.remove(parseId(req.params.id, "de la compra"), auth.id);

  res
    .status(200)
    .json({ status: "success", message: "Compra eliminada correctamente" });
});
