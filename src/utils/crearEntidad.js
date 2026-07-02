import { registrarAuditoria } from "./auditoria.js";

export const crearEntidad = async ({
  modelo,
  datos,
  entidad,
  descripcion,
  req,
  usuario,
  transaction,
}) => {
  const registro = await modelo.create(datos, { transaction });

  await registrarAuditoria({
    req,
    usuario,
    accion: "CREAR",
    entidad,
    idEntidad: registro.id,
    descripcion,
    datosNuevos: registro.toJSON(),
  });

  return registro;
};
