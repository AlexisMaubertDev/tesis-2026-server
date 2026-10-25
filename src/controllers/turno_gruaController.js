import { Op } from "sequelize";
import sequelize from "../config/db.js";
import { Acarreo, Grua, Sucursal, Turno_Grua, Usuario, Vehiculo } from "../models/index.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { construirInformePdf, formatoFecha } from "../utils/informePdf.js";

/** Include de los usuarios que participan de un turno de grúa. */
const usuariosDelTurno = [
  { model: Usuario, as: "chofer", attributes: ["id", "nombre", "apellido", "legajo", "dni", "rol"] },
  { model: Usuario, as: "enganchador", attributes: ["id", "nombre", "apellido", "legajo", "dni", "rol"] },
  { model: Usuario, as: "supervisor", attributes: ["id", "nombre", "apellido", "legajo", "dni", "rol"] },
];

/** Grúa del turno con su sucursal. */
const gruaDelTurno = {
  model: Grua,
  include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
};

// export const asignarGrua = async (req, res) => {
//   const {
//     id_chofer,
//     id_enganchador,
//     id_grua,
//     turno,
//     nombre_agente,
//     numero_agente,
//   } = req.body;
//   const supervisor = req.user;

//   try {
//     const transaction = await sequelize.transaction();

//     if (!turno || nombre_agente.trim() === "" || !numero_agente) {
//       return res.status(400).json({
//         success: false,
//         message: "Faltan campos obligatorios",
//       });
//     }
//     const grua = await Grua.findByPk(id_grua);

//     if (!grua) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No se encontró la grúa",
//       });
//     }

//     if (grua.estado !== "DISPONIBLE") {
//       await transaction.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "La grúa seleccionada no esta disponible",
//       });
//     }

//     const chofer = await Usuario.findByPk(id_chofer);

//     if (!chofer) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No se encontró al chofer asignado",
//       });
//     }
//     const enganchador = await Usuario.findByPk(id_enganchador);

//     if (!enganchador) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "No se encontró al enganchador asignado",
//       });
//     }

//     const turnoAbierto = await Turno_Grua.findOne({
//       where: {
//         fecha_cierre: null,
//         [Op.or]: [
//           { id_grua: grua.id },

//           { id_chofer: chofer.id },
//           { id_enganchador: chofer.id },

//           { id_chofer: enganchador.id },
//           { id_enganchador: enganchador.id },
//         ],
//       },
//       transaction,
//     });

//     if (turnoAbierto) {
//       let message = "";

//       if (turnoAbierto.id_grua === grua.id) {
//         message = "La grúa ya tiene un turno abierto.";
//       } else if (
//         turnoAbierto.id_chofer === chofer.id ||
//         turnoAbierto.id_enganchador === chofer.id
//       ) {
//         message = "El chofer ya tiene un turno abierto.";
//       } else {
//         message = "El enganchador ya tiene un turno abierto.";
//       }

//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message,
//       });
//     }
//     const nuevoTurno = await Turno_Grua.create(
//       {
//         id_grua: grua.id,
//         id_chofer: chofer.id,
//         id_enganchador: enganchador.id,
//         turno,
//         nombre_agente,
//         numero_agente,
//         id_supervisor: supervisor.id,
//         fecha_inicio: new Date(),
//         fecha_fin: null,
//       },
//       { transaction },
//     );
//     await grua.update(
//       {
//         estado: "EN_SERVICIO",
//       },
//       { transaction },
//     );

//     await transaction.commit();

//     return res.status(201).json({
//       success: true,
//       message: "Turno de grúa creado correctamente.",
//       data: nuevoTurno,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Error al asignar turno" });
//   }
// };

// export const obtenerGruasActivasPorSucursal = async (req, res) => {
//   const usuario = req.user;

//   try {
//     const gruasActivas = await Turno_Grua.findAll({
//       where: {
//         fecha_fin: null,
//       },
//       include: [
//         {
//           model: Grua,
//           where: {
//             id_sucursal: usuario.id_sucursal,
//           },
//         },
//       ],
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Grúas activas obtenidas correctamente",
//       data: gruasActivas,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "Error en el servidor",
//     });
//   }
// };

// export const obtenerTurnos = async (req, res) => {
//   try {
//     const turnos = await Turno_Grua.findAll({
//       order: [["fecha_inicio", "ASC"]],
//     });

//     if (turnos.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No se encontraron turnos",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: turnos,
//       message: "Turnos obtenidos correctamente",
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "Error en el servidor",
//     });
//   }
// };

