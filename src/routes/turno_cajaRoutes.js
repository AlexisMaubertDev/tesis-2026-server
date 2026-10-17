import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  cajeroMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  cerrarTurnoCaja,
  empezarTurnoCaja,
  obtenerTurnoCajasAbiertas,
} from "../controllers/turno_cajaController.js";

const router = express.Router();

router
  .get(
    "/cajas/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnoCajasAbiertas,
  ) //Cierres por caja
  .get(
    "/usuario/abiertas",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnoCajasAbiertas,
  )
  .get("/:apertura", authMiddleware, supervisorMiddleware, obtenerTurnoCajasAbiertas) //Cierres por fecha
  .post("/empezar_turno", authMiddleware, cajeroMiddleware, empezarTurnoCaja)
  .put("/cerrar_turno/:id", authMiddleware, cajeroMiddleware, cerrarTurnoCaja);

export default router;
