import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { obtenerBarreras } from "../controllers/barreraController.js";

const router = express.Router();

router.get("/", authMiddleware, obtenerBarreras);

export default router;
