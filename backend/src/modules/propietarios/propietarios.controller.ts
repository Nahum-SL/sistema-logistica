import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { XLSX_MIME, todayInLima } from "../../shared/utils/excel.js";
import { parseId } from "../../shared/utils/parseId.js";
import { requireAuth } from "../../shared/utils/requireAuth.js";
import { propietariosService } from "./propietarios.service.js";
import type {
  ExportPropietariosQuery,
  ListPropietariosQuery,
} from "./propietarios.schema.js";

export const listPropietarios = asyncHandler(async (req, res) => {
  const { items, pagination } = await propietariosService.list(
    req.query as unknown as ListPropietariosQuery,
  );

  res.status(200).json({
    status: "success",
    results: items.length,
    pagination,
    data: items,
  });
});

export const exportPropietarios = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const buffer = await propietariosService.exportToExcel(
    req.query as unknown as ExportPropietariosQuery,
    auth.id,
  );

  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="propietarios-${todayInLima()}.xlsx"`,
  );
  res.status(200).send(buffer);
});

export const getPropietarioById = asyncHandler(async (req, res) => {
  const propietario = await propietariosService.getById(
    parseId(req.params.id, "del propietario"),
  );

  res.status(200).json({ status: "success", data: propietario });
});

export const createPropietario = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const propietario = await propietariosService.create(req.body, auth.id);

  res.status(201).json({
    status: "success",
    message: "Propietario creado correctamente",
    data: propietario,
  });
});

export const updatePropietario = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const propietario = await propietariosService.update(
    parseId(req.params.id, "del propietario"),
    req.body,
    auth.id,
  );

  res.status(200).json({
    status: "success",
    message: "Propietario actualizado correctamente",
    data: propietario,
  });
});
