import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { XLSX_MIME, todayInLima } from "../../shared/utils/excel.js";
import { parseId } from "../../shared/utils/parseId.js";
import { requireAuth } from "../../shared/utils/requireAuth.js";
import { vehiculosService } from "./vehiculos.service.js";
import type {
  ExportVehiculosQuery,
  ListVehiculosQuery,
} from "./vehiculos.schema.js";

export const listVehiculos = asyncHandler(async (req, res) => {
  const { items, pagination } = await vehiculosService.list(
    req.query as unknown as ListVehiculosQuery,
  );

  res.status(200).json({
    status: "success",
    results: items.length,
    pagination,
    data: items,
  });
});

/** Marcas y modelos registrados, para sugerencias en el formulario. */
export const getVehiculoOptions = asyncHandler(async (_req, res) => {
  res
    .status(200)
    .json({ status: "success", data: await vehiculosService.options() });
});

export const exportVehiculos = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const buffer = await vehiculosService.exportToExcel(
    req.query as unknown as ExportVehiculosQuery,
    auth.id,
  );

  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="vehiculos-${todayInLima()}.xlsx"`,
  );
  res.status(200).send(buffer);
});

export const getVehiculoById = asyncHandler(async (req, res) => {
  const vehiculo = await vehiculosService.getById(
    parseId(req.params.id, "del vehículo"),
  );

  res.status(200).json({ status: "success", data: vehiculo });
});

export const createVehiculo = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const vehiculo = await vehiculosService.create(req.body, auth.id);

  res.status(201).json({
    status: "success",
    message: "Vehículo creado correctamente",
    data: vehiculo,
  });
});

export const updateVehiculo = asyncHandler(async (req, res) => {
  const auth = requireAuth(req);
  const vehiculo = await vehiculosService.update(
    parseId(req.params.id, "del vehículo"),
    req.body,
    auth.id,
  );

  res.status(200).json({
    status: "success",
    message: "Vehículo actualizado correctamente",
    data: vehiculo,
  });
});
