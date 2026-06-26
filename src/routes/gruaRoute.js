import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import {
  crearGrua,
  obtenerGruas,
  obtenerGruasSucursal,
} from "../controllers/gruaController.js";

const router = express.Router();

router
  .get("/", authMiddleware, obtenerGruas)
  .get("/sucursal/:id", authMiddleware, obtenerGruasSucursal)
  .post("/", authMiddleware, sistemasMiddleware, crearGrua);

export default router;
