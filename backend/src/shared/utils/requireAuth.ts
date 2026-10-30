import type { Request } from "express";
import { UnauthorizedError } from "../errors/AppError.js";
import type { AuthenticatedIdentity } from "../../modules/auth/auth.types.js";

/** Devuelve la sesión de la petición o lanza 401 si `authenticate` no corrió. */
export function requireAuth(req: Request): AuthenticatedIdentity {
  if (!req.auth) throw new UnauthorizedError("Debes autenticarte primero");

  return req.auth;
}
