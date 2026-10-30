export interface Proveedor {
  id: number;
  ruc: string;
  razonSocial: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProveedorFilters {
  /** Texto a buscar en RUC o razón social. */
  search?: string;
  activo?: boolean;
}

export interface CreateProveedorData {
  ruc: string;
  razonSocial: string;
}

export interface UpdateProveedorData {
  ruc?: string;
  razonSocial?: string;
}
