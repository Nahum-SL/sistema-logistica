import { Router } from "express";
// MIDDLEWARES
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
// PROVEEDORES - SCHEMA
import {
  createProveedorSchema,
  exportProveedoresQuerySchema,
  listProveedoresQuerySchema,
  setProveedorStatusSchema,
  updateProveedorSchema,
} from "./proveedores.schema.js";
// PROVEEDORES - CONTROLLER
import {
  createProveedor,
  exportProveedores,
  getProveedorById,
  listProveedores,
  setProveedorStatus,
  updateProveedor,
} from "./proveedores.controller.js";

const proveedoresRoutes = Router();

// Admin y usuario pueden consultar, crear y editar; solo admin activa/desactiva.
proveedoresRoutes.use(authenticate);

proveedoresRoutes.get(
  "/",
  validate(listProveedoresQuerySchema, "query"),
  listProveedores,
);
// Antes de "/:id" para que "export" no se interprete como un id.
proveedoresRoutes.get(
  "/export",
  validate(exportProveedoresQuerySchema, "query"),
  exportProveedores,
);
proveedoresRoutes.get("/:id", getProveedorById);
proveedoresRoutes.post("/", validate(createProveedorSchema), createProveedor);
proveedoresRoutes.patch(
  "/:id",
  validate(updateProveedorSchema),
  updateProveedor,
);
proveedoresRoutes.patch(
  "/:id/status",
  authorize("admin"),
  validate(setProveedorStatusSchema),
  setProveedorStatus,
);

export default proveedoresRoutes;
