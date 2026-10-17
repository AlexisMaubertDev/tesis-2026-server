import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  grueroMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  crearAcarreo,
  getAcarreos,
  getAcarreosPorPatente,
} from "../controllers/acarreoController.js";

const router = express.Router();

router
  // El detalle de acarreos por patente lo ve cualquier usuario autenticado
  // (igual que la tabla de vehículos).
  .get("/patente/:patente", authMiddleware, getAcarreosPorPatente)
  .get("/", authMiddleware, supervisorMiddleware, getAcarreos)
  .post("/", authMiddleware, grueroMiddleware, crearAcarreo);
//   .put("/:id");

export default router;
