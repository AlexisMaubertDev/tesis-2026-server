import express from "express";

import { obtenerGruasSucursal } from "../controllers/gruaController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { supervisorMiddleware } from "../middlewares/rolMiddleware.js";
import {
  finalizarTodosLosTurnosGruasPorSucursal,
  agregarIncidencia,
  finalizarTurno,
} from "../controllers/turno_gruaController.js";

const router = express.Router();

router
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
