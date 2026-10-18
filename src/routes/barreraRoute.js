import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware, supervisorMiddleware } from "../middlewares/rolMiddleware.js";
import {
  obtenerBarreras,
  crearBarrera,
  editarBarrera,
  obtenerBarrerasSucursal,
} from "../controllers/barreraController.js";
import {
  asignarBarrera,
  finalizarTurnoBarrera,
  agregarIncidenciasBarrera,
  finalizarTodosTurnosBarrera,
} from "../controllers/turno_barreraController.js";

const router = express.Router();

router
  .get("/", authMiddleware, obtenerBarreras)
  .get("/sucursal/:id", authMiddleware, supervisorMiddleware, obtenerBarrerasSucursal)
  .post("/", authMiddleware, sistemasMiddleware, crearBarrera)
  .put("/:id", authMiddleware, sistemasMiddleware, editarBarrera)
  .post("/asignar", authMiddleware, supervisorMiddleware, asignarBarrera)
  .put("/finalizarTodos/:id_sucursal", authMiddleware, supervisorMiddleware, finalizarTodosTurnosBarrera)
  .put("/turno/:id/finalizar", authMiddleware, supervisorMiddleware, finalizarTurnoBarrera)
  .put("/turno/:id/incidencias", authMiddleware, supervisorMiddleware, agregarIncidenciasBarrera);

export default router;