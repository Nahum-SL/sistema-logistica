import { Router } from "express";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  createPropietarioSchema,
  exportPropietariosQuerySchema,
  listPropietariosQuerySchema,
  updatePropietarioSchema,
} from "./propietarios.schema.js";
import {
  createPropietario,
  exportPropietarios,
  getPropietarioById,
  listPropietarios,
  updatePropietario,
} from "./propietarios.controller.js";

const propietariosRoutes = Router();

// Admin y usuario pueden consultar, crear, editar y exportar.
propietariosRoutes.use(authenticate);

propietariosRoutes.get(
  "/",
  validate(listPropietariosQuerySchema, "query"),
  listPropietarios,
);
// Antes de "/:id" para que "export" no se interprete como un id.
propietariosRoutes.get(
  "/export",
  validate(exportPropietariosQuerySchema, "query"),
  exportPropietarios,
);
propietariosRoutes.get("/:id", getPropietarioById);
propietariosRoutes.post(
  "/",
  validate(createPropietarioSchema),
  createPropietario,
);
propietariosRoutes.patch(
  "/:id",
  validate(updatePropietarioSchema),
  updatePropietario,
);

export default propietariosRoutes;
