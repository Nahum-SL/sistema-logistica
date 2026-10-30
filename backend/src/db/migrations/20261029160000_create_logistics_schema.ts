import type { Knex } from "knex";

/**
 * Esquema inicial del sistema de logística de adquisiciones de vehículos.
 *
 * Decisiones de diseño:
 * - estado_logistico, rol y tipos de documento/pago son VARCHAR (no ENUM de MySQL):
 *   los valores válidos viven en constantes del código, así agregar uno no exige migración.
 * - Los centinelas del Excel ('NINGUNO', 'NO CUENTA') se guardan como NULL.
 * - El precio se guarda en su moneda original (USD) y los pagos en la suya (PEN).
 * - Un vehículo (VIN único) puede tener varias compras; se avisa como inconsistencia, no se bloquea.
 */
export async function up(knex: Knex): Promise<void> {
  // ---------- Usuarios y auditoría ----------
  await knex.schema.createTable("usuarios", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.string("username", 50).notNullable().unique();
    t.string("nombre", 150).notNullable();
    t.string("password", 255).notNullable();
    t.enu("rol", ["admin", "usuario"]).notNullable(); // 'admin' | 'usuario'
    t.boolean("activo").notNullable().defaultTo(true);
    t.integer("token_version").unsigned().notNullable().defaultTo(0);
    t.timestamps(true, true);
  });

  // ---------- Proveedores / concesionarios ----------
  await knex.schema.createTable("proveedores", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.string("ruc", 11).notNullable().unique();
    t.string("razon_social", 150).notNullable();
    t.boolean("activo").notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // ---------- Propietarios / clientes ----------
  await knex.schema.createTable("propietarios", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.string("tipo_documento", 10).nullable(); // DNI | RUC | CE | PAS
    t.string("numero_documento", 20).nullable();
    t.string("nombre_completo", 150).notNullable();
    t.timestamps(true, true);
    t.unique(["tipo_documento", "numero_documento"]);
    t.index(["nombre_completo"]);
  });

  // ---------- Vehículos ----------
  await knex.schema.createTable("vehiculos", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.string("vin", 30).notNullable().unique();
    t.string("marca", 50).notNullable();
    t.string("modelo", 80).notNullable();
    t.string("color", 30).nullable();
    t.smallint("anio_modelo").nullable();
    t.string("numero_motor", 50).nullable().unique();
    t.string("tipo_combustible", 40).nullable();
    t.string("placa", 15).nullable().unique();
    t.timestamps(true, true);
    t.index(["marca", "modelo"]);
  });

  // ---------- Compras ----------
  await knex.schema.createTable("compras", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.integer("proveedor_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("proveedores");
    t.integer("vehiculo_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("vehiculos");
    t.integer("propietario_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("propietarios");

    t.string("numero_cotizacion", 50).nullable();
    t.string("orden_compra", 50).nullable();
    t.string("nota_venta", 50).nullable();
    t.date("fecha_reserva").nullable();

    // Precio en su moneda original; tipo de cambio aplicado al pagar.
    t.string("moneda_precio", 3).notNullable().defaultTo("USD");
    t.decimal("precio_total_original", 12, 2).nullable();
    t.decimal("tipo_cambio", 10, 4).nullable();

    // Factura: serie y correlativo separados (el Excel mezcla "Nº", "N°", etc.).
    t.string("factura_serie", 10).nullable();
    t.string("factura_correlativo", 20).nullable();
    t.date("fecha_emision_factura").nullable();

    t.string("estado_logistico", 30).notNullable().defaultTo("PENDIENTE");
    t.string("destino", 50).nullable();
    t.date("fecha_entrega").nullable(); // acta de entrega
    t.date("fecha_envio_contabilidad").nullable();
    t.text("observaciones").nullable();

    t.integer("creado_por")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("usuarios");
    t.integer("actualizado_por")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("usuarios");
    t.timestamps(true, true);

    t.unique(["proveedor_id", "orden_compra"]);
    t.unique(["factura_serie", "factura_correlativo"]);
    t.index(["numero_cotizacion"]);
    t.index(["estado_logistico"]);
    t.index(["fecha_reserva"]);
    t.index(["vehiculo_id"]);
  });

  // ---------- Pagos (depósito inicial, saldo, otros) ----------
  await knex.schema.createTable("pagos", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.integer("compra_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("compras")
      .onDelete("CASCADE");
    t.string("tipo", 20).notNullable(); // INICIAL | SALDO | OTRO
    t.string("banco", 50).nullable();
    t.string("moneda", 3).notNullable().defaultTo("PEN");
    t.decimal("monto", 12, 2).notNullable();
    t.string("numero_operacion", 50).nullable();
    t.date("fecha_pago").nullable();
    t.timestamps(true, true);
    t.index(["compra_id"]);
  });

  // ---------- Documentos logísticos (con enlace opcional a Drive) ----------
  await knex.schema.createTable("documentos_logisticos", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.increments("id");
    t.integer("compra_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("compras")
      .onDelete("CASCADE");
    // GUIA_REMISION | GUIA_TRANSPORTISTA | CONSTANCIA_PESOS_MEDIDAS |
    // CONSTANCIA_RECEPCION | ACTA_ENTREGA | INFORME_PDF | OTRO
    t.string("tipo", 40).notNullable();
    t.string("numero", 50).nullable();
    t.date("fecha").nullable();
    t.string("drive_file_id", 100).nullable();
    t.string("drive_url", 500).nullable();
    t.string("nombre_archivo", 255).nullable();
    t.timestamps(true, true);
    t.index(["compra_id", "tipo"]);
    t.index(["tipo", "numero"]);
    t.index(["drive_file_id"]);
  });

  // ---------- Auditoría ----------
  await knex.schema.createTable("auditoria", (t) => {
    t.engine("InnoDB");
    t.charset("utf8mb4");
    t.collate("utf8mb4_unicode_ci");

    t.bigIncrements("id");
    t.integer("usuario_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("usuarios");
    t.string("entidad", 50).notNullable();
    t.integer("entidad_id").unsigned().nullable();
    t.string("accion", 20).notNullable(); // CREATE | UPDATE | DELETE | LOGIN | IMPORT
    t.json("cambios").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.index(["entidad", "entidad_id"]);
    t.index(["usuario_id"]);
    t.index(["created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("auditoria");
  await knex.schema.dropTableIfExists("documentos_logisticos");
  await knex.schema.dropTableIfExists("pagos");
  await knex.schema.dropTableIfExists("compras");
  await knex.schema.dropTableIfExists("vehiculos");
  await knex.schema.dropTableIfExists("propietarios");
  await knex.schema.dropTableIfExists("proveedores");
  await knex.schema.dropTableIfExists("usuarios");
}
