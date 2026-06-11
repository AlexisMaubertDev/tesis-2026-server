import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { obtenerCajas } from "../controllers/cajaController.js";

const router = express.Router();

router.get("/", authMiddleware, obtenerCajas);

export default router;
