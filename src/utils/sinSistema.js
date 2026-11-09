import { formatoFechaOperacion } from "./fechas.js";

/**
 * "Cargado sin sistema" (Fase 7 de la sincronización offline).
 *
 * Las operaciones que la outbox del cliente encola viajan con el flag
 * `cargado_sin_sistema: true` en el body (solo se agrega en el momento del
 * encolado, así el flag es parte de la huella del body y la idempotencia
 * queda intacta). El servidor lo usa para dejar constancia en las
 * incidencias del acarreo: la operación se cargó en una sincronización
 * porque no hubo sistema.
 */

export const esCargadoSinSistema = (req) => req?.body?.cargado_sin_sistema === true;

/**
 * Texto de la incidencia para una operación cargada en sincronización.
 * `extra` permite sumar el detalle del cobro (faltante/coincidente).
 */
export const incidenciaSinSistema = (etiqueta, fechaOperacion, extra = "") =>
  `${etiqueta} cargado en sincronización (sin sistema) el ${formatoFechaOperacion(
    fechaOperacion ?? new Date().toISOString(),
  )}${extra ? ` — ${extra}` : ""}`;

/** Acumula una incidencia al texto previo (cada una en su línea, como hace la salida sin cargo). */
export const acumularIncidencia = (previas, texto) =>
  previas ? `${previas}\n${texto}` : texto;
