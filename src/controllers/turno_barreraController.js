import sequelize from "../config/db.js";
import { Barrera, Sucursal, Turno_Barrera, Turno_Barrera_Usuario, Usuario } from "../models/index.js";
import { Op } from "sequelize";
import { registrarAuditoria } from "../utils/auditoria.js";

export const obtenerBarrerasSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const barreras = await Barrera.findAll({
      where: { id_sucursal: id },
      include: [
        { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
        {
          model: Turno_Barrera,
          as: "turno_barrera_activo",
          required: false,
          include: [
            {
              model: Turno_Barrera_Usuario,
              as: "usuarios_asignados",
              required: false,
              include: [
                {
                  model: Usuario,
                  attributes: ["id", "nombre", "apellido", "legajo", "rol", "numero_turno"],
                },
              ],
            },
          ],
        },
      ],
      order: [["ubicacion", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: barreras,
      message: "Barreras obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

// Turno de barrera activo del usuario autenticado (lo usa el home del playero
// para saber en qué barrera está). Devuelve `null` si no tiene ninguno.
export const obtenerMiTurnoBarrera = async (req, res) => {
  try {
    const asignacion = await Turno_Barrera_Usuario.findOne({
      where: { id_usuario: req.user.id },
      include: [
        {
          model: Turno_Barrera,
          required: true,
          where: { activo: true },
          include: [
            {
              model: Barrera,
              include: [
                { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
              ],
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: asignacion?.turno_barrera ?? null,
      message: "Turno de barrera obtenido exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const asignarBarrera = async (req, res) => {
  const { id_barrera, turno, id_usuarios, observaciones } = req.body;
  const id_supervisor = req.user.id;

  if (!id_barrera || !turno || !Array.isArray(id_usuarios) || id_usuarios.length === 0) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    const barrera = await Barrera.findByPk(id_barrera, { transaction });
    if (!barrera) {
      await transaction.rollback();
      return res.status(404).json({ error: "Barrera no encontrada" });
    }

    const turnoActivoExistente = await Turno_Barrera.findOne({
      where: { id_barrera, activo: true },
      transaction,
    });
    if (turnoActivoExistente) {
      await transaction.rollback();
      return res.status(400).json({ error: "La barrera ya tiene un turno activo" });
    }

    const usuarios = await Usuario.findAll({
      where: { id: id_usuarios },
      transaction,
    });
    if (usuarios.length !== id_usuarios.length) {
      await transaction.rollback();
      return res.status(404).json({ error: "Uno o más usuarios no existen" });
    }

    const ocupados = await Turno_Barrera_Usuario.findAll({
      where: { id_usuario: id_usuarios },
      include: [{ model: Turno_Barrera, where: { activo: true }, required: true }],
      transaction,
    });
    if (ocupados.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Uno o más playeros ya se encuentran en un turno de barrera activo",
      });
    }

    const turnoBarrera = await Turno_Barrera.create(
      {
        id_barrera,
        turno,
        activo: true,
        fecha_inicio: new Date(),
        fecha_fin: null,
        observaciones: observaciones || null,
      },
      { transaction },
    );

    await Turno_Barrera_Usuario.bulkCreate(
      id_usuarios.map((id_usuario) => ({
        id_turno_barrera: turnoBarrera.id,
        id_usuario,
      })),
      { transaction },
    );

    await transaction.commit();

    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: barrera.id,
      accion: "ASIGNAR_TURNO_BARRERA",
      descripcion: `Se asignó un turno de barrera (${turno}) con ${id_usuarios.length} playero(s)`,
      req,
    });

    return res.status(201).json({
      success: true,
      data: turnoBarrera,
      message: "Turno de barrera asignado exitosamente",
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

export const finalizarTurnoBarrera = async (req, res) => {
  const { id } = req.params;
  try {
    const turno = await Turno_Barrera.findByPk(id);
    if (!turno) {
      return res.status(404).json({ error: "Turno de barrera no encontrado" });
    }
    if (!turno.activo) {
      return res.status(400).json({ error: "El turno ya está finalizado" });
    }
    await turno.update({ activo: false, fecha_fin: new Date() });
    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: turno.id_barrera,
      accion: "FINALIZAR_TURNO_BARRERA",
      descripcion: `Se finalizó el turno de barrera ${turno.id}`,
      req,
    });
    return res.status(200).json({ success: true, message: "Turno finalizado exitosamente" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

export const agregarIncidenciasBarrera = async (req, res) => {
  const { id } = req.params;
  const { incidencias } = req.body;
  try {
    const turno = await Turno_Barrera.findByPk(id);
    if (!turno) {
      return res.status(404).json({ error: "Turno de barrera no encontrado" });
    }
    const nuevas = incidencias?.trim()
      ? (turno.incidencias ? turno.incidencias + "\n" : "") + incidencias.trim()
      : turno.incidencias;
    await turno.update({ incidencias: nuevas });
    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: turno.id_barrera,
      accion: "AGREGAR_INCIDENCIA_BARRERA",
      descripcion: `Se agregó una incidencia al turno de barrera ${turno.id}`,
      req,
    });
    return res.status(200).json({ success: true, message: "Incidencia agregada", data: turno });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

export const finalizarTodosTurnosBarrera = async (req, res) => {
  const { id_sucursal } = req.params;
  if (!id_sucursal) {
    return res.status(400).json({ error: "No se proporcionó la sucursal" });
  }
  try {
    const turnosActivos = await Turno_Barrera.findAll({
      where: { activo: true },
      include: [{ model: Barrera, where: { id_sucursal }, required: true }],
    });
    if (turnosActivos.length === 0) {
      return res.status(404).json({ error: "No se encontraron turnos activos" });
    }
    const ids = turnosActivos.map((t) => t.id);
    await Turno_Barrera.update(
      { activo: false, fecha_fin: new Date() },
      { where: { id: ids } },
    );
    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: id_sucursal,
      accion: "FINALIZAR_TODOS_TURNOS_BARRERA",
      descripcion: `Se finalizaron ${ids.length} turno(s) de barrera de la sucursal`,
      req,
    });
    return res.status(200).json({
      success: true,
      message: "Todos los turnos de barrera de la sucursal fueron finalizados",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};
