import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  sistemasMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  crearUsuario,
  obtenerUsuarios,
  eliminarUsuario,
  obtenerGrueros,
} from "../controllers/usuario.controller.js";

const router = express.Router();

router
  .get("/", authMiddleware, supervisorMiddleware, obtenerUsuarios)
  .get("/grueros", authMiddleware, supervisorMiddleware, obtenerGrueros)
  .post("/", authMiddleware, sistemasMiddleware, crearUsuario)
  .delete("/:legajo", authMiddleware, sistemasMiddleware, eliminarUsuario);

export default router;
