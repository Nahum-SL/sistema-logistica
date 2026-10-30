import type { UserRole } from "../users/users.types.js";

/** Datos de la cuenta que recibe el frontend al iniciar sesión. */
export interface AuthenticatedUser {
  id: number;
  username: string;
  nombre: string;
  rol: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthenticatedUser;
}

/** Identidad mínima que `authenticate` deja en `req.auth`. */
export interface AuthenticatedIdentity {
  id: number;
  username: string;
  rol: UserRole;
}
