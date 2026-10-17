import { Op } from "sequelize";
import sequelize from "../config/db.js";
import {
  Acarreo,
  Barrera,
  Cobro,
  Grua,
  Sucursal,
  Turno_Barrera,
  Turno_Barrera_Usuario,
  Turno_Grua,
  Usuario,
  Vehiculo,
} from "../models/index.js";
import { registrarAuditoria } from "../utils/auditoria.js";

// Datos públicos de un usuario (nunca la contraseña ni los campos internos).
// Lo usan los includes de acarreos (chofer, enganchador, supervisor, barrera).
const ATRIBUTOS_USUARIO = ["id", "nombre", "apellido", "legajo", "dni", "rol"];

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
  } = req.body;

  let transaction;

  const user = req.user;
  try {
    transaction = await sequelize.transaction();

    const parsedVehiculo = {
      patente: vehiculo.patente.toUpperCase(),
      marca: vehiculo.marca.toUpperCase(),
      modelo: vehiculo.modelo.toUpperCase(),
      color: vehiculo.color.toUpperCase(),
    };

    const vehiculo_creado = await Vehiculo.create(parsedVehiculo, {
      transaction,
    });

    if (!vehiculo_creado) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    const turno_grua = await Turno_Grua.findOne({
      where: {
        [Op.or]: [{ id_chofer: user.id }, { id_enganchador: user.id }],
        activo: true,
      },
      transaction,
    });

    const acarreo = await Acarreo.create(
      {
        id_vehiculo: vehiculo_creado.id,
        id_turno_grua: turno_grua.id,
        direccion,
        motivo,
        numero_acta,
        observaciones,
        tuvo_siniestro: tuvoSiniestro,
        fue_denuncia: fueDenuncia,
        damages,
        fecha_acarreo: Date.now(),
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

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "CREAR",
      entidad: "ACARREO",
      idEntidad: acarreo.id,
      descripcion: `Se creo el acarreo: ${acarreo.id}`,
    });

    return res.status(201).json({
      success: true,
      message: "Acarreo creado correctamente",
      data: acarreo,
    });
  } catch (error) {
    console.error(error);
    if (transaction) await transaction.rollback();
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const getAcarreosPorPatente = async (req, res) => {
  try {
    const { patente } = req.params;

    // La patente se guarda en mayúsculas al crear el acarreo, pero se compara
    // sin distinguir mayúsculas para no depender de eso.
    const vehiculo = await Vehiculo.findOne({
      where: sequelize.where(
        sequelize.fn("UPPER", sequelize.col("patente")),
        patente.toUpperCase(),
      ),
    });

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    const acarreos = await Acarreo.findAll({
      where: { id_vehiculo: vehiculo.id },
      order: [["fecha_acarreo", "DESC"]],
      include: [
        { model: Vehiculo },
        {
          model: Turno_Grua,
          include: [
            {
              model: Grua,
              include: [
                { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
              ],
            },
            { model: Usuario, as: "chofer", attributes: ATRIBUTOS_USUARIO },
            {
              model: Usuario,
              as: "enganchador",
              attributes: ATRIBUTOS_USUARIO,
            },
            { model: Usuario, as: "supervisor", attributes: ATRIBUTOS_USUARIO },
          ],
        },
        {
          model: Turno_Barrera,
          include: [
            {
              model: Barrera,
              attributes: ["id", "ubicacion"],
              include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
            },
            {
              model: Turno_Barrera_Usuario,
              as: "usuarios_asignados",
              include: [{ model: Usuario, attributes: ATRIBUTOS_USUARIO }],
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: acarreos,
      message: "Acarreos obtenidos exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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
        order: [["fecha_acarreo", "ASC"]],
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
