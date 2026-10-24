import express from "express";

import { obtenerGruasSucursal } from "../controllers/gruaController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { supervisorMiddleware } from "../middlewares/rolMiddleware.js";
import {
  finalizarTodosLosTurnosGruasPorSucursal,
  agregarIncidencia,
  finalizarTurno,
  obtenerTurnosGrua,
  obtenerTurnosGruaDeUsuario,
  obtenerTurnosGruaDeGrua,
  obtenerDetalleTurnoGrua,
  generarInformeTurnoGruaPdf,
} from "../controllers/turno_gruaController.js";

const router = express.Router();

router
  .get("/", authMiddleware, supervisorMiddleware, obtenerTurnosGrua) //Todos los turnos de grúa
  .get(
    "/usuario/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosGruaDeUsuario,
  ) //Turnos de grúa de un usuario
  .get(
    "/grua/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosGruaDeGrua,
  ) //Historial de turnos de una grúa
  .get(
    "/:id/detalle",
    authMiddleware,
    supervisorMiddleware,
    obtenerDetalleTurnoGrua,
  ) //Detalle de un turno de grúa
  .get(
    "/:id/informe.pdf",
    authMiddleware,
    supervisorMiddleware,
    generarInformeTurnoGruaPdf,
  ) //Informe del turno de grúa en PDF
  .get(
    "/sucursal/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerGruasSucursal,
  )
  .put(
    "/finalizar/:id_sucursal",
    authMiddleware,
    supervisorMiddleware,
    finalizarTodosLosTurnosGruasPorSucursal,
  )
  .put(
    "/:id_turno_grua/incidencias",
    authMiddleware,
    supervisorMiddleware,
    agregarIncidencia,
  )
  .put(
    "/:id_turno_grua/finalizar",
    authMiddleware,
    supervisorMiddleware,
    finalizarTurno,
  );

export default router;
