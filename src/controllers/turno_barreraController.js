import sequelize from "../config/db.js";
import {
  Acarreo,
  Barrera,
  Sucursal,
  Turno_Barrera,
  Turno_Barrera_Usuario,
  Usuario,
  Vehiculo,
} from "../models/index.js";
import { Op } from "sequelize";
import { registrarAuditoria } from "../utils/auditoria.js";

/** Barrera del turno con su sucursal. */
const barreraDelTurno = {
  model: Barrera,
  include: [{ model: Sucursal, attributes: ["id", "nombre", "direccion"] }],
};

/** Playeros asignados al turno (tabla intermedia + usuario). */
const usuariosAsignadosDelTurno = (extra = {}) => ({
  model: Turno_Barrera_Usuario,
  as: "usuarios_asignados",
  include: [
    {
      model: Usuario,
      attributes: ["id", "nombre", "apellido", "legajo", "rol", "numero_turno"],
    },
  ],
  ...extra,
});

/**
 * Agrega a cada turno sus "movimientos": cuántos vehículos entraron y cuántos
 * salieron por esa barrera dentro de la ventana del turno (inicio → fin o
 * ahora). Se cuenta sobre todos los acarreos de la barrera, no sólo los que
 * ingresaron en ese turno, porque un auto puede haber entrado antes y salir
 * durante este turno.
 */
const conMovimientos = async (turnos) => {
  const barreraIds = [...new Set(turnos.map((t) => t.id_barrera))];

  const turnosDeLasBarreras = await Turno_Barrera.findAll({
    where: { id_barrera: barreraIds },
    attributes: ["id", "id_barrera"],
    include: [
      { model: Acarreo, attributes: ["id", "fecha_ingreso", "fecha_egreso"] },
    ],
  });

  // Acarreos de cada barrera (de todos sus turnos).
  const acarreosPorBarrera = new Map();
  turnosDeLasBarreras.forEach((tb) => {
    const plain = tb.get({ plain: true });
    const lista = acarreosPorBarrera.get(plain.id_barrera) ?? [];
    lista.push(...(plain.Acarreos ?? []));
    acarreosPorBarrera.set(plain.id_barrera, lista);
  });

  return turnos.map((turno) => {
    const plain = turno.get({ plain: true });
    const inicio = new Date(plain.fecha_inicio).getTime();
    const fin = plain.fecha_fin
      ? new Date(plain.fecha_fin).getTime()
      : Date.now();
    const enVentana = (fecha) => {
      if (!fecha) return false;
      const t = new Date(fecha).getTime();
      return t >= inicio && t <= fin;
    };
    const deLaBarrera = acarreosPorBarrera.get(plain.id_barrera) ?? [];

    return {
      ...plain,
      movimientos: {
        entradas: deLaBarrera.filter((a) => enVentana(a.fecha_ingreso)).length,
        salidas: deLaBarrera.filter((a) => enVentana(a.fecha_egreso)).length,
      },
    };
  });
};

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

