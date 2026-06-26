import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import {
  obtenerBarreras,
  crearBarrera,
  editarBarrera,
} from "../controllers/barreraController.js";

const router = express.Router();

router
  .get("/", authMiddleware, obtenerBarreras)
  .post("/", authMiddleware, sistemasMiddleware, crearBarrera)
  .put("/:id", authMiddleware, sistemasMiddleware, editarBarrera);

export default router;
