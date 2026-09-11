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

    const caja = await editarEntidad({
      modelo: Caja,
      id,
      entidad: "CAJA",
      descripcion: `Editó la caja N°${numero_caja} de la sucursal ${Sucursal.nombre}`,
      datos: {
        numero_caja,
        referencia,
        referencia_pago,
        id_sucursal: Sucursal.id,
      },
      req,
      usuario: req.user,
      transaction,

      validacion: async () => {
        const existente = await Caja.findOne({
          where: {
            numero_caja,
            id_sucursal: Sucursal.id,
          },
          transaction,
        });

        if (existente && existente.numero_caja !== numero_caja) {
          throw new Error("Ya existe una caja con ese número en esta sucursal");
        }
      },
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      data: caja,
      message: "Caja actualizada exitosamente",
    });
  } catch (err) {
    await transaction.rollback();

    if (err.message.includes("Ya existe")) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (err.message.includes("no encontrada")) {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }

    console.error(err);

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
      include: {
        model: Turno_Caja,
        include: Usuario,
        where: { cierre: null },
        required: false,
      },
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
