import sequelize from "../config/db.js";
import {
  Acarreo,
  Barrera,
  Grua,
  Sucursal,
  Turno_Barrera,
  Turno_Barrera_Usuario,
  Turno_Grua,
  Usuario,
  Vehiculo,
} from "../models/index.js";
import { Op } from "sequelize";
import { registrarAuditoria } from "../utils/auditoria.js";
import { construirInformePdf, formatoFecha } from "../utils/informePdf.js";

/** Barrera del turno con su sucursal. */
const barreraDelTurno = {
  model: Barrera,
  include: [{ model: Sucursal, attributes: ["id", "nombre", "direccion"] }],
};

/** Playeros asignados al turno (tabla intermedia + usuario). */
const usuariosAsignadosDelTurno = (extra = {}) => ({
  model: Turno_Barrera_Usuario,
  as: "usuarios_asignados",
  include: [
    {
      model: Usuario,
      attributes: ["id", "nombre", "apellido", "legajo", "rol", "numero_turno"],
    },
  ],
  ...extra,
});

/**
 * Agrega a cada turno sus "movimientos": cuántos vehículos entraron y cuántos
 * salieron por esa barrera dentro de la ventana del turno (inicio → fin o
 * ahora). Se cuenta sobre todos los acarreos de la barrera, no sólo los que
 * ingresaron en ese turno, porque un auto puede haber entrado antes y salir
 * durante este turno.
 */
