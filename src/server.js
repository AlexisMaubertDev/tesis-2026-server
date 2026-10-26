import app from "./app.js";
import sequelize from "./config/db.js";

const PORT = Number(process.env.PORT) || 1337;

const start = async () => {
  try {
    // sequelize.sync() fuerza una segunda pasada con `alter: true` (por las
    // referencias cíclicas entre modelos). En cada arranque eso ejecuta
    // `CHANGE legajo/email ... UNIQUE` y MySQL agrega un índice único nuevo,
    // hasta superar el límite de 64 claves del motor y dejar el servidor sin
    // arrancar. Por eso el sync ya no corre en cada boot: sólo si se pide
    // explícitamente con DB_SYNC=true (por ejemplo, al crear la base desde cero).
    if (process.env.DB_SYNC === "true") {
      await sequelize.sync();
    }
    console.log("DB conectada");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en ${PORT}`);
    });
  } catch (err) {
    console.error(err);
  }
};

// En Vercel la función la invoca la plataforma (no hay que abrir un puerto);
// en local sí levantamos el servidor. Vercel define `VERCEL=1`.
if (!process.env.VERCEL) {
  start();
}

// Vercel detecta la app de Express a partir de este export.
export default app;
