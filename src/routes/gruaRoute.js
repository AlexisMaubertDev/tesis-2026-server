import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { obtenerGruas } from "../controllers/gruaController.js";

const router = express.Router();

router.get("/", authMiddleware, obtenerGruas);

export default router;
