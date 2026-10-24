import { Op } from "sequelize";
import sequelize from "../config/db.js";
import {
  Caja,
  Cobro,
  Sucursal,
  Turno_Caja,
  Usuario,
  Acarreo,
  Vehiculo,
} from "../models/index.js";
import { crearEntidad } from "../utils/crearEntidad.js";
import { editarEntidad } from "../utils/editarEntidad.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { armarInformeCobros } from "./informeController.js";
import { construirInformePdf, formatoFecha } from "../utils/informePdf.js";

export const empezarTurnoCaja = async (req, res) => {
  const usuario = req.user;
  const { id_caja, turno } = req.body;

  let transaction;

  try {
    const turnoCaja_previo = await Turno_Caja.findOne({
      where: {
        activo: true,
        [Op.or]: [{ id_caja }, { id_usuario: usuario.id }],
      },
    });

    if (turnoCaja_previo) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un turno de caja abierto para esta caja",
      });
    }

    const caja = await Caja.findOne({ where: { id: id_caja } });

    if (!caja) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la caja",
      });
    }

    transaction = await sequelize.transaction();

    const turnoCaja = await crearEntidad({
      modelo: Turno_Caja,
      datos: { id_caja, turno, id_usuario: usuario.id, apertura: new Date() },
      entidad: "TURNO_CAJA",
      descripcion: `Empezó el turno de ${turno} para la caja con ID ${id_caja}`,
      req,
      usuario,
      transaction,
    });

    await registrarAuditoria({
      req,
      usuario,
      accion: "INICIAR_TURNO",
      entidad: "TURNO_CAJA",
      idEntidad: turnoCaja.toJSON().id,
      descripcion: `Empezó el turno ${turno} para la caja número ${caja.numero_caja}`,
      datosNuevos: turnoCaja.toJSON(),
    });

    await transaction.commit();
    return res.status(200).json({
      success: true,
      data: {
        id: turnoCaja.toJSON().id,
        apertura: turnoCaja.toJSON().apertura,
        turno: turnoCaja.toJSON().turno,
        Caja: caja,
      },
      message: "Turno de caja empezado exitosamente",
    });
  } catch (err) {
    console.log(err);
    if (transaction) await transaction.rollback();
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// Criterio único de "turno abierto": `activo: true` (lo usan también la
// asociación `turno_caja_activo` y `cerrarTurnoCaja`, que marcan `activo: false`).
export const obtenerTurnoCajasAbiertas = async (req, res) => {
  const usuario = req.user;
  try {
    const turnoCajas = await usuario.getTurno_Cajas({
      where: { activo: true },
    });

    return res.status(200).json({
      success: true,
      data: turnoCajas,
      message: "Turnos de cajas obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const cerrarTurnoCaja = async (req, res) => {
  const { id } = req.params;
  const { numero_sobre, efectivo_contado } = req.body;
  const usuario = req.user;

  try {
    const turnoCaja = await Turno_Caja.findByPk(id);

    if (!turnoCaja) {
      return res.status(404).json({
        success: false,
        message: "No se encontró el turno de caja",
      });
    }

    // Arqueo: el efectivo contado es opcional, pero si viene debe ser válido.
    let efectivoContado = null;

    if (efectivo_contado !== undefined && efectivo_contado !== null && efectivo_contado !== "") {
      efectivoContado = Number(efectivo_contado);

      if (Number.isNaN(efectivoContado) || efectivoContado < 0) {
        return res.status(400).json({
          success: false,
          message: "El efectivo contado debe ser un importe válido",
        });
      }
    }

    const transaction = await sequelize.transaction();

    const turnoCajaCerrado = await editarEntidad({
      modelo: Turno_Caja,
      id,
      datos: {
        cierre: new Date(),
        activo: false,
        numero_sobre: numero_sobre?.trim() || null,
        efectivo_contado: efectivoContado,
      },
      entidad: "TURNO_CAJA",
      descripcion: `Cerro el turno de ${turnoCaja.turno} para la caja con ID ${turnoCaja.id_caja}`,
      req,
      usuario,
      transaction,
    });

    await transaction.commit();
    return res.status(200).json({
      success: true,
      data: turnoCajaCerrado.toJSON(),
      message: "Turno de caja cerrado exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/cajas/:id — historial de turnos de una caja.
export const obtenerTurnosDeCaja = async (req, res) => {
  const { id } = req.params;
  try {
    const turnos = await Turno_Caja.findAll({
      where: { id_caja: id },
      order: [["apertura", "DESC"]],
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
        { model: Cobro, attributes: ["id"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de la caja obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/cerrados — todos los turnos de caja cerrados.
export const obtenerTurnosCerrados = async (req, res) => {
  try {
    const turnos = await Turno_Caja.findAll({
      where: { activo: false },
      order: [["apertura", "DESC"]],
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de caja cerrados obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/usuario/:id — todos los turnos de caja de un usuario (abiertos y cerrados).
export const obtenerTurnosDeUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Caja.findAll({
      where: { id_usuario: id },
      order: [["apertura", "DESC"]],
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos de caja del usuario obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /turno_caja/:id/detalle — detalle de un turno de caja con sus cobros,
 * acarreos y vehículos.
 */
export const obtenerDetalleTurnoCaja = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Caja.findByPk(id, {
      include: [
        { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "dni", "rol"] },
      ],
    });

    if (!turno) {
      return res.status(404).json({
        success: false,
        message: "Turno de caja no encontrado",
      });
    }

    const cobros = await Cobro.findAll({
      where: { id_turno_caja: id },
      order: [["fecha", "ASC"]],
      include: [{ model: Acarreo, include: [{ model: Vehiculo }] }],
    });

    const totales = cobros.reduce(
      (acc, cobro) => ({
        cantidad: acc.cantidad + 1,
        total: acc.total + Number(cobro.total || 0),
        efectivo: acc.efectivo + Number(cobro.efectivo || 0),
        mp: acc.mp + Number(cobro.mp || 0),
      }),
      { cantidad: 0, total: 0, efectivo: 0, mp: 0 },
    );

    totales.total = Math.round(totales.total * 100) / 100;
    totales.efectivo = Math.round(totales.efectivo * 100) / 100;
    totales.mp = Math.round(totales.mp * 100) / 100;

    // Arqueo del cierre (RF14 / CU08): el efectivo esperado es el cobrado en
    // efectivo; si el cajero cargó el efectivo contado, se informa la diferencia
    // (positiva = sobrante, negativa = faltante).
    const efectivoEsperado = totales.efectivo;
    const efectivoContado =
      turno.efectivo_contado === null || turno.efectivo_contado === undefined
        ? null
        : Number(turno.efectivo_contado);

    const arqueo = {
      numero_sobre: turno.numero_sobre ?? null,
      efectivoEsperado,
      efectivoContado,
      diferencia:
        efectivoContado === null
          ? null
          : Math.round((efectivoContado - efectivoEsperado) * 100) / 100,
    };

    return res.status(200).json({
      success: true,
      data: { turno, cobros, totales, arqueo },
      message: "Detalle del turno obtenido exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /turno_caja/:apertura — turnos abiertos en una fecha (AAAA-MM-DD).
export const obtenerTurnosPorFecha = async (req, res) => {
  const { apertura } = req.params;

  const desde = new Date(`${apertura}T00:00:00`);
  const hasta = new Date(`${apertura}T23:59:59.999`);

  if (Number.isNaN(desde.getTime())) {
    return res.status(400).json({
      success: false,
      message: "La fecha debe tener el formato AAAA-MM-DD",
    });
  }

  try {
    const turnos = await Turno_Caja.findAll({
      where: { apertura: { [Op.between]: [desde, hasta] } },
      order: [["apertura", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: turnos,
      message: "Turnos obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * PUT /turno_caja/:id/incidencias — agrega una incidencia al turno de caja,
 * acumulándola al final del campo `incidencias`. Sólo supervisor (o sistemas).
 */
export const agregarIncidenciaTurnoCaja = async (req, res) => {
  const { id } = req.params;
  const { incidencias } = req.body;

  if (!incidencias || !incidencias.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "La incidencia no puede estar vacía" });
  }

  try {
    const turno = await Turno_Caja.findByPk(id);

    if (!turno) {
      return res
        .status(404)
        .json({ success: false, message: "Turno de caja no encontrado" });
    }

    const incidenciasPrevias = turno.incidencias || "";
    const nuevas = incidenciasPrevias
      ? `${incidenciasPrevias}\n- ${incidencias.trim()}`
      : `- ${incidencias.trim()}`;

    await turno.update({ incidencias: nuevas });

    await registrarAuditoria({
      usuario: req.user,
      entidad: "TURNO_CAJA",
      idEntidad: turno.id,
      accion: "AGREGAR_INCIDENCIA_TURNO_CAJA",
      descripcion: `Se agregó una incidencia al turno de caja ${turno.id}`,
      antes: { incidencias: incidenciasPrevias || null },
      despues: { incidencias: nuevas },
      req,
    });

    return res.status(200).json({
      success: true,
      data: turno,
      message: "Incidencia agregada exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /turno_caja/:id/informe.pdf — informe de cobros del turno, en PDF.
 *
 * Es el informe de cierre de turno que el cajero emite al cerrar (CU08): junta
 * los cobros del turno y usa el mismo armado que el informe global de cobros
 * (RF21 / CU12). Sirve tanto para el turno abierto como para uno ya cerrado
 * (por eso se busca por id, no por `activo`).
 */
export const generarInformeTurnoCajaPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Caja.findByPk(id, {
      include: [
        {
          model: Caja,
          attributes: ["id", "numero_caja", "referencia"],
          include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
        },
        { model: Usuario, attributes: ["nombre", "apellido", "dni", "legajo", "rol"] },
      ],
    });

    if (!turno) {
      return res
        .status(404)
        .json({ success: false, message: "Turno de caja no encontrado" });
    }

    const cobros = await Cobro.findAll({
      where: { id_turno_caja: id },
      order: [["fecha", "ASC"]],
      include: [
        {
          model: Turno_Caja,
          include: [
            { model: Caja, attributes: ["id", "numero_caja", "referencia"] },
            { model: Usuario, attributes: ["nombre", "apellido"] },
          ],
        },
        {
          model: Acarreo,
          include: [
            {
              model: Vehiculo,
              attributes: ["patente", "marca", "modelo", "color"],
            },
          ],
        },
      ],
    });

    const sucursalNombre =
      turno.Caja?.Sucursal?.nombre ?? "Sucursal desconocida";

    // Efectivo esperado = cobrado en efectivo del turno (para el arqueo).
    const efectivoEsperado =
      Math.round(
        cobros.reduce((acc, c) => acc + Number(c.efectivo || 0), 0) * 100,
      ) / 100;

    const efectivoContado =
      turno.efectivo_contado === null || turno.efectivo_contado === undefined
        ? null
        : Number(turno.efectivo_contado);

    const responsable = turno.Usuario
      ? `${turno.Usuario.nombre} ${turno.Usuario.apellido} (${
          turno.Usuario.rol ?? "CAJERO"
        })${turno.Usuario.dni ? ` · DNI ${turno.Usuario.dni}` : ""}`
      : null;

    const datos = armarInformeCobros({
      cobros,
      modo: "TURNO",
      sucursales: turno.Caja?.Sucursal
        ? [turno.Caja.Sucursal]
        : [],
      periodo: {
        desde: turno.apertura,
        hasta: turno.cierre ?? new Date(),
        descripcion: `Cierre de turno · Caja N° ${turno.Caja?.numero_caja ?? "-"} · Turno ${turno.turno}`,
      },
      responsable,
      arqueo: {
        numero_sobre: turno.numero_sobre ?? null,
        efectivoEsperado,
        efectivoContado,
        diferencia:
          efectivoContado === null
            ? null
            : Math.round((efectivoContado - efectivoEsperado) * 100) / 100,
      },
    });

    // Regla de informes: el cierre del turno de caja muestra los cobros del
    // turno, sus datos y sus usuarios con rol. No muestra estados de autos.
    datos.titulo = "Informe de cierre de turno de caja";
    datos.filasExtra = [
      {
        etiqueta: "Caja",
        valor: turno.Caja
          ? `N° ${turno.Caja.numero_caja}${
              turno.Caja.referencia ? ` · ${turno.Caja.referencia}` : ""
            }`
          : "-",
      },
      { etiqueta: "Turno", valor: `Turno ${turno.turno}` },
      {
        etiqueta: "Inicio del turno",
        valor: formatoFecha(turno.apertura),
      },
      {
        etiqueta: "Cierre del turno",
        valor: turno.cierre ? formatoFecha(turno.cierre) : "Turno abierto",
      },
      {
        etiqueta: "Estado del turno",
        valor: turno.activo ? "Abierto" : "Cerrado",
      },
      ...(turno.incidencias
        ? [{ etiqueta: "Incidencias", valor: turno.incidencias }]
        : []),
    ];

    // El informe de un turno siempre es de una sola sucursal (la de la caja).
    datos.sucursal = {
      id: turno.Caja?.Sucursal?.id ?? null,
      nombre: sucursalNombre,
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-turno-caja-${turno.id}.pdf"`,
    );

    const doc = construirInformePdf(datos);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error al generar el informe del turno en PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Error al generar el informe del turno",
      });
    }
  }
};
