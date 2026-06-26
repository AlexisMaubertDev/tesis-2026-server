import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { sistemasMiddleware } from "../middlewares/rolMiddleware";
import { crearAcarreo, getAcarreos } from "../controllers/acarreoController";

const router = express.Router();

router
  .get("/", authMiddleware, getAcarreos)
  .post("/", authMiddleware, sistemasMiddleware, crearAcarreo);
//   .put("/:id");

export default router;
