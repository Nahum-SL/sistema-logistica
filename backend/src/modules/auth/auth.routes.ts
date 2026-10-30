import { Router } from "express";

import { authenticate } from "../../shared/middlewares/auth.middleware.js";
import { loginLimiter } from "../../shared/middlewares/loginLimiter.middleware.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { changePasswordSchema, loginSchema } from "./auth.schema.js";
import { changePassword, getCurrentUser, login } from "./auth.controller.js";

const authRoutes = Router();

authRoutes.post("/login", loginLimiter, validate(loginSchema), login);
authRoutes.get("/me", authenticate, getCurrentUser);
authRoutes.post(
  "/change-password",
  authenticate,
  loginLimiter,
  validate(changePasswordSchema),
  changePassword,
);

export default authRoutes;
