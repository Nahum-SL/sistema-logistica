import { Router } from "express";
// MIDDLEWARES
import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
// SCHEMA - USERS
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "./users.schema.js";
// USERS - CONTROLLER
import {
  createUser,
  getUserById,
  listUsers,
  resetUserPassword,
  updateUser,
} from "./users.controller.js";

const userRoutes = Router();

// Solo administradores gestionan cuentas.
userRoutes.use(authenticate, authorize("admin"));

userRoutes.get("/", listUsers);
userRoutes.get("/:id", getUserById);
userRoutes.post("/", validate(createUserSchema), createUser);
userRoutes.patch("/:id", validate(updateUserSchema), updateUser);
userRoutes.patch(
  "/:id/password",
  validate(resetPasswordSchema),
  resetUserPassword,
);

export default userRoutes;
