/**
 * Validación de identificadores para Postgres.
 *
 * En MySQL los `findByPk` con ids inválidos terminaban en `null`; en Postgres
 * un id no-UUID produce un error de cast (500). Se valida antes de buscar para
 * responder 400/404 como corresponde.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUuidValido = (valor) =>
  typeof valor === "string" && UUID_RE.test(valor.trim());
