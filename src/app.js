import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import vehiculoRoutes from "./routes/vehiculoRoutes.js";
import sucursalRoutes from "./routes/sucursalRoute.js";
import usuarioRoutes from "./routes/usuarioRoute.js";
import cajaRoutes from "./routes/cajaRoute.js";
import gruaRoutes from "./routes/gruaRoute.js";
import barreraRoutes from "./routes/barreraRoute.js";
import turnoCajaRoutes from "./routes/turno_cajaRoutes.js";
import turnoGruaRoutes from "./routes/turno_gruaRoutes.js";
import acarreoRoutes from "./routes/acarreoRoutes.js";
import cobroRoutes from "./routes/cobroRoutes.js";
import tarifaRoutes from "./routes/tarifaRoutes.js";
import informeRoutes from "./routes/informeRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import { apiRateLimiter } from "./middlewares/rateLimitMiddleware.js";

dotenv.config();

const app = express();

// Vercel (y cualquier proxy inverso) agrega X-Forwarded-For. Sin esto,
// express-rate-limit ve la IP del proxy y todos los usuarios comparten el
// mismo límite (el login permite 10 intentos cada 15 minutos).
app.set("trust proxy", 1);

// Orígenes permitidos para CORS (lista separada por comas en CORS_ORIGINS).
// En producción el front web vive en Vercel; en local, el dev server de Vite.
const origenWebProduccion = "https://tesis-2026-web.vercel.app";
const origenesPorDefecto =
  process.env.NODE_ENV === "production"
    ? origenWebProduccion
    : "http://localhost:5173";

const origenesPermitidos = (process.env.CORS_ORIGINS ?? origenesPorDefecto)
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);

// Si CORS_ORIGINS quedó con el valor local (o no incluye la web), el preflight
// del front de producción fallaría. En Vercel agregamos siempre ese origen.
if (process.env.VERCEL && !origenesPermitidos.includes(origenWebProduccion)) {
  origenesPermitidos.push(origenWebProduccion);
}

app.use(
  cors({
    origin(origen, callback) {
      // Sin header Origin (apps nativas, curl, mismo origen) siempre pasa.
      // El navegador sólo completa la petición si el origen está en la lista.
      if (!origen || origenesPermitidos.includes(origen)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);
app.use(express.json());
app.use("/api", apiRateLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/vehiculos", vehiculoRoutes);
app.use("/api/sucursales", sucursalRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/cajas", cajaRoutes);
app.use("/api/gruas", gruaRoutes);
app.use("/api/barreras", barreraRoutes);
app.use("/api/turno_caja", turnoCajaRoutes);
app.use("/api/turno_grua", turnoGruaRoutes);
app.use("/api/acarreos", acarreoRoutes);
app.use("/api/cobros", cobroRoutes);
app.use("/api/tarifas", tarifaRoutes);
app.use("/api/informes", informeRoutes);

console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === "development") {
  app.use("/api/test", testRoutes);
}

export default app;
