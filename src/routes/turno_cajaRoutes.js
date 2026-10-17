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
  obtenerTurnosDeCaja,
  obtenerTurnosPorFecha,
} from "../controllers/turno_cajaController.js";

const router = express.Router();

router
  .get(
    "/cajas/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosDeCaja,
  ) //Historial de turnos de la caja
  .get(
    "/usuario/abiertas",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnoCajasAbiertas,
  ) //Turnos abiertos del usuario autenticado
  .get(
    "/:apertura",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosPorFecha,
  ) //Turnos por fecha de apertura (AAAA-MM-DD)
  .post("/empezar_turno", authMiddleware, cajeroMiddleware, empezarTurnoCaja)
  .put("/cerrar_turno/:id", authMiddleware, cajeroMiddleware, cerrarTurnoCaja);

export default router;
