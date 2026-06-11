import sequelize from "../config/db.js";
import Barrera from "../models/Barrera.model.js";
import Sucursal from "../models/Sucursal.model.js";

export const obtenerBarreras = async (req, res) => {
  try {
    const barreras = await Barrera.findAll({ include: { model: Sucursal } });

    if (barreras.length === 0) {
      return res.status(404).json({ error: "No se encontraron barreras" });
    }
    console.log(barreras);
    return res.status(200).json({
      success: true,
      data: barreras,
      message: "Barreras obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
