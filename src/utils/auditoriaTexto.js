import { formatoImporte } from "./informePdf.js";

// Textos legibles para las descripciones de auditoría: nunca IDs, siempre
// patentes, nombres con legajo y números de recurso (caja, grúa, barrera).
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const TURNOS = {
  "1": "mañana",
  "2": "tarde",
  "3": "noche",
};

const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
});

const FECHA_HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const aFecha = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "mañana" | "tarde" | "noche" (el backend guarda "1", "2", "3"). */
export const etiquetaTurno = (turno) => TURNOS[String(turno)] ?? "turno";

/** "26/11" en horario de Argentina. */
export const fechaCorta = (fecha) => {
  const d = aFecha(fecha);
  return d ? FECHA_CORTA.format(d) : "";
};

/** "26/11/2026 22:00" en horario de Argentina. */
export const fechaHora = (fecha) => {
  const d = aFecha(fecha);
  return d ? FECHA_HORA.format(d) : "-";
};

/**
 * "Turno noche del 26/11": la fecha es la del inicio del turno. El turno noche
 * que arranca el 26/11 y termina el 27/11 a las 07:00 queda como "del 26/11".
 */
export const turnoConFecha = (turno, fechaInicio) => {
  const etiqueta = etiquetaTurno(turno);
  const fecha = fechaCorta(fechaInicio);
  return fecha ? `turno ${etiqueta} del ${fecha}` : `turno ${etiqueta}`;
};

/** "Nombre Apellido (legajo 1234)". */
export const nombrePersona = (usuario) => {
  if (!usuario) return "usuario desconocido";

  const nombre =
    [usuario.nombre, usuario.apellido].filter(Boolean).join(" ").trim() ||
    "usuario";

  return usuario.legajo
    ? `${nombre} (legajo ${usuario.legajo})`
    : nombre;
};

/** "Nombre Apellido (legajo 1234 · CHOFER)". */
export const nombrePersonaConRol = (usuario) => {
  const nombre = nombrePersona(usuario);

  if (!usuario?.rol) return nombre;

  return usuario.legajo
    ? nombre.replace(/\)$/, ` · ${usuario.rol})`)
    : `${nombre} (${usuario.rol})`;
};

/** Importe con formato "$ 12.345,00". */
export const importe = (valor) => formatoImporte(valor);

/** "N° 3 (patente AB123CD)" para una grúa. */
export const describirGrua = (grua) => {
  if (!grua) return "la grúa";

  const numero = grua.numero !== undefined ? `N° ${grua.numero}` : null;
  const patente = grua.patente ? `patente ${grua.patente}` : null;
  const detalle = [numero, patente].filter(Boolean).join(" · ");

  return detalle ? `la grúa ${detalle}` : "la grúa";
};

/** "la caja N° 2" (con la referencia si tiene). */
export const describirCaja = (caja) => {
  if (!caja) return "la caja";

  const numero =
    caja.numero_caja !== undefined ? `N° ${caja.numero_caja}` : null;
  const referencia = caja.referencia ? `"${caja.referencia}"` : null;
  const detalle = [numero, referencia].filter(Boolean).join(" ");

  return detalle ? `la caja ${detalle}` : "la caja";
};

/** "la barrera \"Principal\"" (o el nombre que tenga). */
export const describirBarrera = (barrera) => {
  if (!barrera) return "la barrera";

  return barrera.ubicacion
    ? `la barrera "${barrera.ubicacion}"`
    : "la barrera";
};
