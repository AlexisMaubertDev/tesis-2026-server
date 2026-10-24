import express from "express";
import {
  editarVehiculo,
  eliminarVehiculo,
  generarInformeVehiculosPdf,
  ingresarVehiculoAPlaya,
  obtenerVehiculo,
  obtenerVehiculos,
} from "../controllers/vehiculoController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  playaMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";

const router = express.Router();

router
  .post("/ingresar", authMiddleware, playaMiddleware, ingresarVehiculoAPlaya)
  .get("/", authMiddleware, obtenerVehiculos)
  .get("/informe.pdf", authMiddleware, generarInformeVehiculosPdf)
  .get("/:id", authMiddleware, obtenerVehiculo)
  .put("/:id", authMiddleware, supervisorMiddleware, editarVehiculo)
  .delete("/:id", authMiddleware, supervisorMiddleware, eliminarVehiculo);

export default router;
