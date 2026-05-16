import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { Usuario } from "../models/index.js";
dotenv.config();

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(403)
      .json({ success: false, message: "Token de autenticación requerido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);

    req.user = await Usuario.findByPk(decoded.id);
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token de autenticación inválido" });
  }

  next();
};
