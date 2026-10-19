import { Op } from "sequelize";
import sequelize from "../config/db.js";
import {
  Caja,
  Cobro,
  Turno_Caja,
  Usuario,
  Acarreo,
  Vehiculo,
} from "../models/index.js";
import { crearEntidad } from "../utils/crearEntidad.js";
import { editarEntidad } from "../utils/editarEntidad.js";
import { registrarAuditoria } from "../utils/auditoria.js";

export const empezarTurnoCaja = async (req, res) => {
  const usuario = req.user;
  const { id_caja, turno } = req.body;

  let transaction;

  try {
    const turnoCaja_previo = await Turno_Caja.findOne({
      where: {
        activo: true,
        [Op.or]: [{ id_caja }, { id_usuario: usuario.id }],
      },
    });

    if (turnoCaja_previo) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un turno de caja abierto para esta caja",
      });
    }

    const caja = await Caja.findOne({ where: { id: id_caja } });

    if (!caja) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la caja",
      });
    }

    transaction = await sequelize.transaction();

    const turnoCaja = await crearEntidad({
      modelo: Turno_Caja,
      datos: { id_caja, turno, id_usuario: usuario.id, apertura: new Date() },
      entidad: "TURNO_CAJA",
      descripcion: `Empezó el turno de ${turno} para la caja con ID ${id_caja}`,
      req,
      usuario,
      transaction,
    });

    await registrarAuditoria({
      req,
      usuario,
      accion: "INICIAR_TURNO",
      entidad: "TURNO_CAJA",
      idEntidad: turnoCaja.toJSON().id,
      descripcion: `Empezó el turno ${turno} para la caja número ${caja.numero_caja}`,
      datosNuevos: turnoCaja.toJSON(),
    });

    await transaction.commit();
    return res.status(200).json({
      success: true,
      data: {
        id: turnoCaja.toJSON().id,
        apertura: turnoCaja.toJSON().apertura,
        turno: turnoCaja.toJSON().turno,
        Caja: caja,
      },
      message: "Turno de caja empezado exitosamente",
    });
  } catch (err) {
    console.log(err);
    if (transaction) await transaction.rollback();
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// Criterio único de "turno abierto": `activo: true` (lo usan también la
// asociación `turno_caja_activo` y `cerrarTurnoCaja`, que marcan `activo: false`).
export const obtenerTurnoCajasAbiertas = async (req, res) => {
  const usuario = req.user;
  try {
    const turnoCajas = await usuario.getTurno_Cajas({
      where: { activo: true },
    });

    return res.status(200).json({
      success: true,
      data: turnoCajas,
      message: "Turnos de cajas obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const cerrarTurnoCaja = async (req, res) => {
  const { id } = req.params;
  const usuario = req.user;

  try {
    const turnoCaja = await Turno_Caja.findByPk(id);

    if (!turnoCaja) {
      return res.status(404).json({
        success: false,
        message: "No se encontró el turno de caja",
      });
    }

    const transaction = await sequelize.transaction();

    await editarEntidad({
      modelo: Turno_Caja,
      id,
      datos: { cierre: new Date(), activo: false },
      entidad: "TURNO_CAJA",
      descripcion: `Cerro el turno de ${turnoCaja.turno} para la caja con ID ${turnoCaja.id_caja}`,
      req,
      usuario,
      transaction,
    });

    await transaction.commit();
    return res.status(200).json({
      success: true,
      data: turnoCaja.toJSON(),
      message: "Turno de caja cerrado exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/cajas/:id — historial de turnos de una caja.
export const obtenerTurnosDeCaja = async (req, res) => {
  const { id } = req.params;
  try {
    const turnos = await Turno_Caja.findAll({
      where: { id_caja: id },
      order: [["apertura", "DESC"]],
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de la caja obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/cerrados — todos los turnos de caja cerrados.
export const obtenerTurnosCerrados = async (req, res) => {
  try {
    const turnos = await Turno_Caja.findAll({
      where: { activo: false },
      order: [["apertura", "DESC"]],
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de caja cerrados obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /turno_caja/:id/detalle — detalle de un turno de caja con sus cobros,
 * acarreos y vehículos.
 */
export const obtenerDetalleTurnoCaja = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Caja.findByPk(id, {
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
      ],
    });

    if (!turno) {
      return res.status(404).json({
        success: false,
        message: "Turno de caja no encontrado",
      });
    }

    const cobros = await Cobro.findAll({
      where: { id_turno_caja: id },
      order: [["fecha", "ASC"]],
      include: [{ model: Acarreo, include: [{ model: Vehiculo }] }],
    });

    const totales = cobros.reduce(
      (acc, cobro) => ({
        cantidad: acc.cantidad + 1,
        total: acc.total + Number(cobro.total || 0),
        efectivo: acc.efectivo + Number(cobro.efectivo || 0),
        mp: acc.mp + Number(cobro.mp || 0),
      }),
      { cantidad: 0, total: 0, efectivo: 0, mp: 0 },
    );

    totales.total = Math.round(totales.total * 100) / 100;
    totales.efectivo = Math.round(totales.efectivo * 100) / 100;
    totales.mp = Math.round(totales.mp * 100) / 100;

    return res.status(200).json({
      success: true,
      data: { turno, cobros, totales },
      message: "Detalle del turno obtenido exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/:apertura — turnos abiertos en una fecha (AAAA-MM-DD).
export const obtenerTurnosPorFecha = async (req, res) => {
  const { apertura } = req.params;

  const desde = new Date(`${apertura}T00:00:00`);
  const hasta = new Date(`${apertura}T23:59:59.999`);

  if (Number.isNaN(desde.getTime())) {
    return res.status(400).json({
      success: false,
      message: "La fecha debe tener el formato AAAA-MM-DD",
    });
  }

  try {
    const turnos = await Turno_Caja.findAll({
      where: { apertura: { [Op.between]: [desde, hasta] } },
      order: [["apertura", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
