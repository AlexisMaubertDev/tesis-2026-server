import sequelize from "../src/config/db.js";
import "../src/models/index.js";

/**
 * Crea/actualiza el esquema a partir de los modelos de Sequelize.
 *
 * Uso:
 *   npm run db:sync
 *
 * Es para ejecutarlo a mano una sola vez (o cuando cambien los modelos). No se
 * corre en cada arranque del servidor para evitar los problemas de `alter` en
 * MySQL/Postgres (ver el comentario de src/server.js).
 */
try {
  await sequelize.authenticate();
  console.log(
    `Conectado a ${sequelize.getDialect()} (${sequelize.config.host ?? "DB_URL"}).`,
  );

  await sequelize.sync();
  console.log("Esquema sincronizado correctamente.");
} catch (error) {
  console.error("Error al sincronizar el esquema:", error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
