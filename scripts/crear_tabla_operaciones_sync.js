import sequelize from "../src/config/db.js";
import { SyncOperation } from "../src/models/index.js";

/**
 * Crea (o verifica) la tabla `operaciones_sync` en la base configurada.
 *
 * Es idempotente: si la tabla ya existe, `sync()` no la modifica. No usa
 * `alter: true` para no tocar el resto del esquema.
 *
 * Uso local:
 *   npm run db:sync-operaciones
 *
 * En Supabase/producción hay que ejecutarlo con DB_URL apuntando al pooler y
 * con el rol que usa la API (parkcontrol_app), para que quede como dueño de la
 * tabla y tenga los grants correspondientes.
 */
try {
  await sequelize.authenticate();
  await SyncOperation.sync();

  console.log(
    `Tabla ${SyncOperation.getTableName()} creada/verificada ` +
      `(${sequelize.getDialect()}).`,
  );
} catch (error) {
  console.error(
    "No se pudo crear/verificar la tabla operaciones_sync:",
    error.message,
  );
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
