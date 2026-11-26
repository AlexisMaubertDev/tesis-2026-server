import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import { obtenerAuditorias } from "../controllers/auditoriaController.js";

const router = express.Router();

// La auditoría del sistema sólo la puede consultar el rol SISTEMAS.
router.get("/", authMiddleware, sistemasMiddleware, obtenerAuditorias);

export default router;
