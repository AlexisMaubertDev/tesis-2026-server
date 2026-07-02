import sequelize from "../config/db.js";
import { Caja, Turno_Caja } from "../models/index.js";
import { crearEntidad } from "../utils/crearEntidad.js";

export const empezarTurnoCaja = async (req, res) => {
  const usuario = req.user;
  const { id_caja, turno } = req.body;

  try {
    const turnoCaja_previo = await Turno_Caja.findOne({
      where: { id_caja, cierre: null },
    });

    if (turnoCaja_previo) {
      return res.status(404).json({
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

    const transaction = await sequelize.transaction();

    const turnoCaja = await crearEntidad({
      modelo: Turno_Caja,
      datos: { id_caja, turno, id_usuario: usuario.id, apertura: new Date() },
      entidad: "TURNO_CAJA",
      descripcion: `Empezó el turno de ${turno} para la caja con ID ${id_caja}`,
      req,
      usuario,
      transaction,
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
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const obtenerTurnoCajasAbiertas = async (req, res) => {
  const usuario = req.user;
  try {
    const turnoCajas = await usuario.getTurno_Cajas({
      where: { cierre: null },
    });

    if (turnoCajas.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontraron turnos de cajas",
      });
    }

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
