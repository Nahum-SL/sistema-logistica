import bcrypt from "bcrypt";
import db from "../../src/db/knex";

export const ADMIN = {
  username: "admin",
  password: "admin-password-123",
  nombre: "Administrador Prueba",
};
export const USER = {
  username: "jtorres",
  password: "user-password-1234",
  nombre: "Juan Torres",
};

const ADMIN_HASH = bcrypt.hashSync(ADMIN.password, 4);
const USER_HASH = bcrypt.hashSync(USER.password, 4);

// Orden: primero las tablas que referencian a otras.
const TABLES = [
  "auditoria",
  "documentos_logisticos",
  "pagos",
  "compras",
  "vehiculos",
  "propietarios",
  "proveedores",
  "usuarios",
];

/** Vacía todas las tablas. La transacción asegura que FOREIGN_KEY_CHECKS use la misma conexión. */
export async function resetDatabase(): Promise<void> {
  await db.transaction(async (trx) => {
    await trx.raw("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TABLES) {
      await trx.raw(`TRUNCATE TABLE \`${table}\``);
    }
    await trx.raw("SET FOREIGN_KEY_CHECKS = 1");
  });
}

/**
 * Datos mínimos:
 * - Usuarios: un admin y un usuario.
 * - Proveedores: INCAMOTORS (activo) y DISTRIBUIDORA LIMA (inactivo).
 * - Propietarios: uno con DNI, uno sin documento y uno con RUC.
 * - Vehículos: dos Hyundai del Excel; el primero tiene placa.
 */
export async function seedTestData() {
  const [adminId] = await db("usuarios").insert({
    username: ADMIN.username,
    nombre: ADMIN.nombre,
    password: ADMIN_HASH,
    rol: "admin",
  });
  const [userId] = await db("usuarios").insert({
    username: USER.username,
    nombre: USER.nombre,
    password: USER_HASH,
    rol: "usuario",
  });

  const [incamotorsId] = await db("proveedores").insert({
    ruc: "20455307954",
    razon_social: "AUTOMOTRIZ INCAMOTORS S.A.C.",
  });
  const [distribuidoraId] = await db("proveedores").insert({
    ruc: "20100070970",
    razon_social: "DISTRIBUIDORA LIMA S.A.",
    activo: false,
  });

  const [conDniId] = await db("propietarios").insert({
    tipo_documento: "DNI",
    numero_documento: "70000001",
    nombre_completo: "SANCHEZ MARCAQUISPE ALDO ALONSO",
  });
  const [sinDocumentoId] = await db("propietarios").insert({
    nombre_completo: "ASTORAYME ECHEGARAY MARISOL",
  });
  const [conRucId] = await db("propietarios").insert({
    tipo_documento: "RUC",
    numero_documento: "20101000011",
    nombre_completo: "TRANSPORTES DEL SUR E.I.R.L.",
  });

  const [vehiculo1Id] = await db("vehiculos").insert({
    vin: "MALB251AAVM748526",
    marca: "HYUNDAI",
    modelo: "GRAND I10 HB COMFORT",
    color: "GRIS",
    anio_modelo: 2027,
    numero_motor: "G3LATM635556",
    tipo_combustible: "BI-COMBUSTIBLE GLP",
    placa: "Y2N-557",
  });
  const [vehiculo2Id] = await db("vehiculos").insert({
    vin: "MALB251AAVM739919",
    marca: "HYUNDAI",
    modelo: "GRAND I10 HB COMFORT",
    color: "BLANCO",
    anio_modelo: 2027,
    numero_motor: "G3LATM614952",
    tipo_combustible: "BI-COMBUSTIBLE GLP",
  });

  return {
    users: { adminId: Number(adminId), userId: Number(userId) },
    proveedores: {
      incamotorsId: Number(incamotorsId),
      distribuidoraId: Number(distribuidoraId),
    },
    propietarios: {
      conDniId: Number(conDniId),
      sinDocumentoId: Number(sinDocumentoId),
      conRucId: Number(conRucId),
    },
    vehiculos: {
      vehiculo1Id: Number(vehiculo1Id),
      vehiculo2Id: Number(vehiculo2Id),
    },
  };
}

export type TestData = Awaited<ReturnType<typeof seedTestData>>;
