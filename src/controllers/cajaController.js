import sequelize from "../config/db.js";
import { Caja, Sucursal } from "../models/index.js";

export const obtenerCajas = async (req, res) => {
  try {
    const cajas = await Caja.findAll({ include: { model: Sucursal } });

    if (cajas.length === 0) {
      return res.status(404).json({ error: "No se encontraron cajas" });
    }

    return res.status(200).json({
      success: true,
      data: cajas,
      message: "Cajas obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener las cajas" });
  }
};
