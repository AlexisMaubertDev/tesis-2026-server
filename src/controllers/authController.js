import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Usuario } from "../models/index.js";

import dotenv from "dotenv";
dotenv.config();

export const login = async (req, res) => {
  const { dni, password } = req.body;

  const user = await Usuario.findOne({ where: { dni } });

  if (!user) {
    return res.json({
      success: false,
      message: "El DNI ingresado no corresponde a ningún usuario",
    });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    user.intentos_restantes -= 1;

    if (user.intentos_restantes === 0) {
      user.bloqueado = true;
      await user.save();
      return res.json({
        success: false,
        message:
          "Has agotado tus intentos de inicio de sesión. Tu cuenta ha sido bloqueada.",
      });
    }
    await user.save();
    return res.json({
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

  res.json({
    success: true,
    data: {
      user,
      token,
    },
    message: "Inicio de sesión exitoso",
  });
};
