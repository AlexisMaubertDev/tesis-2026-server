import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import vehiculoRoutes from "./routes/vehiculoRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/vehiculos", vehiculoRoutes);

export default app;
