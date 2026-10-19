import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { cajeroMiddleware } from "../middlewares/rolMiddleware.js";
import {
  crearCobro,
  obtenerCobrosDeMiTurno,
  obtenerPreviewCobro,
} from "../controllers/cobroController.js";

const router = express.Router();

// Cobros del turno de caja abierto del cajero (lista del home del cajero).
router.get(
  "/mi-turno",
  authMiddleware,
  cajeroMiddleware,
  obtenerCobrosDeMiTurno,
);

// Vista previa del importe de un acarreo (tarifa vigente + estadías por reloj).
router.get(
  "/preview/:id_acarreo",
  authMiddleware,
  cajeroMiddleware,
  obtenerPreviewCobro,
);

// Registrar un cobro: sólo cajeros (o supervisor/sistemas).
router.post("/", authMiddleware, cajeroMiddleware, crearCobro);

export default router;
