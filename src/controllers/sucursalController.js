import sequelize from "../config/db.js";
import Barrera from "../models/Barrera.model.js";
import Grua from "../models/Grua.model.js";
import { Caja, Sucursal, Usuario } from "../models/index.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { sincronizarEntidades } from "../utils/sincronizarEntidades.js";

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

export const obtenerSucursal = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Id de la sucursal requerido" });
  }
  try {
    const sucursal = await Sucursal.findByPk(id, {
      include: [Barrera, Caja, Grua, Usuario],
    });

    if (!sucursal) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la sucursal",
      });
    }

    return res.status(200).json({
      success: true,
      data: sucursal,
      message: "Sucursal obtenida exitosamente",
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Error al buscar la sucursal" });
  }
};

export const crearSucursal = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { nombre, direccion } = req.body;
    const cajas = req.body.Cajas;
    const barreras = req.body.Barreras;
    const gruas = req.body.Gruas;

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

    const cajasCreadas = await Caja.bulkCreate(cajasConSucursal, {
      validate: true,
      transaction,
    });

    const barrerasCreadas = await Barrera.bulkCreate(barrerasConSucursal, {
      validate: true,
      transaction,
    });

    const gruasCreadas = await Grua.bulkCreate(gruasConSucursal, {
      validate: true,
      transaction,
    });

    await transaction.commit();

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "CREAR",
      entidad: "SUCURSAL",
      idEntidad: sucursal.id,
      descripcion: `Creó la sucursal "${sucursal.nombre}"`,
      despues: sucursal,
    });
    for (const caja of cajasCreadas) {
      await registrarAuditoria({
        req,
        usuario: req.user,
        accion: "CREAR",
        entidad: "CAJA",
        idEntidad: caja.id,
        descripcion: `Creó la caja N°${caja.numero_caja}, con referencia "${caja.referencia}"`,
        despues: caja,
      });
    }
    for (const barrera of barrerasCreadas) {
      await registrarAuditoria({
        req,
        usuario: req.user,
        accion: "CREAR",
        entidad: "BARRERA",
        idEntidad: barrera.id,
        descripcion: `Creó la barrera "${barrera.ubicacion}"`,
        despues: barrera,
      });
    }
    for (const grua of gruasCreadas) {
      await registrarAuditoria({
        req,
        usuario: req.user,
        accion: "CREAR",
        entidad: "GRUA",
        idEntidad: grua.id,
        descripcion: `Creó la grúa patente ${grua.patente}`,
        despues: grua,
      });
    }

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
export const editarSucursal = async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion } = req.body;
  const cajas = req.body.Cajas || [];
  const barreras = req.body.Barreras || [];
  const gruas = req.body.Gruas || [];

  try {
    const transaction = await sequelize.transaction();

    const sucursal = await Sucursal.findByPk(id, {
      include: [Caja, Barrera, Grua],
      transaction,
    });

    if (!sucursal) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Sucursal no encontrada",
      });
    }

    const sucursalAntes = sucursal.toJSON();

    // =========================
    // UPDATE SUCURSAL
    // =========================
    await sucursal.update({ nombre, direccion }, { transaction });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "EDITAR",
      entidad: "SUCURSAL",
      idEntidad: sucursal.id,
      descripcion: `Editó la sucursal ${sucursal.nombre}`,
      datosAnteriores: sucursalAntes,
      datosNuevos: { nombre, direccion },
    });

    // =========================
    // CAJAS
    // =========================
    await sincronizarEntidades({
      modelo: Caja,
      actuales: sucursal.Cajas,
      nuevos: cajas,
      foreignKey: "id_sucursal",
      idPadre: sucursal.id,
      entidad: "CAJA",
      req,
      usuario: req.user,
      transaction,
    });

    // =========================
    // BARRERAS
    // =========================
    await sincronizarEntidades({
      modelo: Barrera,
      actuales: sucursal.Barreras,
      nuevos: barreras,
      foreignKey: "id_sucursal",
      idPadre: sucursal.id,
      entidad: "BARRERA",
      req,
      usuario: req.user,
      transaction,
    });

    // =========================
    // GRUAS
    // =========================
    await sincronizarEntidades({
      modelo: Grua,
      actuales: sucursal.Gruas,
      nuevos: gruas,
      foreignKey: "id_sucursal",
      idPadre: sucursal.id,
      entidad: "GRUA",
      req,
      usuario: req.user,
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: sucursal,
      message: "Sucursal actualizada exitosamente",
    });
  } catch (err) {
    console.log(err);
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Error al actualizar sucursal",
    });
  }
};