export const finalizarTodosLosTurnosGruasPorSucursal = async (req, res) => {
  const { id_sucursal } = req.params;

  if (!id_sucursal) {
    return res.status(400).json({ error: "No se proporcionó la sucursal" });
  }
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const turnosActivos = await Turno_Grua.findAll({
      attributes: ["id", "id_grua", "turno", "fecha_inicio"],
      include: [
        {
          model: Grua,
          where: { id_sucursal },
          attributes: ["patente", "numero"],
          required: true,
        },
      ],
      where: { activo: true },
      transaction,
    });

    if (turnosActivos.length === 0) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "No se encontraron turnos activos" });
    }

    const idsTurnos = turnosActivos.map((t) => t.id);
    const idsGruas = turnosActivos.map((t) => t.id_grua);

    await Turno_Grua.update(
      {
        activo: false,
        fecha_fin: new Date(),
      },
      {
        where: { id: idsTurnos },
        transaction,
      },
    );

    await Grua.update(
      { estado: "DISPONIBLE" },
      {
        where: { id: idsGruas },
        transaction,
      },
    );

    turnosActivos.forEach(async (turno) => {
      await registrarAuditoria({
        usuario: req.user,
        entidad: "GRUA",
        idEntidad: turno.id_grua,
        accion: "FINALIZAR_TURNO",
        descripcion: `Se cerro el turno de la grua patente ${turno.Grua.patente} de la fecha turno ${turno.fecha_inicio}`,
        req,
      });
    });

    await transaction.commit();

    // Se devuelven los turnos cerrados: el supervisor puede emitir el informe
    // por grúa de cada uno (RF27).
    return res.status(200).json({
      success: true,
      message:
        "Todos los turnos activos de la sucursal fueron cerrados exitosamente",
      data: {
        turnos: turnosActivos.map((turno) => ({
          id: turno.id,
          id_grua: turno.id_grua,
          turno: turno.turno,
          fecha_inicio: turno.fecha_inicio,
          fecha_fin: new Date(),
          grua: turno.Grua
            ? {
                id: turno.id_grua,
                patente: turno.Grua.patente,
                numero: turno.Grua.numero,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error(error);
    if (transaction) await transaction.rollback();
    return res.status(500).json({ error: error.message });
  }
};

export const agregarIncidencia = async (req, res) => {
  const { id_turno_grua } = req.params;
  const { incidencias } = req.body;

  let transaction;

  if (!incidencias || !incidencias.trim()) {
    return res
      .status(400)
      .json({ error: "La incidencia no puede estar vacía" });
  }
  try {
    const turnoGrua = await Turno_Grua.findByPk(id_turno_grua);
    if (!turnoGrua) {
      return res.status(404).json({ error: "Turno de grua no encontrado" });
    }
    transaction = await sequelize.transaction();

    const incidenciasPrevias = turnoGrua.incidencias || "";

    const nuevaEntrada = `${incidencias.trim()}`;

    const incidenciaFormateada = incidenciasPrevias
      ? `${incidenciasPrevias}\n- ${nuevaEntrada}`
      : `- ${nuevaEntrada}`;

    await turnoGrua.update(
      { incidencias: incidenciaFormateada },
      { transaction },
    );

    await registrarAuditoria({
      usuario: req.user,
      entidad: "TURNO_GRUA",
      idEntidad: turnoGrua.id_grua,
      accion: "ACTUALIZAR",
      descripcion: `Se agrego una incidencia al turno de grua: ${id_turno_grua}`,
      req,
      despues: { incidencias: incidenciaFormateada },
    });

    await transaction.commit();
    return res
      .status(200)
      .json({ success: true, message: "Incidencia agregada con éxito" });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error en el servidor" });
  }
};

export const finalizarTurno = async (req, res) => {
  const { id_turno_grua } = req.params;
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const turnoGrua = await Turno_Grua.findByPk(id_turno_grua, { transaction });
    if (!turnoGrua) {
      await transaction.rollback();
      return res.status(404).json({ error: "Turno de grua no encontrado" });
    }

    await turnoGrua.update({ activo: false }, { transaction });

    await Grua.update(
      { estado: "DISPONIBLE" },
      { where: { id: turnoGrua.id_grua }, transaction },
    );

    await registrarAuditoria({
      usuario: req.user,
      entidad: "TURNO_GRUA",
      idEntidad: turnoGrua.id_grua,
      accion: "FINALIZAR_TURNO",
      descripcion: `Se cerro el turno de grua: ${id_turno_grua}`,
      req,
    });

    await transaction.commit();
    return res
      .status(200)
      .json({
        success: true,
        message: "Turno finalizado con éxito",
        data: turnoGrua,
      });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error(error);
    return res.status(500).json({ error: "Error en el servidor" });
  }
};

// GET /turno_grua — todos los turnos de grúa (con grúa, chofer, enganchador,
// supervisor y la cantidad de acarreos de cada uno).
export const obtenerTurnosGrua = async (req, res) => {
  try {
    const turnos = await Turno_Grua.findAll({
      order: [["fecha_inicio", "DESC"]],
      include: [gruaDelTurno, ...usuariosDelTurno, { model: Acarreo, attributes: ["id"] }],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de grúa obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_grua/usuario/:id — turnos de grúa de un usuario (chofer o enganchador).
export const obtenerTurnosGruaDeUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Grua.findAll({
      where: { [Op.or]: [{ id_chofer: id }, { id_enganchador: id }] },
      order: [["fecha_inicio", "DESC"]],
      include: [gruaDelTurno, ...usuariosDelTurno, { model: Acarreo, attributes: ["id"] }],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de grúa del usuario obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /turno_grua/:id/detalle — detalle de un turno de grúa con sus usuarios,
 * su grúa y los acarreos que hizo (con el vehículo de cada uno).
 */
export const obtenerDetalleTurnoGrua = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Grua.findByPk(id, {
      include: [gruaDelTurno, ...usuariosDelTurno],
    });

    if (!turno) {
      return res.status(404).json({
        success: false,
        message: "Turno de grúa no encontrado",
      });
    }

    const acarreos = await Acarreo.findAll({
      where: { id_turno_grua: id },
      order: [["fecha_acarreo", "ASC"]],
      include: [{ model: Vehiculo }],
    });

    const totales = acarreos.reduce(
      (acc, acarreo) => ({
        cantidad: acc.cantidad + 1,
        ingresados: acc.ingresados + (acarreo.estado === "INGRESADO" ? 1 : 0),
        cobrados: acc.cobrados + (acarreo.estado === "COBRADO" ? 1 : 0),
        egresados: acc.egresados + (acarreo.estado === "EGRESADO" ? 1 : 0),
        sinCargo: acc.sinCargo + (acarreo.estado === "SIN_CARGO" ? 1 : 0),
      }),
      { cantidad: 0, ingresados: 0, cobrados: 0, egresados: 0, sinCargo: 0 },
    );

    return res.status(200).json({
      success: true,
      data: { turno, acarreos, totales },
      message: "Detalle del turno de grúa obtenido exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /turno_grua/mi-turno — detalle del turno de grúa activo del usuario
 * autenticado (gruero). Devuelve la grúa, el personal, el supervisor y los
 * acarreos del turno. Sirve a la app móvil para mostrar el turno habilitado
 * arriba del formulario de acarreo.
 */
export const obtenerMiTurnoGrua = async (req, res) => {
  try {
    const turno = await Turno_Grua.findOne({
      where: {
        activo: true,
        [Op.or]: [
          { id_chofer: req.user.id },
          { id_enganchador: req.user.id },
        ],
      },
      include: [gruaDelTurno, ...usuariosDelTurno],
      order: [["fecha_inicio", "DESC"]],
    });

    if (!turno) {
      return res.status(404).json({
        success: false,
        message: "No tenés un turno de grúa activo",
      });
    }

    const acarreos = await Acarreo.findAll({
      where: { id_turno_grua: turno.id },
      order: [["fecha_acarreo", "ASC"]],
      include: [{ model: Vehiculo }],
    });

    const totales = acarreos.reduce(
      (acc, acarreo) => ({
        cantidad: acc.cantidad + 1,
        ingresados: acc.ingresados + (acarreo.estado === "INGRESADO" ? 1 : 0),
        cobrados: acc.cobrados + (acarreo.estado === "COBRADO" ? 1 : 0),
        egresados: acc.egresados + (acarreo.estado === "EGRESADO" ? 1 : 0),
        sinCargo: acc.sinCargo + (acarreo.estado === "SIN_CARGO" ? 1 : 0),
      }),
      { cantidad: 0, ingresados: 0, cobrados: 0, egresados: 0, sinCargo: 0 },
    );

    return res.status(200).json({
      success: true,
      data: { turno, acarreos, totales },
      message: "Detalle del turno de grúa obtenido exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /turno_grua/:id/informe.pdf — informe del turno de grúa, en PDF
 * (RF15 / CU13 y RF27).
 *
 * Es el **informe por grúa**: la grúa, el personal que la operó (chofer,
 * enganchador y supervisor), el resumen de los acarreos y el detalle de cada
 * uno (fecha, patente, vehículo, dirección y motivo). Sirve para turnos
 * abiertos y cerrados, así que el supervisor puede emitirlo al cerrar el turno.
 */
export const generarInformeTurnoGruaPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Grua.findByPk(id, {
      include: [gruaDelTurno, ...usuariosDelTurno],
    });

    if (!turno) {
      return res
        .status(404)
        .json({ success: false, message: "Turno de grúa no encontrado" });
    }

    const acarreos = await Acarreo.findAll({
      where: { id_turno_grua: id },
      order: [["fecha_acarreo", "ASC"]],
      include: [{ model: Vehiculo }],
    });

    const nombreUsuario = (usuario) =>
      usuario
        ? `${usuario.nombre} ${usuario.apellido}${usuario.rol ? ` (${usuario.rol})` : ""}`
        : null;

    const datos = {
      tipo: "TURNO_GRUA",
      titulo: "Informe de cierre de turno de grúa",
      sucursal: {
        id: turno.Grua?.Sucursal?.id ?? null,
        nombre: turno.Grua?.Sucursal?.nombre ?? "Sucursal desconocida",
      },
      periodo: {
        desde: turno.fecha_inicio,
        hasta: turno.fecha_fin ?? new Date(),
        descripcion: `Turno ${turno.turno} · Grúa ${turno.Grua?.patente ?? "-"}`,
      },
      responsable: nombreUsuario(turno.chofer),
      filasExtra: [
        {
          etiqueta: "Grúa",
          valor: turno.Grua
            ? `N° ${turno.Grua.numero} · ${turno.Grua.patente}`
            : "-",
        },
        { etiqueta: "Turno", valor: `Turno ${turno.turno}` },
        {
          etiqueta: "Inicio del turno",
          valor: formatoFecha(turno.fecha_inicio),
        },
        {
          etiqueta: "Cierre del turno",
          valor: turno.fecha_fin
            ? formatoFecha(turno.fecha_fin)
            : "Turno abierto",
        },
        {
          etiqueta: "Estado del turno",
          valor: turno.activo ? "Abierto" : "Cerrado",
        },
        // Usuarios del turno con su rol (regla de informes de cierre).
        { etiqueta: "Chofer", valor: nombreUsuario(turno.chofer) ?? "-" },
        {
          etiqueta: "Enganchador",
          valor: nombreUsuario(turno.enganchador) ?? "-",
        },
        {
          etiqueta: "Supervisor",
          valor: nombreUsuario(turno.supervisor) ?? "-",
        },
        {
          etiqueta: "Agente",
          valor: turno.nombre_agente
            ? `${turno.nombre_agente} (${turno.numero_agente})`
            : "-",
        },
        ...(turno.incidencias
          ? [{ etiqueta: "Incidencias", valor: turno.incidencias }]
          : []),
      ],
      // Regla de informes: el cierre del turno no muestra estados de los autos.
      // Sólo lo que hizo la grúa en el turno.
      resumen: [
        { etiqueta: "Acarreos", valor: String(acarreos.length) },
        {
          etiqueta: "Con denuncia",
          valor: String(acarreos.filter((a) => a.fue_denuncia).length),
        },
        {
          etiqueta: "Con siniestro",
          valor: String(acarreos.filter((a) => a.tuvo_siniestro).length),
        },
        {
          etiqueta: "Con incidencias",
          valor: String(acarreos.filter((a) => a.incidencias).length),
        },
      ],
      movimientos: acarreos.map((acarreo) => {
        const vehiculo = acarreo.Vehiculo;

        return {
          fecha: acarreo.fecha_acarreo,
          patente: vehiculo?.patente ?? "-",
          marca: vehiculo?.marca ?? null,
          modelo: vehiculo?.modelo ?? null,
          color: vehiculo?.color ?? null,
          direccion: acarreo.direccion,
          motivo: acarreo.motivo,
          incidencias: acarreo.incidencias ?? "-",
        };
      }),
      totales: { cantidad: acarreos.length },
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-turno-grua-${turno.id}.pdf"`,
    );

    const doc = construirInformePdf(datos);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error al generar el informe del turno de grúa:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Error al generar el informe del turno de grúa",
      });
    }
  }
};

// GET /turno_grua/grua/:id — todos los turnos de una grúa (historial) con sus
// usuarios y acarreos.
export const obtenerTurnosGruaDeGrua = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Grua.findAll({
      where: { id_grua: id },
      order: [["fecha_inicio", "DESC"]],
      include: [gruaDelTurno, ...usuariosDelTurno, { model: Acarreo, attributes: ["id"] }],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de la grúa obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
