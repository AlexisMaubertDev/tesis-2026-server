import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  cajeroMiddleware,
  supervisorMiddleware,
  sistemasMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  cerrarTurnoCaja,
  empezarTurnoCaja,
  obtenerTurnoCajasAbiertas,
  obtenerTurnosDeCaja,
  obtenerTurnosPorFecha,
  obtenerTurnosCerrados,
  obtenerDetalleTurnoCaja,
  obtenerTurnosDeUsuario,
  agregarIncidenciaTurnoCaja,
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
    "/usuario/:id",
    authMiddleware,
    cajeroMiddleware,
    obtenerTurnosDeUsuario,
  ) //Todos los turnos de caja de un usuario
  .get(
    "/cerrados",
    authMiddleware,
    cajeroMiddleware,
    obtenerTurnosCerrados,
  ) //Todos los turnos de caja cerrados
  .get(
    "/:id/detalle",
    authMiddleware,
    cajeroMiddleware,
    obtenerDetalleTurnoCaja,
  ) //Detalle de un turno de caja
  .get(
    "/:apertura",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosPorFecha,
  ) //Turnos por fecha de apertura (AAAA-MM-DD)
  .post("/empezar_turno", authMiddleware, cajeroMiddleware, empezarTurnoCaja)
  .put("/cerrar_turno/:id", authMiddleware, cajeroMiddleware, cerrarTurnoCaja)
  .put(
    "/:id/incidencias",
    authMiddleware,
    supervisorMiddleware,
    agregarIncidenciaTurnoCaja,
  );

export default router;
