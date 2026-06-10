import express from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  sistemasMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import {
  crearSucursal,
  obtenerSucursales,
} from "../controllers/sucursalController.js";

const router = express.Router();

router
  .get("/", authMiddleware, supervisorMiddleware, obtenerSucursales)
  .post("/", authMiddleware, sistemasMiddleware, crearSucursal);

export default router;