// GET /barreras/turnos — todos los turnos de barrera (historial), con su
// barrera, los playeros asignados y la cantidad de acarreos del turno.
export const obtenerTurnosBarrera = async (req, res) => {
  try {
    const turnos = await Turno_Barrera.findAll({
      order: [["fecha_inicio", "DESC"]],
      include: [
        barreraDelTurno,
        usuariosAsignadosDelTurno(),
        { model: Acarreo, attributes: ["id", "fecha_egreso"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: await conMovimientos(turnos),
      message: "Turnos de barrera obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /barreras/turnos/usuario/:id — turnos de barrera en los que un playero
// estuvo asignado.
export const obtenerTurnosBarreraDeUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Barrera.findAll({
      order: [["fecha_inicio", "DESC"]],
      include: [
        barreraDelTurno,
        usuariosAsignadosDelTurno({ where: { id_usuario: id }, required: true }),
        { model: Acarreo, attributes: ["id", "fecha_egreso"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: await conMovimientos(turnos),
      message: "Turnos de barrera del usuario obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /barreras/turnos/:id/detalle — detalle de un turno de barrera: la
 * barrera, los playeros asignados, las fechas y el resumen de ingresos/egresos
 * con los acarreos ingresados a la playa durante el turno.
 */
export const obtenerDetalleTurnoBarrera = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Barrera.findByPk(id, {
      include: [barreraDelTurno, usuariosAsignadosDelTurno()],
    });

    if (!turno) {
      return res.status(404).json({
        success: false,
        message: "Turno de barrera no encontrado",
      });
    }

    // Acarreos que ingresaron a la playa en este turno (sirven para el estado
    // actual de los vehículos del turno).
    const acarreos = await Acarreo.findAll({
      where: { id_turno_barrera: id },
      order: [["fecha_acarreo", "ASC"]],
      include: [{ model: Vehiculo }],
    });

    // Un egreso cuenta para el turno si ocurrió dentro de su ventana.
    const inicio = new Date(turno.fecha_inicio).getTime();
    const fin = turno.fecha_fin
      ? new Date(turno.fecha_fin).getTime()
      : Date.now();
    const enVentana = (fecha) => {
      if (!fecha) return false;
      const t = new Date(fecha).getTime();
      return t >= inicio && t <= fin;
    };

    // Movimientos de la barrera durante la ventana del turno: una entrada por
    // cada vehículo que ingresó y una salida por cada uno que egresó (aunque
    // haya entrado en un turno anterior).
    const turnosDeLaBarrera = await Turno_Barrera.findAll({
      where: { id_barrera: turno.id_barrera },
      attributes: ["id"],
    });

    const acarreosDeLaBarrera = await Acarreo.findAll({
      where: {
        id_turno_barrera: { [Op.in]: turnosDeLaBarrera.map((t) => t.id) },
      },
      include: [{ model: Vehiculo }],
    });

    const movimientos = [
      ...acarreosDeLaBarrera
        .filter((a) => enVentana(a.fecha_ingreso))
        .map((a) => ({
          id: `${a.id}-entrada`,
          tipo: "ENTRADA",
          fecha: a.fecha_ingreso,
          acarreo: a,
        })),
      ...acarreosDeLaBarrera
        .filter((a) => enVentana(a.fecha_egreso))
        .map((a) => ({
          id: `${a.id}-salida`,
          tipo: "SALIDA",
          fecha: a.fecha_egreso,
          acarreo: a,
        })),
    ].sort((x, y) => new Date(x.fecha).getTime() - new Date(y.fecha).getTime());

    const porEstado = acarreos.reduce(
      (acc, acarreo) => ({
        ingresados: acc.ingresados + (acarreo.estado === "INGRESADO" ? 1 : 0),
        cobrados: acc.cobrados + (acarreo.estado === "COBRADO" ? 1 : 0),
        egresados: acc.egresados + (acarreo.estado === "EGRESADO" ? 1 : 0),
        sinCargo: acc.sinCargo + (acarreo.estado === "SIN_CARGO" ? 1 : 0),
      }),
      { ingresados: 0, cobrados: 0, egresados: 0, sinCargo: 0 },
    );

    const totales = {
      ingresos: movimientos.filter((m) => m.tipo === "ENTRADA").length,
      egresos: movimientos.filter((m) => m.tipo === "SALIDA").length,
      // Autos que hoy siguen en la playa (estado INGRESADO).
      enPlaya: porEstado.ingresados,
      porEstado,
    };

    return res.status(200).json({
      success: true,
      data: { turno, acarreos, movimientos, totales },
      message: "Detalle del turno de barrera obtenido exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /barreras/turnos/barrera/:id — todos los turnos de una barrera
// (historial) con sus playeros y acarreos.
export const obtenerTurnosBarreraDeBarrera = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Barrera.findAll({
      where: { id_barrera: id },
      order: [["fecha_inicio", "DESC"]],
      include: [
        barreraDelTurno,
        usuariosAsignadosDelTurno(),
        { model: Acarreo, attributes: ["id", "fecha_egreso"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: await conMovimientos(turnos),
      message: "Turnos de la barrera obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
