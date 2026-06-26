import express from "express";
import { cerrarSesion, login } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", login).post("/logout", authMiddleware, cerrarSesion);

export default router;
