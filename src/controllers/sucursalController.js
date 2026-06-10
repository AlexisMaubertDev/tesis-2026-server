import sequelize from "../config/db.js";
import Barrera from "../models/Barrera.model.js";
import Grua from "../models/Grua.model.js";
import { Caja, Sucursal } from "../models/index.js";

export const obtenerSucursales = async (req, res) => {
  try {
    const sucursales = await Sucursal.findAll();

    if (sucursales.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontraron sucursales",
      });
    }

    return res.status(200).json({
      success: true,
      data: sucursales,
      message: "Sucursales obtenidas exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const crearSucursal = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      nombre,
      direccion,
      cajas = [],
      barreras = [],
      gruas = [],
    } = req.body;

    if (
      !nombre?.trim() ||
      !direccion?.trim() ||
      cajas.length === 0 ||
      barreras.length === 0 ||
      gruas.length === 0
    ) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    const sucursal = await Sucursal.create(
      {
        nombre,
        direccion,
      },
      { transaction },
    );

    const cajasConSucursal = cajas.map((caja) => ({
      ...caja,
      id_sucursal: sucursal.id,
    }));

    const barrerasConSucursal = barreras.map((barrera) => ({
      ...barrera,
      id_sucursal: sucursal.id,
    }));

    const gruasConSucursal = gruas.map((grua) => ({
      ...grua,
      id_sucursal: sucursal.id,
      estado: "DISPONIBLE",
    }));

    await Caja.bulkCreate(cajasConSucursal, {
      validate: true,
      transaction,
    });

    await Barrera.bulkCreate(barrerasConSucursal, {
      validate: true,
      transaction,
    });

    await Grua.bulkCreate(gruasConSucursal, {
      validate: true,
      transaction,
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      data: sucursal,
      message: "Sucursal creada exitosamente",
    });
  } catch (err) {
    console.log(err);
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Error al crear la sucursal",
    });
  }
};
