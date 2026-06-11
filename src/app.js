import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import vehiculoRoutes from "./routes/vehiculoRoutes.js";
import sucursalRoutes from "./routes/sucursalRoute.js";
import usuarioRoutes from "./routes/usuarioRoute.js";
import cajaRoutes from "./routes/cajaRoute.js";
import gruaRoutes from "./routes/gruaRoute.js";
import barreraRoutes from "./routes/barreraRoute.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/vehiculos", vehiculoRoutes);
app.use("/api/sucursales", sucursalRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/cajas", cajaRoutes);
app.use("/api/gruas", gruaRoutes);
app.use("/api/barreras", barreraRoutes);

export default app;
