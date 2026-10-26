import Auditoria from "../models/Auditoria.model.js";

// Postgres valida los ENUM de forma estricta (MySQL, en modo no estricto,
// guardaba una cadena vacía). Si en el futuro se agrega una acción nueva y
// falta en el modelo, la auditoría no debe romper la operación principal.
const ACCIONES_VALIDAS = Auditoria.rawAttributes.accion.values;

export async function registrarAuditoria({
  usuario,
  entidad,
  idEntidad,
  accion,
  descripcion,
  antes,
  despues,
  req,
}) {
  await Auditoria.create({
    id_usuario: usuario.id,
    entidad,
    id_entidad: idEntidad,
    accion: ACCIONES_VALIDAS.includes(accion) ? accion : "OTRO",
    descripcion,
    datos_anteriores: antes,
    datos_nuevos: despues,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });
}
