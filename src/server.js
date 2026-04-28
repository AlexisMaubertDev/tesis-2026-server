import app from "./app.js";
import sequelize from "./config/db.js";

const PORT = 1337;

const start = async () => {
  try {
    await sequelize.sync();
    console.log("DB conectada");

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en ${PORT}`);
    });
  } catch (err) {
    console.error(err);
  }
};

start();
