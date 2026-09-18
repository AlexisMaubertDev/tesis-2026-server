import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  sistemasMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  asignarGrua,
  crearGrua,
  obtenerGruas,
  obtenerGruasSucursal,
} from "../controllers/gruaController.js";

const router = express.Router();

router
  .get("/", authMiddleware, obtenerGruas)
  .get("/sucursal/:id", authMiddleware, obtenerGruasSucursal)
  .post("/asignar", authMiddleware, supervisorMiddleware, asignarGrua)
  .post("/", authMiddleware, sistemasMiddleware, crearGrua);

export default router;
