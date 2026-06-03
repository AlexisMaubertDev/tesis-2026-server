import { Usuario } from "../models/index.js";
import Sucursal from "../models/Sucursal.model.js";
import bcrypt from "bcrypt";

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

export const crearUsuario = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      legajo,
      dni,
      numero_turno,
      trabaja_domingo,
      email,
      rol,
      password,
      Sucursal,
    } = req.body;

    //encripta la contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const usuario = await Usuario.create({
      nombre,
      apellido,
      legajo,
      numero_turno,
      dni,
      trabaja_domingo,
      email,
      rol,
      password: hashedPassword,
      id_sucursal: Sucursal.id,
    });

    return res.status(201).json({
      success: true,
      data: usuario,
      message: "Usuario creado exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const eliminarUsuario = async (req, res) => {
  try {
    const { legajo } = req.params;
    const usuario = await Usuario.findOne({ where: { legajo } });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: "El legajo ingresado no corresponde a ningún usuario",
      });
    }

    await usuario.destroy();

    return res.status(200).json({
      success: true,
      message: "Usuario eliminado exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
