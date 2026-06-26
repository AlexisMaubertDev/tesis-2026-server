import sequelize from "../config/db.js";
import Grua from "../models/Grua.model.js";
import Sucursal from "../models/Sucursal.model.js";

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
    const gruas = await Grua.findAll({ where: { id_sucursal: id } });
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
