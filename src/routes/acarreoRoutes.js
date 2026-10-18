import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  grueroMiddleware,
  playaMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
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
  .post("/", authMiddleware, grueroMiddleware, crearAcarreo)
  // Ingreso/egreso de playa a cargo de la barrera (playeros).
  .put("/:id/ingresar", authMiddleware, playaMiddleware, ingresarAcarreoAPlaya)
  .put("/:id/egresar", authMiddleware, playaMiddleware, egresarAcarreo)
  // Salida sin cargo: sólo el supervisor (o sistemas) puede autorizarla.
  .put("/:id/sin-cargo", authMiddleware, supervisorMiddleware, sacarSinCargo);

export default router;
