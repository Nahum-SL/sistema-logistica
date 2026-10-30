import bcrypt from "bcrypt";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { withConflictHandling } from "../../shared/utils/withConflictHandling.js";
import { usersRepository } from "./users.repository.js";
import type { PublicUser } from "./users.types.js";
import type {
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
} from "./users.schema.js";

const BCRYPT_COST = 12;

/** Lógica de negocio de las cuentas de usuario. */
export class UsersService {
  /** Lista las cuentas sin exponer contraseñas. */
  async list(): Promise<PublicUser[]> {
    return usersRepository.findAll();
  }

  /** @throws {NotFoundError} Si el usuario no existe (404). */
  async getById(id: number): Promise<PublicUser> {
    const user = await usersRepository.findPublicById(id);

    if (!user) throw new NotFoundError("El usuario no existe");

    return user;
  }

  /**
   * Crea una cuenta. La contraseña se guarda con bcrypt; nunca se devuelve.
   * @throws {ConflictError} Si el nombre de usuario ya está en uso (409).
   */
  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await usersRepository.usernameExists(input.username)) {
      throw new ConflictError("El nombre de usuario ya está registrado");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    // `username` es la única restricción UNIQUE de la tabla: cubre la condición de carrera.
    return withConflictHandling(
      () =>
        usersRepository.create({
          username: input.username,
          nombre: input.nombre,
          passwordHash,
          rol: input.rol,
        }),
      "El nombre de usuario ya está registrado",
    );
  }

  /**
   * Cambia nombre, rol o estado de una cuenta.
   * @throws {NotFoundError} Si no existe (404).
   * @throws {ConflictError} Si intentas desactivarte o quitarte el rol, o si es el último admin activo (409).
   */
  async update(
    id: number,
    actorId: number,
    input: UpdateUserInput,
  ): Promise<PublicUser> {
    const result = await usersRepository.updateAccount(id, input, actorId);

    switch (result.status) {
      case "not_found":
        throw new NotFoundError("El usuario no existe");
      case "self_change":
        throw new ConflictError(
          "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador",
        );
      case "last_admin":
        throw new ConflictError("Debe quedar al menos un administrador activo");
      case "ok":
        return result.user;
    }
  }

  /**
   * Restablece la contraseña de una cuenta. Cierra sus sesiones abiertas.
   * @throws {NotFoundError} Si no existe (404).
   */
  async resetPassword(id: number, input: ResetPasswordInput): Promise<void> {
    await this.getById(id);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    if ((await usersRepository.updatePassword(id, passwordHash)) === null) {
      throw new NotFoundError("El usuario no existe");
    }
  }
}

export const usersService = new UsersService();
