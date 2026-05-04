import dotenv from "dotenv";
dotenv.config();

export const playaMiddleware = (req, res, next) => {
  if (
    req.user.rol !== "PLAYERO" &&
    req.user.rol !== "SISTEMAS" &&
    req.user.rol !== "SUPERVISOR"
  ) {
    return res
      .status(403)
      .json({
        success: false,
        message: "No tenés permisos para realizar esta acción",
      });
  }
  next();
};
