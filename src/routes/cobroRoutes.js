import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { cajeroMiddleware } from "../middlewares/rolMiddleware.js";
import {
  crearCobro,
  obtenerPreviewCobro,
} from "../controllers/cobroController.js";

const router = express.Router();

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
