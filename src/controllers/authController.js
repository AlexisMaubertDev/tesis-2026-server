import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Usuario } from "../models/index.js";

import dotenv from "dotenv";
import { registrarAuditoria } from "../utils/auditoria.js";
dotenv.config();

export const login = async (req, res) => {
  try {
    const { dni, password } = req.body;
    const user = await Usuario.findOne({ where: { dni }, include: "Sucursal" });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "El DNI ingresado no corresponde a ningún usuario",
      });
    }

    if (user.bloqueado) {
      return res.status(403).json({
        success: false,
        message: "Tu cuenta ha sido bloqueada. Por favor, contactá a sistemas.",
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      user.intentos_restantes -= 1;

      if (user.intentos_restantes === 0) {
        user.bloqueado = true;
        await user.save();
        return res.status(400).json({
          success: false,
          message:
            "Has agotado tus intentos de inicio de sesión. Tu cuenta ha sido bloqueada.",
        });
      }
      await user.save();
      return res.status(400).json({
        success: false,
        message:
          "La contraseña ingresada es incorrecta, te quedan " +
          user.intentos_restantes +
          " intentos.",
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_TOKEN, {
      expiresIn: "7d",
    });

    user.intentos_restantes = 3;
    await user.save();
    await registrarAuditoria({
      req,
      usuario: user,
      accion: "LOGIN",
      entidad: "USUARIO",
      idEntidad: user.id,
      descripcion: "Inicio de sesión",
    });
    res.status(200).json({
      success: true,
      data: {
        usuario: user,
        token,
      },
      message: "Inicio de sesión exitoso",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error al iniciar sesión" });
  }
};

export const cerrarSesion = async (req, res) => {
  try {
    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "LOGOUT",
      entidad: "USUARIO",
      idEntidad: req.user.id,
      descripcion: "Cierre de sesión",
    });
    res.status(200).json({ success: true, message: "Sesión cerrada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al cerrar sesión" });
  }
};
