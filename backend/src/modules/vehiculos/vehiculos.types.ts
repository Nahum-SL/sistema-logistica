export interface Vehiculo {
  id: number;
  vin: string;
  marca: string;
  modelo: string;
  color: string | null;
  anioModelo: number | null;
  numeroMotor: string | null;
  tipoCombustible: string | null;
  placa: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehiculoFilters {
  /** Texto a buscar en VIN, marca, modelo, motor o placa. */
  search?: string;
  marca?: string;
  anioModelo?: number;
}

export interface CreateVehiculoData {
  vin: string;
  marca: string;
  modelo: string;
  color?: string | null;
  anioModelo?: number | null;
  numeroMotor?: string | null;
  tipoCombustible?: string | null;
  placa?: string | null;
}

/** `null` borra el valor; `undefined` lo deja igual. */
export type UpdateVehiculoData = Partial<CreateVehiculoData>;

/** Campos que pueden chocar con otro vehículo (restricciones únicas). */
export type VehiculoUniqueField = "vin" | "numeroMotor" | "placa";

export interface VehiculoOptions {
  marcas: string[];
  modelos: { marca: string; modelo: string }[];
}
