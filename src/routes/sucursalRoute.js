import express from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import {
  crearSucursal,
  obtenerSucursales,
  obtenerSucursal,
  editarSucursal,
} from "../controllers/sucursalController.js";

const router = express.Router();

router
  .get("/:id", authMiddleware, sistemasMiddleware, obtenerSucursal)
  .get("/", authMiddleware, obtenerSucursales)
  .post("/", authMiddleware, sistemasMiddleware, crearSucursal)
  .put("/:id", authMiddleware, sistemasMiddleware, editarSucursal);

export default router;
