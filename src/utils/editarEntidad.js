import { registrarAuditoria } from "./auditoria.js";

export const editarEntidad = async ({
  modelo,
  id,
  datos,
  entidad,
  descripcion,
  req,
  usuario,
  transaction,
  validacion,
}) => {
  const registro = await modelo.findByPk(id, { transaction });

  if (!registro) {
    throw new Error(`${entidad} no encontrada`);
  }

  if (validacion) {
    await validacion(registro);
  }

  const antes = registro.toJSON();

  await registro.update(datos, { transaction });

  await registrarAuditoria({
    req,
    usuario,
    accion: "EDITAR",
    entidad,
    idEntidad: registro.id,
    descripcion,
    datosAnteriores: antes,
    datosNuevos: registro.toJSON(),
  });

  return registro;
};
