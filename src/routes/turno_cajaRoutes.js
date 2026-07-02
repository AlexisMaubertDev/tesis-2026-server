import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  empezarTurnoCaja,
  obtenerTurnoCajasAbiertas,
} from "../controllers/turno_cajaController.js";

const router = express.Router();

router
  .get("/cajas/:id", authMiddleware, obtenerTurnoCajasAbiertas) //Cierres por caja
  .get("/usuario/abiertas", authMiddleware, obtenerTurnoCajasAbiertas)
  .get("/:apertura", authMiddleware, obtenerTurnoCajasAbiertas) //Cierres por fecha
  .post("/empezar_turno", authMiddleware, empezarTurnoCaja)
  .post("/cerrar_turno", authMiddleware, obtenerTurnoCajasAbiertas); //Cerrar turno

export default router;
