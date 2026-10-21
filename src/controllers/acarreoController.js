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
      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: [],
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

// Turno de barrera activo en el que está asignado el usuario (o null si no
// tiene ninguno). Lo usa el ingreso a playa para registrar por qué barrera
// entró el vehículo.
const obtenerTurnoBarreraActivo = async (idUsuario) => {
  const asignacion = await Turno_Barrera_Usuario.findOne({
    where: { id_usuario: idUsuario },
    include: [{ model: Turno_Barrera, where: { activo: true }, required: true }],
  });

  return asignacion?.turno_barrera ?? null;
};

/**
 * Ingreso a playa (barrera): un acarreo ACARREADO pasa a INGRESADO, se registra
 * la fecha de ingreso y el turno de barrera activo del playero.
 */
export const ingresarAcarreoAPlaya = async (req, res) => {
  try {
    const { id } = req.params;

    const acarreo = await Acarreo.findByPk(id);

    if (!acarreo) {
      return res
        .status(404)
        .json({ success: false, message: "Acarreo no encontrado" });
    }

    if (acarreo.estado !== "ACARREADO") {
      return res.status(409).json({
        success: false,
        message: "El vehículo no está pendiente de ingreso a la playa",
      });
    }

    const turnoBarrera = await obtenerTurnoBarreraActivo(req.user.id);

    await acarreo.update({
      estado: "INGRESADO",
      fecha_ingreso: new Date(),
      ...(turnoBarrera ? { id_turno_barrera: turnoBarrera.id } : {}),
    });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "INGRESAR_A_PLAYA",
      entidad: "ACARREO",
      idEntidad: acarreo.id,
      descripcion: `Se ingresó a playa el acarreo ${acarreo.id}`,
    });

    return res.status(200).json({
      success: true,
      data: acarreo,
      message: "Vehículo ingresado a la playa exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * Egreso de playa (barrera): un acarreo COBRADO (ya abonado) pasa a EGRESADO y
 * se registra la fecha de egreso.
 */
export const egresarAcarreo = async (req, res) => {
  try {
    const { id } = req.params;

    const acarreo = await Acarreo.findByPk(id);

    if (!acarreo) {
      return res
        .status(404)
        .json({ success: false, message: "Acarreo no encontrado" });
    }

    if (acarreo.estado !== "COBRADO") {
      return res.status(409).json({
        success: false,
        message: "El vehículo no está abonado, no se puede dar salida",
      });
    }

    await acarreo.update({ estado: "EGRESADO", fecha_egreso: new Date() });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "EGRESAR_DE_PLAYA",
      entidad: "ACARREO",
      idEntidad: acarreo.id,
      descripcion: `Se dio salida al acarreo ${acarreo.id}`,
    });

    return res.status(200).json({
      success: true,
      data: acarreo,
      message: "Vehículo egresado de la playa exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * Salida sin cargo (supervisor): un acarreo INGRESADO sale de la playa sin
 * abonar. Pasa a SIN_CARGO, se registra la fecha de egreso y el motivo queda
 * guardado como incidencia del acarreo (además de la auditoría), para que el
 * supervisor lo vea junto al resto de las incidencias.
 */
export const sacarSinCargo = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (typeof motivo !== "string" || motivo.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "El motivo de la salida sin cargo es obligatorio",
      });
    }

    const acarreo = await Acarreo.findByPk(id);

    if (!acarreo) {
      return res
        .status(404)
        .json({ success: false, message: "Acarreo no encontrado" });
    }

    if (acarreo.estado !== "INGRESADO") {
      return res.status(409).json({
        success: false,
        message:
          "El vehículo no está en la playa (ingresado), no se puede dar salida sin cargo",
      });
    }

    const fecha = new Date().toISOString();
    const incidencia = `Salida sin cargo (${fecha}): ${motivo.trim()}`;

    // El motivo se acumula como incidencia del acarreo (el mismo canal que usa
    // el supervisor para el resto de las incidencias).
    const incidenciasPrevias = acarreo.incidencias;
    const incidenciasNuevas = incidenciasPrevias
      ? `${incidenciasPrevias}\n${incidencia}`
      : incidencia;

    await acarreo.update({
      estado: "SIN_CARGO",
      fecha_egreso: new Date(),
      incidencias: incidenciasNuevas,
    });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "SALIDA_SIN_CARGO",
      entidad: "ACARREO",
      idEntidad: acarreo.id,
      descripcion: incidencia,
      antes: { estado: "INGRESADO", incidencias: incidenciasPrevias ?? null },
      despues: { estado: "SIN_CARGO", incidencia },
    });

    return res.status(200).json({
      success: true,
      data: acarreo,
      message: "Vehículo egresado sin cargo exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * PUT /acarreos/:id/incidencias — agrega una incidencia al acarreo (el
 * vehículo). Sólo la puede agregar un supervisor (o sistemas).
 */
export const agregarIncidenciaAcarreo = async (req, res) => {
  try {
    const { id } = req.params;
    const { incidencias } = req.body;

    if (typeof incidencias !== "string" || incidencias.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "La incidencia es obligatoria",
      });
    }

    const acarreo = await Acarreo.findByPk(id);

    if (!acarreo) {
      return res
        .status(404)
        .json({ success: false, message: "Acarreo no encontrado" });
    }

    const incidenciasPrevias = acarreo.incidencias;
    const nuevas = incidenciasPrevias
      ? `${incidenciasPrevias}\n${incidencias.trim()}`
      : incidencias.trim();

    await acarreo.update({ incidencias: nuevas });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "AGREGAR_INCIDENCIA_ACARREO",
      entidad: "ACARREO",
      idEntidad: acarreo.id,
      descripcion: `Se agregó una incidencia al acarreo ${acarreo.id}`,
      antes: { incidencias: incidenciasPrevias ?? null },
      despues: { incidencia: incidencias.trim() },
    });

    return res.status(200).json({
      success: true,
      data: acarreo,
      message: "Incidencia agregada exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
