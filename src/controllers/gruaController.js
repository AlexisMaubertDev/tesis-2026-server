import sequelize from "../config/db.js";
import Grua from "../models/Grua.model.js";
import Sucursal from "../models/Sucursal.model.js";

export const obtenerGruas = async (req, res) => {
  try {
    const gruas = await Grua.findAll({ include: { model: Sucursal } });

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
