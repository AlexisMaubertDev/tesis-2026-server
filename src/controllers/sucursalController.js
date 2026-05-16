import { Sucursal } from "../models/index.js";

export const obtenerSucursales = async (req, res) => {
  try {
    const sucursales = await Sucursal.findAll();

    if (sucursales.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontraron sucursales",
      });
    }

    return res.status(200).json({
      success: true,
      data: sucursales,
      message: "Sucursales obtenidas exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
