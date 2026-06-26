import { Vehiculo } from "../models/index.js";

export const obtenerVehiculos = async (req, res) => {
  try {
    const vehiculos = await Vehiculo.findAll();

    return res.status(200).json({
      success: true,
      data: vehiculos,
      message: "Vehiculos obtenidos exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const obtenerVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findByPk(id);

    return res.status(200).json({
      success: true,
      data: vehiculo,
      message: "Vehiculo obtenido exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

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
