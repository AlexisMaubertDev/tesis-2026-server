import sequelize from "../config/db.js";
import Barrera from "../models/Barrera.model.js";
import Sucursal from "../models/Sucursal.model.js";
import { Turno_Barrera, Turno_Barrera_Usuario, Usuario } from "../models/index.js";

export const obtenerBarreras = async (req, res) => {
  try {
    const barreras = await Barrera.findAll({ include: { model: Sucursal } });

    return res.status(200).json({
      success: true,
      data: barreras,
      message: "Barreras obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const crearBarrera = async (req, res) => {
  const { ubicacion, Sucursal } = req.body;
  try {
    const id_sucursal = Sucursal.id;
    const transaction = await sequelize.transaction();

    if (ubicacion.trim() === "" || !Sucursal || !Sucursal.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    const barreraCreada = await Barrera.create(
      {
        ubicacion,
        id_sucursal,
      },
      { transaction },
    );

    if (!barreraCreada) {
      transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Error al crear la barrera",
      });
    }

    return res.status(201).json({
      success: true,
      data: barreraCreada,
      message: "Barrera creada exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const editarBarrera = async (req, res) => {
  const { ubicacion, Sucursal } = req.body;
  try {
    const transaction = await sequelize.transaction();

    const { id } = req.params;

    if (id || ubicacion.trim() === "" || !Sucursal || !Sucursal.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    const barrera = await Barrera.findByPk(id);

    if (!barrera) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se encontró la barrera",
      });
    }

    const updatedBarrera = await barrera.update({
      ubicacion,
      id_sucursal: Sucursal.id,
    });

    if (!updatedBarrera) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No se pudo editar la barrera",
      });
    }
    await transaction.commit();

    return res.status(201).json({
      succes: true,
      message: "Barrera editada correctamente",
      data: updatedBarrera,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const obtenerBarrerasSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const barreras = await Barrera.findAll({
      where: { id_sucursal: id },
      include: [
        { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
        {
          model: Turno_Barrera,
          as: "turno_barrera_activo",
          required: false,
          include: [
            {
              model: Turno_Barrera_Usuario,
              as: "usuarios_asignados",
              required: false,
              include: [
                {
                  model: Usuario,
                  attributes: ["id", "nombre", "apellido", "legajo", "rol", "numero_turno", "bloqueado"],
                },
              ],
            },
          ],
        },
      ],
      order: [["ubicacion", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: barreras,
      message: "Barreras obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};
