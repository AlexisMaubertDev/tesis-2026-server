import sequelize from "../src/config/db.js";
import Auditoria from "../src/models/Auditoria.model.js";

/**
 * Actualiza el ENUM de `auditorias.accion` en una base ya creada.
 *
 * El modelo tiene la lista completa de acciones, pero `sequelize.sync()` no
 * modifica los ENUM existentes si no se usa `alter: true` (y `alter` es
 * riesgoso por las referencias cíclicas del esquema). Este script hace sólo
 * ese cambio, de forma idempotente:
 *
 *   npm run db:auditorias
 *
 * En Postgres agrega los valores que falten al tipo; en MySQL reemplaza la
 * definición de la columna. También normaliza a OTRO las auditorías viejas que
 * hayan quedado con la cadena vacía (lo que hacía MySQL en modo no estricto).
 */

const valores = Auditoria.rawAttributes.accion.values;
const dialecto = sequelize.getDialect();

try {
  await sequelize.authenticate();

  if (dialecto === "postgres") {
    for (const valor of valores) {
      await sequelize.query(
        `ALTER TYPE public.enum_auditorias_accion ADD VALUE IF NOT EXISTS '${valor}'`,
      );
    }
  } else if (dialecto === "mysql") {
    await sequelize.query(
      "UPDATE auditorias SET accion = 'OTRO' WHERE accion = ''",
    );
    await sequelize.query(
      `ALTER TABLE auditorias MODIFY COLUMN accion ENUM(${valores
        .map((valor) => `'${valor}'`)
        .join(",")}) NOT NULL`,
    );
  } else {
    throw new Error(`Dialecto no soportado: ${dialecto}`);
  }

  console.log(
    `ENUM de auditorias actualizado (${dialecto}, ${valores.length} acciones).`,
  );
} catch (error) {
  console.error("No se pudo actualizar el ENUM de auditorias:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
