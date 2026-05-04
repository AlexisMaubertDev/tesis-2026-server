import { Vehiculo } from "../models/index.js";

export const ingresarVehiculoAPlaya = async (req, res) => {
  try {
    const { patente, marca, modelo, color, fue_denuncia, playero_ingreso_id } =
      req.body;
    const vehiculo = await Vehiculo.create({
      patente,
      marca,
      modelo,
      color,
      playero_ingreso_id,
      estado: "INGRESADO",
      fue_denuncia,
    });

    return res.status(201).json({
      success: true,
      data,
      message: "Vehículo ingresado a la playa exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
