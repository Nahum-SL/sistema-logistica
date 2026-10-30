import { diffFields, recordAudit } from "../../shared/utils/audit.js";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { buildXlsx } from "../../shared/utils/excel.js";
import {
  buildPagination,
  type Pagination,
} from "../../shared/utils/pagination.js";
import { withConflictHandling } from "../../shared/utils/withConflictHandling.js";
import { propietariosRepository } from "./propietarios.repository.js";
import type {
  CreatePropietarioInput,
  ExportPropietariosQuery,
  ListPropietariosQuery,
  UpdatePropietarioInput,
} from "./propietarios.schema.js";
import type { DocumentType, Propietario } from "./propietarios.types.js";

const ENTIDAD = "propietario";
const DUPLICATE_DOCUMENT = "Ya existe un propietario con ese documento";

/** Lógica de negocio de propietarios (clientes finales). Contiene datos personales. */
export class PropietariosService {
  async list(
    query: ListPropietariosQuery,
  ): Promise<{ items: Propietario[]; pagination: Pagination }> {
    const { page, limit, ...filters } = query;
    const { items, total } = await propietariosRepository.findPage(
      filters,
      page,
      limit,
    );

    return { items, pagination: buildPagination(page, limit, total) };
  }

  /** @throws {NotFoundError} Si el propietario no existe (404). */
  async getById(id: number): Promise<Propietario> {
    const propietario = await propietariosRepository.findById(id);

    if (!propietario) throw new NotFoundError("El propietario no existe");

    return propietario;
  }

  /** @throws {ConflictError} Si el documento ya está registrado (409). */
  async create(
    input: CreatePropietarioInput,
    actorId: number,
  ): Promise<Propietario> {
    const { tipoDocumento, numeroDocumento } = input;

    if (
      tipoDocumento &&
      numeroDocumento &&
      (await propietariosRepository.documentExists(
        tipoDocumento,
        numeroDocumento,
      ))
    ) {
      throw new ConflictError(DUPLICATE_DOCUMENT);
    }

    // (tipo, número) es la única restricción UNIQUE de la tabla: cubre la condición de carrera.
    const propietario = await withConflictHandling(
      () => propietariosRepository.create(input),
      DUPLICATE_DOCUMENT,
    );

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: propietario.id,
      accion: "CREATE",
      cambios: {
        nombreCompleto: propietario.nombreCompleto,
        tipoDocumento: propietario.tipoDocumento,
        numeroDocumento: propietario.numeroDocumento,
      },
    });

    return propietario;
  }

  /**
   * @throws {NotFoundError} Si no existe (404).
   * @throws {ConflictError} Si el nuevo documento ya pertenece a otro propietario (409).
   */
  async update(
    id: number,
    input: UpdatePropietarioInput,
    actorId: number,
  ): Promise<Propietario> {
    const before = await this.getById(id);

    const tipo = input.tipoDocumento as DocumentType | null | undefined;
    const numero = input.numeroDocumento;

    if (
      tipo &&
      numero &&
      (tipo !== before.tipoDocumento || numero !== before.numeroDocumento) &&
      (await propietariosRepository.documentExists(tipo, numero, id))
    ) {
      throw new ConflictError(DUPLICATE_DOCUMENT);
    }

    await withConflictHandling(
      () => propietariosRepository.update(id, input),
      DUPLICATE_DOCUMENT,
    );

    const after = await this.getById(id);
    const cambios = diffFields(before, after, [
      "nombreCompleto",
      "tipoDocumento",
      "numeroDocumento",
    ]);

    if (Object.keys(cambios).length > 0) {
      await recordAudit({
        usuarioId: actorId,
        entidad: ENTIDAD,
        entidadId: id,
        accion: "UPDATE",
        cambios,
      });
    }

    return after;
  }

  /** Excel con todos los propietarios que cumplen los filtros. Queda registrado en auditoría. */
  async exportToExcel(
    filters: ExportPropietariosQuery,
    actorId: number,
  ): Promise<Buffer> {
    const propietarios = await propietariosRepository.findAll(filters);

    await recordAudit({
      usuarioId: actorId,
      entidad: ENTIDAD,
      entidadId: null,
      accion: "EXPORT",
      cambios: { filtros: filters, filas: propietarios.length },
    });

    return buildXlsx(
      "Propietarios",
      [
        { header: "Tipo doc.", key: "tipoDocumento", width: 11 },
        { header: "N° documento", key: "numeroDocumento", width: 16 },
        { header: "Nombre completo", key: "nombreCompleto", width: 50 },
        { header: "Registrado", key: "createdAt", width: 20 },
      ],
      propietarios.map((p) => ({
        tipoDocumento: p.tipoDocumento ?? "",
        numeroDocumento: p.numeroDocumento ?? "",
        nombreCompleto: p.nombreCompleto,
        createdAt: p.createdAt,
      })),
    );
  }
}

export const propietariosService = new PropietariosService();
