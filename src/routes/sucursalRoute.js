import express from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import {
  crearSucursal,
  obtenerSucursales,
  obtenerSucursal,
} from "../controllers/sucursalController.js";

const router = express.Router();

router
  .get("/:id", authMiddleware, sistemasMiddleware, obtenerSucursal)
  .get("/", authMiddleware, obtenerSucursales)
  .post("/", authMiddleware, sistemasMiddleware, crearSucursal);

export default router;