const conMovimientos = async (turnos) => {
  const barreraIds = [...new Set(turnos.map((t) => t.id_barrera))];

  const turnosDeLasBarreras = await Turno_Barrera.findAll({
    where: { id_barrera: barreraIds },
    attributes: ["id", "id_barrera"],
    include: [
      { model: Acarreo, attributes: ["id", "fecha_ingreso", "fecha_egreso"] },
    ],
  });

  // Acarreos de cada barrera (de todos sus turnos).
  const acarreosPorBarrera = new Map();
  turnosDeLasBarreras.forEach((tb) => {
    const plain = tb.get({ plain: true });
    const lista = acarreosPorBarrera.get(plain.id_barrera) ?? [];
    lista.push(...(plain.Acarreos ?? []));
    acarreosPorBarrera.set(plain.id_barrera, lista);
  });

  return turnos.map((turno) => {
    const plain = turno.get({ plain: true });
    const inicio = new Date(plain.fecha_inicio).getTime();
    const fin = plain.fecha_fin
      ? new Date(plain.fecha_fin).getTime()
      : Date.now();
    const enVentana = (fecha) => {
      if (!fecha) return false;
      const t = new Date(fecha).getTime();
      return t >= inicio && t <= fin;
    };
    const deLaBarrera = acarreosPorBarrera.get(plain.id_barrera) ?? [];

    return {
      ...plain,
      movimientos: {
        entradas: deLaBarrera.filter((a) => enVentana(a.fecha_ingreso)).length,
        salidas: deLaBarrera.filter((a) => enVentana(a.fecha_egreso)).length,
      },
    };
  });
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
                  attributes: ["id", "nombre", "apellido", "legajo", "rol", "numero_turno"],
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

// Turno de barrera activo del usuario autenticado (lo usa el home del playero
// para saber en qué barrera está). Devuelve `null` si no tiene ninguno.
export const obtenerMiTurnoBarrera = async (req, res) => {
  try {
    const asignacion = await Turno_Barrera_Usuario.findOne({
      where: { id_usuario: req.user.id },
      include: [
        {
          model: Turno_Barrera,
          required: true,
          where: { activo: true },
          include: [
            {
              model: Barrera,
              include: [
                { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
              ],
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: asignacion?.turno_barrera ?? null,
      message: "Turno de barrera obtenido exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const asignarBarrera = async (req, res) => {
  const { id_barrera, turno, id_usuarios } = req.body;
  const id_supervisor = req.user.id;

  if (!id_barrera || !turno || !Array.isArray(id_usuarios) || id_usuarios.length === 0) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    const barrera = await Barrera.findByPk(id_barrera, { transaction });
    if (!barrera) {
      await transaction.rollback();
      return res.status(404).json({ error: "Barrera no encontrada" });
    }

    const turnoActivoExistente = await Turno_Barrera.findOne({
      where: { id_barrera, activo: true },
      transaction,
    });
    if (turnoActivoExistente) {
      await transaction.rollback();
      return res.status(400).json({ error: "La barrera ya tiene un turno activo" });
    }

    const usuarios = await Usuario.findAll({
      where: { id: id_usuarios },
      transaction,
    });
    if (usuarios.length !== id_usuarios.length) {
      await transaction.rollback();
      return res.status(404).json({ error: "Uno o más usuarios no existen" });
    }

    const ocupados = await Turno_Barrera_Usuario.findAll({
      where: { id_usuario: id_usuarios },
      include: [{ model: Turno_Barrera, where: { activo: true }, required: true }],
      transaction,
    });
    if (ocupados.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Uno o más playeros ya se encuentran en un turno de barrera activo",
      });
    }

    const turnoBarrera = await Turno_Barrera.create(
      {
        id_barrera,
        turno,
        activo: true,
        fecha_inicio: new Date(),
        fecha_fin: null,
      },
      { transaction },
    );

    await Turno_Barrera_Usuario.bulkCreate(
      id_usuarios.map((id_usuario) => ({
        id_turno_barrera: turnoBarrera.id,
        id_usuario,
      })),
      { transaction },
    );

    await transaction.commit();

    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: barrera.id,
      accion: "ASIGNAR_TURNO_BARRERA",
      descripcion: `Se asignó un turno de barrera (${turno}) con ${id_usuarios.length} playero(s)`,
      req,
    });

    return res.status(201).json({
      success: true,
      data: turnoBarrera,
      message: "Turno de barrera asignado exitosamente",
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

export const finalizarTurnoBarrera = async (req, res) => {
  const { id } = req.params;
  try {
    const turno = await Turno_Barrera.findByPk(id);
    if (!turno) {
      return res.status(404).json({ error: "Turno de barrera no encontrado" });
    }
    if (!turno.activo) {
      return res.status(400).json({ error: "El turno ya está finalizado" });
    }
    await turno.update({ activo: false, fecha_fin: new Date() });
    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: turno.id_barrera,
      accion: "FINALIZAR_TURNO_BARRERA",
      descripcion: `Se finalizó el turno de barrera ${turno.id}`,
      req,
    });
    return res.status(200).json({ success: true, message: "Turno finalizado exitosamente" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

export const agregarIncidenciasBarrera = async (req, res) => {
  const { id } = req.params;
  const { incidencias } = req.body;
  try {
    const turno = await Turno_Barrera.findByPk(id);
    if (!turno) {
      return res.status(404).json({ error: "Turno de barrera no encontrado" });
    }
    const nuevas = incidencias?.trim()
      ? (turno.incidencias ? turno.incidencias + "\n" : "") + incidencias.trim()
      : turno.incidencias;
    await turno.update({ incidencias: nuevas });
    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: turno.id_barrera,
      accion: "AGREGAR_INCIDENCIA_BARRERA",
      descripcion: `Se agregó una incidencia al turno de barrera ${turno.id}`,
      req,
    });
    return res.status(200).json({ success: true, message: "Incidencia agregada", data: turno });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

export const finalizarTodosTurnosBarrera = async (req, res) => {
  const { id_sucursal } = req.params;
  if (!id_sucursal) {
    return res.status(400).json({ error: "No se proporcionó la sucursal" });
  }
  try {
    const turnosActivos = await Turno_Barrera.findAll({
      where: { activo: true },
      include: [{ model: Barrera, where: { id_sucursal }, required: true }],
    });
    if (turnosActivos.length === 0) {
      return res.status(404).json({ error: "No se encontraron turnos activos" });
    }
    const ids = turnosActivos.map((t) => t.id);
    await Turno_Barrera.update(
      { activo: false, fecha_fin: new Date() },
      { where: { id: ids } },
    );
    await registrarAuditoria({
      usuario: req.user,
      entidad: "BARRERA",
      idEntidad: id_sucursal,
      accion: "FINALIZAR_TODOS_TURNOS_BARRERA",
      descripcion: `Se finalizaron ${ids.length} turno(s) de barrera de la sucursal`,
      req,
    });
    return res.status(200).json({
      success: true,
      message: "Todos los turnos de barrera de la sucursal fueron finalizados",
      // Se devuelven los turnos cerrados: el supervisor emite un informe por
      // cada uno automáticamente (RF15 / CU13).
      data: {
        turnos: turnosActivos.map((turno) => ({
          id: turno.id,
          id_barrera: turno.id_barrera,
          turno: turno.turno,
          fecha_inicio: turno.fecha_inicio,
          fecha_fin: new Date(),
          barrera: turno.Barrera
            ? {
                id: turno.Barrera.id,
                ubicacion: turno.Barrera.ubicacion,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

// GET /barreras/turnos — todos los turnos de barrera (historial), con su
// barrera, los playeros asignados y la cantidad de acarreos del turno.
export const obtenerTurnosBarrera = async (req, res) => {
  try {
    const turnos = await Turno_Barrera.findAll({
      order: [["fecha_inicio", "DESC"]],
      include: [
        barreraDelTurno,
        usuariosAsignadosDelTurno(),
        { model: Acarreo, attributes: ["id", "fecha_egreso"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: await conMovimientos(turnos),
      message: "Turnos de barrera obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// GET /barreras/turnos/usuario/:id — turnos de barrera en los que un playero
// estuvo asignado.
export const obtenerTurnosBarreraDeUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Barrera.findAll({
      order: [["fecha_inicio", "DESC"]],
      include: [
        barreraDelTurno,
        usuariosAsignadosDelTurno({ where: { id_usuario: id }, required: true }),
        { model: Acarreo, attributes: ["id", "fecha_egreso"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: await conMovimientos(turnos),
      message: "Turnos de barrera del usuario obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /barreras/turnos/:id/detalle — detalle de un turno de barrera: la
 * barrera, los playeros asignados, las fechas y el resumen de ingresos/egresos
 * con los acarreos ingresados a la playa durante el turno.
 */
export const obtenerDetalleTurnoBarrera = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Barrera.findByPk(id, {
      include: [barreraDelTurno, usuariosAsignadosDelTurno()],
    });

    if (!turno) {
      return res.status(404).json({
        success: false,
        message: "Turno de barrera no encontrado",
      });
    }

    // Acarreos que ingresaron a la playa en este turno (sirven para el estado
    // actual de los vehículos del turno).
    const acarreos = await Acarreo.findAll({
      where: { id_turno_barrera: id },
      order: [["fecha_acarreo", "ASC"]],
      include: [{ model: Vehiculo }],
    });

    // Un egreso cuenta para el turno si ocurrió dentro de su ventana.
    const inicio = new Date(turno.fecha_inicio).getTime();
    const fin = turno.fecha_fin
      ? new Date(turno.fecha_fin).getTime()
      : Date.now();
    const enVentana = (fecha) => {
      if (!fecha) return false;
      const t = new Date(fecha).getTime();
      return t >= inicio && t <= fin;
    };

    // Movimientos de la barrera durante la ventana del turno: una entrada por
    // cada vehículo que ingresó y una salida por cada uno que egresó (aunque
    // haya entrado en un turno anterior).
    const turnosDeLaBarrera = await Turno_Barrera.findAll({
      where: { id_barrera: turno.id_barrera },
      attributes: ["id"],
    });

    const acarreosDeLaBarrera = await Acarreo.findAll({
      where: {
        id_turno_barrera: { [Op.in]: turnosDeLaBarrera.map((t) => t.id) },
      },
      include: [{ model: Vehiculo }],
    });

    const movimientos = [
      ...acarreosDeLaBarrera
        .filter((a) => enVentana(a.fecha_ingreso))
        .map((a) => ({
          id: `${a.id}-entrada`,
          tipo: "ENTRADA",
          fecha: a.fecha_ingreso,
          acarreo: a,
        })),
      ...acarreosDeLaBarrera
        .filter((a) => enVentana(a.fecha_egreso))
        .map((a) => ({
          id: `${a.id}-salida`,
          tipo: "SALIDA",
          fecha: a.fecha_egreso,
          acarreo: a,
        })),
    ].sort((x, y) => new Date(x.fecha).getTime() - new Date(y.fecha).getTime());

    const porEstado = acarreos.reduce(
      (acc, acarreo) => ({
        ingresados: acc.ingresados + (acarreo.estado === "INGRESADO" ? 1 : 0),
        cobrados: acc.cobrados + (acarreo.estado === "COBRADO" ? 1 : 0),
        egresados: acc.egresados + (acarreo.estado === "EGRESADO" ? 1 : 0),
        sinCargo: acc.sinCargo + (acarreo.estado === "SIN_CARGO" ? 1 : 0),
      }),
      { ingresados: 0, cobrados: 0, egresados: 0, sinCargo: 0 },
    );

    const totales = {
      ingresos: movimientos.filter((m) => m.tipo === "ENTRADA").length,
      egresos: movimientos.filter((m) => m.tipo === "SALIDA").length,
      // Autos que hoy siguen en la playa (estado INGRESADO).
      enPlaya: porEstado.ingresados,
      porEstado,
    };

    return res.status(200).json({
      success: true,
      data: { turno, acarreos, movimientos, totales },
      message: "Detalle del turno de barrera obtenido exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /barreras/turnos/:id/informe.pdf — informe del turno de barrera, en PDF
 * (RF15 / CU13).
 *
 * Es el informe que el supervisor consulta para ver cómo se movió la playa
 * durante un turno: la barrera, los playeros asignados, el resumen (ingresos,
 * egresos y autos que quedaron en la playa) y el detalle de los movimientos
 * (entradas y salidas) con su fecha. Sirve para turnos abiertos y cerrados.
 */
export const generarInformeTurnoBarreraPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const turno = await Turno_Barrera.findByPk(id, {
      include: [barreraDelTurno, usuariosAsignadosDelTurno()],
    });

    if (!turno) {
      return res
        .status(404)
        .json({ success: false, message: "Turno de barrera no encontrado" });
    }

    const inicio = new Date(turno.fecha_inicio).getTime();
    const finTurno = turno.fecha_fin ? new Date(turno.fecha_fin) : new Date();
    const fin = finTurno.getTime();

    const enVentana = (fecha) => {
      if (!fecha) return false;
      const momento = new Date(fecha).getTime();
      return momento >= inicio && momento <= fin;
    };

    // Todos los turnos de la barrera: un auto puede haber entrado en un turno
    // anterior y salir durante este.
    const turnosDeLaBarrera = await Turno_Barrera.findAll({
      where: { id_barrera: turno.id_barrera },
      attributes: ["id"],
    });

    const acarreosDeLaBarrera = await Acarreo.findAll({
      where: {
        id_turno_barrera: { [Op.in]: turnosDeLaBarrera.map((t) => t.id) },
      },
      include: [{ model: Vehiculo }],
    });

    const movimientos = [
      ...acarreosDeLaBarrera
        .filter((a) => enVentana(a.fecha_ingreso))
        .map((a) => ({ tipo: "ENTRADA", fecha: a.fecha_ingreso, acarreo: a })),
      ...acarreosDeLaBarrera
        .filter((a) => enVentana(a.fecha_egreso))
        .map((a) => ({ tipo: "SALIDA", fecha: a.fecha_egreso, acarreo: a })),
    ].sort((x, y) => new Date(x.fecha).getTime() - new Date(y.fecha).getTime());

    // Reporte extra del cierre: los autos que están en la playa en ese
    // momento. Se mira toda la sucursal (no sólo esta barrera), porque un auto
    // puede haber ingresado por otra barrera y seguir en la playa.
    const idSucursal = turno.Barrera?.id_sucursal;
    let autosEnPlaya = [];

    if (idSucursal) {
      const barrerasDeLaSucursal = await Barrera.findAll({
        where: { id_sucursal: idSucursal },
        attributes: ["id", "ubicacion"],
      });

      const turnosDeLaSucursal = await Turno_Barrera.findAll({
        where: {
          id_barrera: {
            [Op.in]: barrerasDeLaSucursal.map((barrera) => barrera.id),
          },
        },
        attributes: ["id", "id_barrera"],
      });

      const ubicacionPorBarrera = new Map(
        barrerasDeLaSucursal.map((barrera) => [barrera.id, barrera.ubicacion]),
      );
      const barreraPorTurno = new Map(
        turnosDeLaSucursal.map((t) => [t.id, t.id_barrera]),
      );

      // Los autos también pueden haber sido acarreados por una grúa de la
      // sucursal sin un turno de barrera asociado; se incluyen igual.
      const gruasDeLaSucursal = await Grua.findAll({
        where: { id_sucursal: idSucursal },
        attributes: ["id"],
      });

      const turnosGruaDeLaSucursal = await Turno_Grua.findAll({
        where: {
          id_grua: {
            [Op.in]: gruasDeLaSucursal.map((grua) => grua.id),
          },
        },
        attributes: ["id"],
      });

      const acarreosEnPlaya = await Acarreo.findAll({
        where: {
          // `NULL <= fecha` no se cumple en SQL: esto ya descarta los que no
          // ingresaron a la playa.
          fecha_ingreso: { [Op.lte]: finTurno },
          [Op.and]: [
            {
              [Op.or]: [
                {
                  id_turno_barrera: {
                    [Op.in]: turnosDeLaSucursal.map((t) => t.id),
                  },
                },
                {
                  id_turno_grua: {
                    [Op.in]: turnosGruaDeLaSucursal.map((t) => t.id),
                  },
                },
              ],
            },
            {
              [Op.or]: [
                { fecha_egreso: null },
                { fecha_egreso: { [Op.gt]: finTurno } },
              ],
            },
          ],
        },
        include: [{ model: Vehiculo }],
        order: [["fecha_ingreso", "ASC"]],
      });

      autosEnPlaya = acarreosEnPlaya.map((acarreo) => ({
        patente: acarreo.Vehiculo?.patente ?? "-",
        marca: acarreo.Vehiculo?.marca ?? null,
        modelo: acarreo.Vehiculo?.modelo ?? null,
        color: acarreo.Vehiculo?.color ?? null,
        fecha: acarreo.fecha_ingreso,
        barrera: acarreo.id_turno_barrera
          ? ubicacionPorBarrera.get(
              barreraPorTurno.get(acarreo.id_turno_barrera),
            ) ?? "-"
          : "Sin barrera",
      }));
    }

    const playeros = (turno.usuarios_asignados ?? [])
      .map((asignado) => asignado.Usuario)
      .filter(Boolean)
      .map((usuario) => ({
        nombre: `${usuario.nombre} ${usuario.apellido}`,
        rol: usuario.rol,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const filasPlayeros = playeros.length
      ? playeros.map((playero, indice) => ({
          etiqueta: indice === 0 ? "Playeros" : "",
          valor: `${playero.nombre}${playero.rol ? ` (${playero.rol})` : ""}`,
        }))
      : [{ etiqueta: "Playeros", valor: "-" }];

    const datos = {
      tipo: "TURNO_BARRERA",
      titulo: "Informe de cierre de turno de barrera",
      sucursal: {
        id: turno.Barrera?.Sucursal?.id ?? null,
        nombre: turno.Barrera?.Sucursal?.nombre ?? "Sucursal desconocida",
      },
      periodo: {
        desde: turno.fecha_inicio,
        hasta: finTurno,
        descripcion: `Turno ${turno.turno} · ${turno.Barrera?.ubicacion ?? "barrera"}`,
      },
      filasExtra: [
        { etiqueta: "Barrera", valor: turno.Barrera?.ubicacion ?? "-" },
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
        ...filasPlayeros,
        ...(turno.incidencias
          ? [{ etiqueta: "Incidencias", valor: turno.incidencias }]
          : []),
      ],
      // Regla de informes: el cierre del turno no muestra estados de los autos.
      // Sólo las entradas/salidas del turno y el extra de autos en la playa.
      resumen: [
        {
          etiqueta: "Ingresos a la playa",
          valor: String(
            movimientos.filter((m) => m.tipo === "ENTRADA").length,
          ),
        },
        {
          etiqueta: "Egresos de la playa",
          valor: String(
            movimientos.filter((m) => m.tipo === "SALIDA").length,
          ),
        },
        { etiqueta: "Movimientos", valor: String(movimientos.length) },
        {
          etiqueta: "Autos en playa al cierre",
          valor: String(autosEnPlaya.length),
        },
      ],
      secciones: [
        {
          titulo: "Entradas y salidas del turno",
          columnas: [
            ["tipo", "Movimiento", 80],
            ["patente", "Patente", 75],
            ["vehiculo", "Vehículo", 190],
            ["fecha", "Fecha y hora", 150],
          ],
          filas: movimientos.map((movimiento) => {
            const vehiculo = movimiento.acarreo.Vehiculo;

            return {
              tipo: movimiento.tipo,
              fecha: movimiento.fecha,
              patente: vehiculo?.patente ?? "-",
              marca: vehiculo?.marca ?? null,
              modelo: vehiculo?.modelo ?? null,
              color: vehiculo?.color ?? null,
            };
          }),
          mensajeVacio: "No hubo entradas ni salidas en el turno.",
        },
        {
          titulo: `Autos en la playa al cierre (${autosEnPlaya.length})`,
          columnas: [
            ["patente", "Patente", 75],
            ["vehiculo", "Vehículo", 190],
            ["fecha", "Ingresó", 120],
            ["barrera", "Barrera de ingreso", 110],
          ],
          filas: autosEnPlaya,
          mensajeVacio: "No hay autos en la playa al cierre del turno.",
          nuevaPagina: true,
        },
      ],
      totales: {
        cantidad: movimientos.length,
        ingresos: movimientos.filter((m) => m.tipo === "ENTRADA").length,
        egresos: movimientos.filter((m) => m.tipo === "SALIDA").length,
        enPlaya: autosEnPlaya.length,
      },
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-turno-barrera-${turno.id}.pdf"`,
    );

    const doc = construirInformePdf(datos);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error al generar el informe del turno de barrera:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Error al generar el informe del turno de barrera",
      });
    }
  }
};

// GET /barreras/turnos/barrera/:id — todos los turnos de una barrera
// (historial) con sus playeros y acarreos.
export const obtenerTurnosBarreraDeBarrera = async (req, res) => {
  const { id } = req.params;

  try {
    const turnos = await Turno_Barrera.findAll({
      where: { id_barrera: id },
      order: [["fecha_inicio", "DESC"]],
      include: [
        barreraDelTurno,
        usuariosAsignadosDelTurno(),
        { model: Acarreo, attributes: ["id", "fecha_egreso"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: await conMovimientos(turnos),
      message: "Turnos de la barrera obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
