import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { supervisorMiddleware } from "../middlewares/rolMiddleware";
import {
  asignarGrua,
  obtenerGruasActivasPorSucursal,
} from "../controllers/turno_gruaController";

const router = express.Router();

router
  .get(
    "/sucursal:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerGruasActivasPorSucursal,
  )
  .post("/", authMiddleware, supervisorMiddleware, asignarGrua);
