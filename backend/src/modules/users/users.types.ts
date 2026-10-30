export type UserRole = "admin" | "usuario";

/** Cuenta con el hash de la contraseña: solo para uso interno del backend. */
export interface UserCredentials {
  id: number;
  username: string;
  nombre: string;
  passwordHash: string;
  rol: UserRole;
  activo: boolean;
  tokenVersion: number;
}

/** Datos de una cuenta que sí se pueden exponer por la API. */
export interface PublicUser {
  id: number;
  username: string;
  nombre: string;
  rol: UserRole;
  activo: boolean;
}

/** Lo mínimo que necesita el middleware para validar una sesión. */
export interface UserAuthState {
  id: number;
  username: string;
  rol: UserRole;
  activo: boolean;
  tokenVersion: number;
}

export interface CreateUserData {
  username: string;
  nombre: string;
  passwordHash: string;
  rol: UserRole;
}

export interface UpdateUserData {
  nombre?: string;
  rol?: UserRole;
  activo?: boolean;
}

export type UpdateAccountResult =
  | { status: "ok"; user: PublicUser }
  | { status: "not_found" }
  | { status: "self_change" }
  | { status: "last_admin" };
