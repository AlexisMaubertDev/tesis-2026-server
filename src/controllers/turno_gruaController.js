import { Op } from "sequelize";
import sequelize from "../config/db";
import { Grua, Turno_Grua, Usuario } from "../models";

export const asignarGrua = async (req, res) => {
  const {
    id_chofer,
    id_enganchador,
    id_grua,
    turno,
    nombre_agente,
    numero_agente,
  } = req.body;
  const supervisor = req.user;

  try {
    const transaction = await sequelize.transaction();

    if (!turno || nombre_agente.trim() === "" || !numero_agente) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }
    const grua = await Grua.findByPk(id_grua);

    if (!grua) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No se encontró la grúa",
      });
    }

    if (grua.estado !== "DISPONIBLE") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "La grúa seleccionada no esta disponible",
      });
    }

    const chofer = await Usuario.findByPk(id_chofer);

    if (!chofer) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No se encontró al chofer asignado",
      });
    }
    const enganchador = await Usuario.findByPk(id_enganchador);

    if (!enganchador) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No se encontró al enganchador asignado",
      });
    }

    const turnoAbierto = await Turno_Grua.findOne({
      where: {
        fecha_cierre: null,
        [Op.or]: [
          { id_grua: grua.id },

          { id_chofer: chofer.id },
          { id_enganchador: chofer.id },

          { id_chofer: enganchador.id },
          { id_enganchador: enganchador.id },
        ],
      },
      transaction,
    });

    if (turnoAbierto) {
      let message = "";

      if (turnoAbierto.id_grua === grua.id) {
        message = "La grúa ya tiene un turno abierto.";
      } else if (
        turnoAbierto.id_chofer === chofer.id ||
        turnoAbierto.id_enganchador === chofer.id
      ) {
        message = "El chofer ya tiene un turno abierto.";
      } else {
        message = "El enganchador ya tiene un turno abierto.";
      }

      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message,
      });
    }
    const nuevoTurno = await Turno_Grua.create(
      {
        id_grua: grua.id,
        id_chofer: chofer.id,
        id_enganchador: enganchador.id,
        turno,
        nombre_agente,
        numero_agente,
        id_supervisor: supervisor.id,
        fecha_inicio: new Date(),
        fecha_fin: null,
      },
      { transaction },
    );
    await grua.update(
      {
        estado: "EN_SERVICIO",
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Turno de grúa creado correctamente.",
      data: nuevoTurno,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al asignar turno" });
  }
};

export const obtenerGruasActivasPorSucursal = async (req, res) => {
  const usuario = req.user;

  try {
    const gruasActivas = await Turno_Grua.findAll({
      where: {
        fecha_fin: null,
      },
      include: [
        {
          model: Grua,
          where: {
            id_sucursal: usuario.id_sucursal,
          },
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Grúas activas obtenidas correctamente",
      data: gruasActivas,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error en el servidor",
    });
  }
};

export const obtenerTurnos = async (req, res) => {
  try {
    const turnos = await Turno_Grua.findAll({
      order: [["fecha_inicio", "ASC"]],
    });

    if (turnos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontraros turnos",
      });
    }

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos obtenidos correctamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error en el servidor",
    });
  }
};
