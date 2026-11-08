/**
 * Fecha/hora de la operación para la sincronización offline (Fase 2).
 *
 * Los clients (web y Expo) encolan operaciones en la outbox y agregan al body
 * un campo `fecha` con el instante local en que el usuario hizo la operación
 * (ISO 8601 con offset). Al sincronizar, el servidor NO debe usar `new Date()`
 * (que sería la hora de la sincronización, horas o días después), sino esa
 * fecha del body. Sin `fecha` en el body comportamiento idéntico al de siempre.
 *
 * Reglas:
 * - `fecha` ausente, inválida o de tipo inesperado → se usa la hora del
 *   servidor (fallback seguro; el cliente no debería mandar basura).
 * - `fecha` muy en el futuro (más que la tolerancia) → se toma la hora del
 *   servidor para no aceptar operaciones fechadas adelante por error.
 * - Fechas pasadas se aceptan tal cual: es el caso legítimo del modo offline
 *   (la operación puede tener horas o días de antigüedad).
 */

// Tolerancia de reloj entre cliente y servidor (5 minutos).
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

const parsearFecha = (valor) => {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? new Date(valor) : null;
  }
  if (typeof valor === "string" && valor.trim() !== "") {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Resuelve la fecha de la operación a partir del body del request.
 *
 * Devuelve `{ fecha, explicita }`:
 * - `fecha`: la fecha/hora a usar para guardar el registro.
 * - `explicita`: true si el cliente mandó `fecha` y se usó esta (modo offline);
 *   false si se usó la hora del servidor.
 *
 * Ejemplos de uso en los controllers:
 *   const { fecha } = resolverFechaOperacion(req.body); // → fecha_acarreo, apertura, etc.
 */
export const resolverFechaOperacion = (body, campo = "fecha") => {
  const ahora = new Date();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { fecha: ahora, explicita: false };
  }

  const explicita = parsearFecha(body[campo]);

  if (!explicita) {
    return { fecha: ahora, explicita: false };
  }

  // Fecha demasiado en el futuro: no confiar, registrar con el reloj del
  // servidor (mantiene el orden temporal de los registros).
  if (explicita.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS) {
    return { fecha: ahora, explicita: false };
  }

  return { fecha: explicita, explicita: true };
};

/**
 * Formatea una fecha como `dd/MM/yyyy HH:mm` (igual que el resto de los
 * informes) para textos legibles, por ejemplo el detalle de incidencias.
 */
export const formatoFechaOperacion = (fecha) => {
  if (!fecha) return "-";

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "-";

  const dosDigitos = (n) => String(n).padStart(2, "0");

  return (
    `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}` +
    ` ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
  );
};
