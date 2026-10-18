import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { cajeroMiddleware } from "../middlewares/rolMiddleware.js";
import { crearCobro } from "../controllers/cobroController.js";

const router = express.Router();

// Registrar un cobro: sólo cajeros (o supervisor/sistemas).
router.post("/", authMiddleware, cajeroMiddleware, crearCobro);

export default router;
