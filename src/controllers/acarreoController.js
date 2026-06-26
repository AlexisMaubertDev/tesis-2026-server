import sequelize from "../config/db";
import { Acarreo, Vehiculo } from "../models";

export const crearAcarreo = async (req, res) => {
  const {
    vehiculo,
    direccion,
    motivo,
    numeroACta,
    observaciones,
    tuvoSiniestro,
    fueDenuncia,
    damages,
  } = req.body;
  try {
    const transaction = await sequelize.transaction();

    const vehiculo = await Vehiculo.create(vehiculo, { transaction });

    if (!vehiculo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    const acarreo = await Acarreo.create(
      {
        vehiculo,
        direccion,
        motivo,
        numeroACta,
        observaciones,
        tuvoSiniestro,
        fueDenuncia,
        damages,
      },
      { transaction }
    );

    const acarreo = await Acarreo.create(req.body);
  } catch (error) {}
};
