import { Op } from "sequelize";
import sequelize from "../src/config/db.js";
import { SyncOperation } from "../src/models/index.js";

/**
 * Borra registros de idempotencia viejos para que la tabla no crezca sin
 * límite. Los reintentos de la outbox offline ocurren en horas/días, no en
 * semanas; 7 días es un margen seguro.
 *
 * Uso:
 *   npm run db:limpiar-operaciones
 *   DIAS=30 npm run db:limpiar-operaciones
 */
const dias = Number(process.env.DIAS) || 7;
const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

try {
  await sequelize.authenticate();

  const borradas = await SyncOperation.destroy({
    where: { actualizado_en: { [Op.lt]: limite } },
  });

  console.log(
    `Operaciones sync eliminadas: ${borradas} (anteriores a ${limite.toISOString()}).`,
  );
} catch (error) {
  console.error(
    "No se pudieron limpiar las operaciones sync:",
    error.message,
  );
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
