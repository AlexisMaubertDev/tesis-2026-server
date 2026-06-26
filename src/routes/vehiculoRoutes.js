import express from "express";
import {
  ingresarVehiculoAPlaya,
  obtenerVehiculo,
  obtenerVehiculos,
} from "../controllers/vehiculoController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { playaMiddleware } from "../middlewares/rolMiddleware.js";

const router = express.Router();

router
  .post(
    "/ingresar",
    authMiddleware,
    // playaMiddleware,
    ingresarVehiculoAPlaya,
  )
  .get("/", authMiddleware, obtenerVehiculos)
  .get("/:id", authMiddleware, obtenerVehiculo);

export default router;
