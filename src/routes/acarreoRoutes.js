import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sistemasMiddleware } from "../middlewares/rolMiddleware.js";
import { crearAcarreo, getAcarreos } from "../controllers/acarreoController.js";

const router = express.Router();

router
  .get("/", authMiddleware, getAcarreos)
  .post("/", authMiddleware, crearAcarreo);
//   .put("/:id");

export default router;
