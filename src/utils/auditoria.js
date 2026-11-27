import Auditoria from "../models/Auditoria.model.js";

// Postgres valida los ENUM de forma estricta (MySQL, en modo no estricto,
// guardaba una cadena vacía). Si en el futuro se agrega una acción nueva y
// falta en el modelo, la auditoría no debe romper la operación principal.
const ACCIONES_VALIDAS = Auditoria.rawAttributes.accion.values;

// La columna `descripcion` es STRING(300): un texto más largo haría fallar el
// insert (y con él la operación principal). Se recorta sin romper la auditoría.
const MAX_DESCRIPCION = 300;

export async function registrarAuditoria({
  usuario,
  entidad,
  idEntidad,
  accion,
  descripcion,
  antes,
  despues,
  // Alias usados por los helpers viejos (crearEntidad, editarEntidad, etc.).
  datosAnteriores,
  datosNuevos,
  req,
}) {
  await Auditoria.create({
    id_usuario: usuario.id,
    entidad,
    id_entidad: idEntidad,
    accion: ACCIONES_VALIDAS.includes(accion) ? accion : "OTRO",
    descripcion:
      typeof descripcion === "string"
        ? descripcion.slice(0, MAX_DESCRIPCION)
        : descripcion,
    datos_anteriores: antes ?? datosAnteriores ?? null,
    datos_nuevos: despues ?? datosNuevos ?? null,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });
}
