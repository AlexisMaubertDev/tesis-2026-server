import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  sistemasMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  crearUsuario,
  obtenerUsuarios,
} from "../controllers/usuario.controller.js";

const router = express.Router();

router
  .get("/", authMiddleware, supervisorMiddleware, obtenerUsuarios)
  .post("/", authMiddleware, sistemasMiddleware, crearUsuario);

export default router;
