import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  crearCaja,
  obtenerCajas,
  obtenerCajasSucursal,
} from "../controllers/cajaController.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";

const router = express.Router();

router
  .get("/", authMiddleware, obtenerCajas)
  .get("/sucursal/:id", authMiddleware, obtenerCajasSucursal)
  .post("/", authMiddleware, sistemasMiddleware, crearCaja);

export default router;
