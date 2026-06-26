import sequelize from "../config/db";
import { Acarreo, Cobro, Turno_Barrera, Turno_Grua, Vehiculo } from "../models";

export const crearAcarreo = async (req, res) => {
  const {
    vehiculo,
    direccion,
    motivo,
    numero_acta,
    observaciones,
    tuvoSiniestro,
    fueDenuncia,
    damages,
    Turno_Grua,
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
        id_vehiculo: vehiculo.id,
        id_turno_grua: Turno_Grua.id,
        direccion,
        motivo,
        numero_acta,
        observaciones,
        tuvoSiniestro,
        fueDenuncia,
        damages,
        fechaAcarreo: Date.now(),
        estado: "ACARREADO",
      },
      { transaction },
    );
    if (!acarreo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se puedo crear el acarreo",
      });
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Acarreo creado correctamente",
      data: acarreo,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const getAcarreos = async (req, res) => {
  try {
    const transaction = await sequelize.transaction();

    const acarreos = await Acarreo.findAll(
      {
        include: [
          { model: Vehiculo },
          {
            model: Turno_Grua,
          },
          {
            model: Turno_Barrera,
          },
          {
            model: Cobro,
          },
        ],
        order: ["fecha_acarreo", "ASC"],
      },
      { transaction },
    );

    if (acarreos.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No se encontraron Acarreos",
      });
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: "Acarreos obtenidos correctamente",
      data: acarreos,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
