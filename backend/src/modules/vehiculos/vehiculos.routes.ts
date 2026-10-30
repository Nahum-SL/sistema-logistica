import { Router } from "express";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  createVehiculoSchema,
  exportVehiculosQuerySchema,
  listVehiculosQuerySchema,
  updateVehiculoSchema,
} from "./vehiculos.schema.js";
import {
  createVehiculo,
  exportVehiculos,
  getVehiculoById,
  getVehiculoOptions,
  listVehiculos,
  updateVehiculo,
} from "./vehiculos.controller.js";

const vehiculosRoutes = Router();

// Admin y usuario pueden consultar, crear, editar y exportar.
vehiculosRoutes.use(authenticate);

vehiculosRoutes.get(
  "/",
  validate(listVehiculosQuerySchema, "query"),
  listVehiculos,
);
// Antes de "/:id" para que "options" y "export" no se interpreten como un id.
vehiculosRoutes.get("/options", getVehiculoOptions);
vehiculosRoutes.get(
  "/export",
  validate(exportVehiculosQuerySchema, "query"),
  exportVehiculos,
);
vehiculosRoutes.get("/:id", getVehiculoById);
vehiculosRoutes.post("/", validate(createVehiculoSchema), createVehiculo);
vehiculosRoutes.patch("/:id", validate(updateVehiculoSchema), updateVehiculo);

export default vehiculosRoutes;
