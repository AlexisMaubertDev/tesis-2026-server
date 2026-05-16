import { Usuario } from "../models/index.js";
import Sucursal from "../models/Sucursal.model.js";

export const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: {
        exclude: ["password", "id_sucursal", "intentos_restantes", "id"],
      },
      include: { model: Sucursal, attributes: ["nombre"] },
    });

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontraron usuarios",
      });
    }

    return res.status(200).json({
      success: true,
      data: usuarios,
      message: "Usuarios obtenidos exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
