import { registrarAuditoria } from "./auditoria.js";

export const sincronizarEntidades = async ({
  modelo,
  actuales,
  nuevos,
  foreignKey,
  idPadre,
  entidad,
  req,
  usuario,
  transaction,
}) => {
  const actualesMap = new Map(actuales.map((item) => [item.id, item]));

  const nuevosMap = new Map(
    (nuevos || []).filter((n) => n.id).map((item) => [item.id, item]),
  );

  const resultados = [];

  // =========================
  // EDITAR O CREAR
  // =========================
  for (const item of nuevos || []) {
    if (item.id && actualesMap.has(item.id)) {
      const actual = actualesMap.get(item.id);

      await actual.update(item, { transaction });

      await registrarAuditoria({
        req,
        usuario,
        accion: "EDITAR",
        entidad,
        idEntidad: actual.id,
        descripcion: `Editó ${entidad.toLowerCase()} ${actual.id}`,
        antes: actual.toJSON(),
        despues: item,
      });

      resultados.push(actual);
    } else {
      const created = await modelo.create(
        {
          ...item,
          [foreignKey]: idPadre,
        },
        { transaction },
      );

      await registrarAuditoria({
        req,
        usuario,
        accion: "CREAR",
        entidad,
        idEntidad: created.id,
        descripcion: `Creó ${entidad.toLowerCase()}`,
        despues: created,
      });

      resultados.push(created);
    }
  }

  // =========================
  // ELIMINAR
  // =========================
  for (const actual of actuales) {
    if (!nuevosMap.has(actual.id)) {
      await registrarAuditoria({
        req,
        usuario,
        accion: "ELIMINAR",
        entidad,
        idEntidad: actual.id,
        descripcion: `Eliminó ${entidad.toLowerCase()}`,
        antes: actual.toJSON(),
      });

      await actual.destroy({ transaction });
    }
  }

  return resultados;
};
