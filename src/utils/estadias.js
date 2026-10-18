// La estadía se cobra por bloques de 12 horas contados desde el acarreo. Hasta
// que se cumplen las primeras 12 horas sólo se paga el acarreo; cumplidas, se
// cobra la primera estadía (el acarreo + 1 estadía). Se topea en 70 estadías:
// más allá de ese número se siguen cobrando 70.
export const HORAS_POR_ESTADIA = 12;
export const MAX_ESTADIAS = 70;

/**
 * Cantidad de estadías de un acarreo según el reloj (no se cargan a mano).
 * Devuelve 0 mientras no se cumplieron las primeras 12 horas.
 */
export const calcularEstadias = (fechaAcarreo, ahora = new Date()) => {
  if (!fechaAcarreo) return 0;

  const inicio = new Date(fechaAcarreo).getTime();
  if (!Number.isFinite(inicio)) return 0;

  const horas = (ahora.getTime() - inicio) / 3600000;
  if (horas <= 0) return 0;

  return Math.min(MAX_ESTADIAS, Math.floor(horas / HORAS_POR_ESTADIA));
};
