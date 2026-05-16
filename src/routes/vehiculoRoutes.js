import express from "express";
import { ingresarVehiculoAPlaya } from "../controllers/vehiculoController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { playaMiddleware } from "../middlewares/rolMiddleware.js";

const router = express.Router();

router.post(
  "/ingresar",
  authMiddleware,
  // playaMiddleware,
  ingresarVehiculoAPlaya,
);

export default router;
