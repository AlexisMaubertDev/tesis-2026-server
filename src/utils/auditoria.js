import Auditoria from "../models/Auditoria.model.js";

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
    accion,
    descripcion,
    datos_anteriores: antes,
    datos_nuevos: despues,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });
}
