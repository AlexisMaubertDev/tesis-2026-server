import rateLimit from "express-rate-limit";

// Límite general para la API: frena abuso/escaneo sin molestar el uso normal.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Demasiadas solicitudes. Probá de nuevo en unos minutos.",
  },
});

// Límite estricto para el login: mitiga la fuerza bruta por IP.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Demasiados intentos de inicio de sesión. Probá de nuevo en 15 minutos.",
  },
});
