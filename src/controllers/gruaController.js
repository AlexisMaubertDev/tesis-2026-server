import { Op } from "sequelize";
import sequelize from "../config/db.js";
import Grua from "../models/Grua.model.js";
import Sucursal from "../models/Sucursal.model.js";
import Turno_Grua from "../models/TurnoGrua.model.js";
import Usuario from "../models/Usuario.model.js";
import { registrarAuditoria } from "../utils/auditoria.js";

export const obtenerGruas = async (req, res) => {
  try {
    const gruas = await Grua.findAll({
      include: { model: Sucursal },
      order: [["numero", "ASC"]],
    });

    if (gruas.length === 0) {
      return res.status(404).json({ error: "No se encontraron gruas" });
    }

    return res.status(200).json({
      success: true,
      data: gruas,
      message: "Gruas obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export const crearGrua = async (req, res) => {
  const { patente, modelo, numero } = req.body;
  const id_sucursal = req.body.Sucursal.id;
  try {
    const transaction = await sequelize.transaction();

    const grua = await Grua.findOne({ where: { patente }, transaction });

    if (grua) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Ya existe una grúa con esa patente",
      });
    }

    const gruaCreada = await Grua.create(
      { patente, modelo, numero, id_sucursal, estado: "DISPONIBLE" },
      { transaction },
    );

    if (!gruaCreada) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "CREAR",
      entidad: "GRUA",
      idEntidad: gruaCreada.id,
      descripcion: `Grua ${gruaCreada.patente} creada exitosamente`,
      despues: gruaCreada,
    });

    await transaction.commit();
    return res.status(201).json({
      success: true,
      data: gruaCreada,
      message: "Grua creada exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const obtenerGruasSucursal = async (req, res) => {
  try {
    const { id } = req.params;

    const gruas = await Grua.findAll({
      where: { id_sucursal: id },
      order: [["numero", "ASC"]],
      include: [
        {
          model: Sucursal,
          attributes: ["id", "nombre"],
        },
        {
          model: Turno_Grua,
          as: "turno_grua_activo",
          required: false,
          include: [
            {
              model: Usuario,
              as: "chofer",
              attributes: ["id", "nombre", "apellido", "legajo"],
            },
            {
              model: Usuario,
              as: "enganchador",
              attributes: ["id", "nombre", "apellido", "legajo"],
            },
            {
              model: Usuario,
              as: "supervisor",
              attributes: ["id", "nombre", "apellido", "legajo"],
            },
          ],
        },
      ],
    });

    if (!gruas || gruas.length === 0) {
      return res
        .status(404)
        .json({ error: "No se encontraron grúas para esta sucursal" });
    }

    return res.status(200).json({
      success: true,
      data: gruas,
      message: "Grúas obtenidas exitosamente",
    });
  } catch (error) {
    console.error("Error al obtener grúas de la sucursal:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const asignarGrua = async (req, res) => {
  const {
    id_chofer,
    id_enganchador,
    turno,
    observaciones,
    nombre_agente,
    numero_agente,
  } = req.body;

  const id_grua = req.body.Grua?.id || req.body.id_grua;
  const id_supervisor = req.user.id;

  if (!id_grua || !id_chofer || !id_enganchador || !turno) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  if (id_chofer === id_enganchador) {
    return res
      .status(400)
      .json({ error: "El chofer y el enganchador no pueden ser el mismo" });
  }

  let transaction;

  try {
    transaction = await sequelize.transaction();

    const grua = await Grua.findByPk(id_grua, { transaction });
    if (!grua) {
      await transaction.rollback();
      return res.status(404).json({ error: "Grúa no encontrada" });
    }

    if (grua.estado !== "DISPONIBLE") {
      await transaction.rollback();
      return res.status(400).json({ error: "La grúa no está disponible" });
    }

    const prevData = grua;

    const turnoGruaExistente = await Turno_Grua.findOne({
      where: { id_grua, activo: true },
      transaction,
    });

    if (turnoGruaExistente) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "La grúa ya tiene un turno activo" });
    }

    const chofer = await Usuario.findByPk(id_chofer, { transaction });
    if (!chofer) {
      await transaction.rollback();
      return res.status(404).json({ error: "Chofer no encontrado" });
    }

    const enganchador = await Usuario.findByPk(id_enganchador, { transaction });
    if (!enganchador) {
      await transaction.rollback();
      return res.status(404).json({ error: "Enganchador no encontrado" });
    }

    const usuarioConTurnoActivo = await Turno_Grua.findOne({
      where: {
        activo: true,
        [Op.or]: [
          { id_chofer: [id_chofer, id_enganchador] },
          { id_enganchador: [id_chofer, id_enganchador] },
        ],
      },
      transaction,
    });

    if (usuarioConTurnoActivo) {
      await transaction.rollback();
      return res.status(400).json({
        error: "El chofer o el enganchador ya se encuentran en un turno activo",
      });
    }

    const turnoGrua = await Turno_Grua.create(
      {
        id_grua,
        id_chofer,
        id_enganchador,
        id_supervisor,
        turno,
        observaciones,
        nombre_agente,
        numero_agente,
        activo: true,
        fecha_inicio: new Date(),
      },
      { transaction },
    );

    await grua.update({ estado: "EN_SERVICIO" }, { transaction });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "ASIGNAR",
      entidad: "GRUA",
      idEntidad: grua.id,
      descripcion: `El supervisor ${req.user.nombre} ${req.user.apellido} asignó la grúa ${grua.patente} al turno ${turno} con el chofer ${chofer.nombre} ${chofer.apellido} y enganchador ${enganchador.nombre} ${enganchador.apellido}`,
      antes: prevData,
      despues: grua,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Grúa asignada exitosamente",
      data: turnoGrua,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error al asignar grúa:", error);
    return res.status(500).json({ error: error.message });
  }
};
