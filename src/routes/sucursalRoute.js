import express from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { supervisorMiddleware } from "../middlewares/rolMiddleware.js";
import { obtenerSucursales } from "../controllers/sucursalController.js";

const router = express.Router();

router.get("/", authMiddleware, supervisorMiddleware, obtenerSucursales);

export default router;
