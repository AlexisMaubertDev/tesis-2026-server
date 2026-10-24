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
  obtenerMiTurnoBarrera,
  obtenerTurnosBarrera,
  obtenerTurnosBarreraDeUsuario,
  obtenerTurnosBarreraDeBarrera,
  obtenerDetalleTurnoBarrera,
  generarInformeTurnoBarreraPdf,
} from "../controllers/turno_barreraController.js";

const router = express.Router();

router
  .get("/", authMiddleware, obtenerBarreras)
  .get("/mi-turno", authMiddleware, obtenerMiTurnoBarrera)
  .get(
    "/turnos",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosBarrera,
  ) //Todos los turnos de barrera
  .get(
    "/turnos/usuario/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosBarreraDeUsuario,
  ) //Turnos de barrera de un playero
  .get(
    "/turnos/barrera/:id",
    authMiddleware,
    supervisorMiddleware,
    obtenerTurnosBarreraDeBarrera,
  ) //Historial de turnos de una barrera
  .get(
    "/turnos/:id/detalle",
    authMiddleware,
    supervisorMiddleware,
    obtenerDetalleTurnoBarrera,
  ) //Detalle de un turno de barrera
  .get(
    "/turnos/:id/informe.pdf",
    authMiddleware,
    supervisorMiddleware,
    generarInformeTurnoBarreraPdf,
  ) //Informe del turno de barrera en PDF
  .get("/sucursal/:id", authMiddleware, supervisorMiddleware, obtenerBarrerasSucursal)
  .post("/", authMiddleware, sistemasMiddleware, crearBarrera)
  .put("/:id", authMiddleware, sistemasMiddleware, editarBarrera)
  .post("/asignar", authMiddleware, supervisorMiddleware, asignarBarrera)
  .put("/finalizarTodos/:id_sucursal", authMiddleware, supervisorMiddleware, finalizarTodosTurnosBarrera)
  .put("/turno/:id/finalizar", authMiddleware, supervisorMiddleware, finalizarTurnoBarrera)
  .put("/turno/:id/incidencias", authMiddleware, supervisorMiddleware, agregarIncidenciasBarrera);

export default router;