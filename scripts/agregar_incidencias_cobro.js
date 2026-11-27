import sequelize from "../src/config/db.js";

/**
 * Agrega la columna `incidencias` a `cobros` (texto nullable) y el valor
 * `AGREGAR_INCIDENCIA_COBRO` al ENUM `auditorias.accion`, en una base ya
 * creada. Es idempotente. Los cambios son aditivos y no tocan datos existentes.
 *
 *   node scripts/agregar_incidencias_cobro.js
 */
const dialecto = sequelize.getDialect();

try {
  await sequelize.authenticate();

  // Columna `incidencias` nullable: additiva, no rompe filas existentes.
  await sequelize.query(
    "ALTER TABLE cobros ADD COLUMN IF NOT EXISTS incidencias TEXT",
  );

  // Valor nuevo del ENUM (Postgres no soporta IF NOT EXISTS en MySQL).
  if (dialecto === "postgres") {
    await sequelize.query(
      "ALTER TYPE public.enum_auditorias_accion ADD VALUE IF NOT EXISTS 'AGREGAR_INCIDENCIA_COBRO'",
    );
  }

  console.log("Cobros: incidencias + AGREGAR_INCIDENCIA_COBRO listo.");
} catch (error) {
  console.error("No se pudo aplicar el cambio:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
