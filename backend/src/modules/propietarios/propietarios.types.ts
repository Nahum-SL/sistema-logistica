export const DOCUMENT_TYPES = ["DNI", "RUC", "CE", "PAS"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface Propietario {
  id: number;
  tipoDocumento: DocumentType | null;
  numeroDocumento: string | null;
  nombreCompleto: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropietarioFilters {
  /** Texto a buscar en nombre o número de documento. */
  search?: string;
  tipoDocumento?: DocumentType;
}

/** El documento es opcional, pero tipo y número van siempre juntos. */
export interface CreatePropietarioData {
  nombreCompleto: string;
  tipoDocumento?: DocumentType | null;
  numeroDocumento?: string | null;
}

export interface UpdatePropietarioData {
  nombreCompleto?: string;
  tipoDocumento?: DocumentType | null;
  numeroDocumento?: string | null;
}
