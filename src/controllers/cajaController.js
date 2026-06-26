import sequelize from "../config/db.js";
import { Caja, Sucursal, Turno_Caja, Usuario } from "../models/index.js";

export const obtenerCajas = async (req, res) => {
  try {
    const cajas = await Caja.findAll({
      include: { model: Sucursal },
      order: [["numero_caja", "ASC"]],
    });

    if (cajas.length === 0) {
      return res.status(404).json({ error: "No se encontraron cajas" });
    }

    return res.status(200).json({
      success: true,
      data: cajas,
      message: "Cajas obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener las cajas" });
  }
};

export const crearCaja = async (req, res) => {
  try {
    const { numero_caja, referencia, referencia_pago, Sucursal } = req.body;
    const transaction = await sequelize.transaction();

    const caja = await Caja.findOne({
      where: { numero_caja, id_sucursal: Sucursal.id },
      transaction,
    });

    if (caja) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Ya existe una caja con ese número en esta sucursal",
      });
    }

    const cajaCreada = await Caja.create({
      id_sucursal: Sucursal.id,
      numero_caja,
      referencia,
      referencia_pago,
    });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "CREAR",
      entidad: "CAJA",
      idEntidad: caja.id,
      descripcion: `Creó la caja N°${caja.numero_caja}, con referencia "${caja.referencia}"`,
      despues: caja,
    });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      data: cajaCreada,
      message: "Caja creada exitosamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear la caja" });
  }
};
export const editarCaja = async (req, res) => {
  const { id } = req.params;
  const { numero_caja, referencia, referencia_pago, Sucursal } = req.body;

  try {
    const transaction = await sequelize.transaction();

    const caja = await Caja.findByPk(id, { transaction });

    if (!caja) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Caja no encontrada",
      });
    }

    if (numero_caja) {
      const cajaDuplicada = await Caja.findOne({
        where: {
          numero_caja,
          id_sucursal: Sucursal.id,
        },
        transaction,
      });

      if (cajaDuplicada && cajaDuplicada.id !== id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Ya existe una caja con ese número en esta sucursal",
        });
      }
    }

    const cajaAntes = caja.toJSON();

    await caja.update(
      {
        numero_caja,
        referencia,
        referencia_pago,
        id_sucursal: Sucursal.id,
      },
      { transaction },
    );

    await transaction.commit();

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "EDITAR",
      entidad: "CAJA",
      idEntidad: caja.id,
      descripcion: `Editó la caja N°${numero_caja}`,
      datosAnteriores: cajaAntes,
      datosNuevos: caja.toJSON(),
    });

    return res.status(200).json({
      success: true,
      data: caja,
      message: "Caja actualizada exitosamente",
    });
  } catch (error) {
    console.error(error);
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Error al editar la caja",
    });
  }
};

export const obtenerCajasSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const cajas = await Caja.findAll({
      where: { id_sucursal: id },
      includes: { model: Turno_Caja, include: Usuario },
    });

    if (cajas.length === 0) {
      return res.status(404).json({ error: "No se encontraron cajas" });
    }

    return res.status(200).json({
      success: true,
      data: cajas,
      message: "Cajas obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener las cajas" });
  }
};
