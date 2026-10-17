import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  grueroMiddleware,
  supervisorMiddleware,
} from "../middlewares/rolMiddleware.js";
import { crearAcarreo, getAcarreos } from "../controllers/acarreoController.js";

const router = express.Router();

router
  .get("/", authMiddleware, supervisorMiddleware, getAcarreos)
  .post("/", authMiddleware, grueroMiddleware, crearAcarreo);
//   .put("/:id");

export default router;
