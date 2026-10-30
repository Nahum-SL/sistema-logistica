import { Router } from "express";
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import {
  createCompraSchema,
  exportComprasQuerySchema,
  listComprasQuerySchema,
  updateCompraSchema,
} from "./compras.schema.js";
import {
  createCompra,
  deleteCompra,
  exportCompras,
  getCatalogos,
  getCompraById,
  listCompras,
  updateCompra,
} from "./compras.controller.js";

const comprasRoutes = Router();

// Admin y usuario pueden consultar, registrar, editar y exportar; solo admin elimina.
comprasRoutes.use(authenticate);

comprasRoutes.get("/", validate(listComprasQuerySchema, "query"), listCompras);
// Antes de "/:id" para que "catalogos" y "export" no se interpreten como un id.
comprasRoutes.get("/catalogos", getCatalogos);
comprasRoutes.get(
  "/export",
  validate(exportComprasQuerySchema, "query"),
  exportCompras,
);
comprasRoutes.get("/:id", getCompraById);
comprasRoutes.post("/", validate(createCompraSchema), createCompra);
comprasRoutes.patch("/:id", validate(updateCompraSchema), updateCompra);
comprasRoutes.delete("/:id", authorize("admin"), deleteCompra);

export default comprasRoutes;
