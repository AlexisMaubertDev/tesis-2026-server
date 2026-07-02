import { registrarAuditoria } from "./auditoria.js";

export const eliminarEntidad = async ({
  registro,
  entidad,
  descripcion,
  req,
  usuario,
  transaction,
}) => {
  const antes = registro.toJSON();

  await registro.destroy({ transaction });

  await registrarAuditoria({
    req,
    usuario,
    accion: "ELIMINAR",
    entidad,
    idEntidad: antes.id,
    descripcion,
    datosAnteriores: antes,
  });
};
