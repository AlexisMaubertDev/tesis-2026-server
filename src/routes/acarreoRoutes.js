import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { idempotencyMiddleware } from "../middlewares/idempotencyMiddleware.js";
import {
  grueroMiddleware,
  playaMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  agregarIncidenciaAcarreo,
  crearAcarreo,
  egresarAcarreo,
  getAcarreos,
  getAcarreosPorPatente,
  ingresarAcarreoAPlaya,
  sacarSinCargo,
} from "../controllers/acarreoController.js";

const router = express.Router();

router
  // El detalle de acarreos por patente lo ve cualquier usuario autenticado
  // (igual que la tabla de vehículos).
  .get("/patente/:patente", authMiddleware, getAcarreosPorPatente)
  .get("/", authMiddleware, supervisorMiddleware, getAcarreos)
  .post("/", authMiddleware, grueroMiddleware, idempotencyMiddleware, crearAcarreo)
  // Ingreso/egreso de playa a cargo de la barrera (playeros).
  .put(
    "/:id/ingresar",
    authMiddleware,
    playaMiddleware,
    idempotencyMiddleware,
    ingresarAcarreoAPlaya,
  )
  .put(
    "/:id/egresar",
    authMiddleware,
    playaMiddleware,
    idempotencyMiddleware,
    egresarAcarreo,
  )
  // Salida sin cargo: sólo el supervisor (o sistemas) puede autorizarla.
  .put(
    "/:id/sin-cargo",
    authMiddleware,
    supervisorMiddleware,
    idempotencyMiddleware,
    sacarSinCargo,
  )
  // Incidencia sobre el acarreo (el vehículo): sólo supervisor (o sistemas).
  .put(
    "/:id/incidencias",
    authMiddleware,
    supervisorMiddleware,
    idempotencyMiddleware,
    agregarIncidenciaAcarreo,
  );

export default router;
