import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import {
  crearTarifa,
  obtenerTarifaVigente,
  obtenerTarifas,
} from "../controllers/tarifaController.js";

const router = express.Router();

// Leer las tarifas: cualquier usuario autenticado (el cajero necesita la
// vigente para calcular el cobro). Configurarlas: sólo Sistemas (CU20).
router
  .get("/", authMiddleware, obtenerTarifas)
  .get("/vigente", authMiddleware, obtenerTarifaVigente)
  .post("/", authMiddleware, sistemasMiddleware, crearTarifa);

export default router;
