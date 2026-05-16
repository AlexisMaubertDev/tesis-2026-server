import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { supervisorMiddleware } from "../middlewares/rolMiddleware.js";
import { obtenerUsuarios } from "../controllers/usuario.controller.js";

const router = express.Router();

router.get("/", authMiddleware, supervisorMiddleware, obtenerUsuarios);

export default router;
