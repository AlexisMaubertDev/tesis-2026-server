import dotenv from "dotenv";
import { Usuario } from "../models/index.js";
dotenv.config();

export const playaMiddleware = (req, res, next) => {
  if (
    req.user.rol !== "PLAYERO" &&
    req.user.rol !== "SISTEMAS" &&
    req.user.rol !== "SUPERVISOR"
  ) {
    return res.status(403).json({
      success: false,
      message: "No tenés permisos para realizar esta acción",
    });
  }
  next();
};

export const supervisorMiddleware = (req, res, next) => {
  const usuario = req.user;

  if (usuario.rol !== "SISTEMAS" && usuario.rol !== "SUPERVISOR") {
    return res.status(403).json({
      success: false,
      message: "No tenés permisos para realizar esta acción",
    });
  }
  next();
};

export const sistemasMiddleware = (req, res, next) => {
  if (req.user.rol !== "SISTEMAS") {
    return res.status(403).json({
      success: false,
      message: "No tenés permisos para realizar estaacción",
    });
  }
  next();
};
