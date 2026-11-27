import { registrarAuditoria } from "./auditoria.js";
import {
  describirBarrera,
  describirCaja,
  describirGrua,
} from "./auditoriaTexto.js";

// Descripción legible del recurso sincronizado (sin IDs).
const describirEntidad = (entidad, item) => {
  switch (entidad) {
    case "CAJA":
      return describirCaja(item);
    case "BARRERA":
      return describirBarrera(item);
    case "GRUA":
      return describirGrua(item);
    default:
      return item?.nombre
        ? `${entidad.toLowerCase()} "${item.nombre}"`
        : entidad.toLowerCase();
  }
};

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

      // El "antes" se toma antes de aplicar los cambios.
      const antes = actual.toJSON();

      await actual.update(item, { transaction });

      await registrarAuditoria({
        req,
        usuario,
        accion: "EDITAR",
        entidad,
        idEntidad: actual.id,
        descripcion: `Editó ${describirEntidad(entidad, actual)}`,
        antes,
        despues: actual.toJSON(),
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
        descripcion: `Creó ${describirEntidad(entidad, created)}`,
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
        descripcion: `Eliminó ${describirEntidad(entidad, actual)}`,
        antes: actual.toJSON(),
      });

      await actual.destroy({ transaction });
    }
  }

  return resultados;
};
