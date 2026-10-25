import { Op } from "sequelize";
import {
  Acarreo,
  Barrera,
  Caja,
  Cobro,
  Grua,
  Sucursal,
  Turno_Barrera,
  Turno_Barrera_Usuario,
  Turno_Caja,
  Turno_Grua,
  Usuario,
  Vehiculo,
} from "../models/index.js";
import { construirInformePdf, etiquetaEstado, formatoFecha, formatoImporte } from "../utils/informePdf.js";

/**
 * Informes del sistema.
 *
 * Movimientos de autos (RF19 / RF20): ojo con la terminología de la
 * documentación fuente, "ingresos" son los autos que **entran** a la playa y
 * "egresos" los que **salen** (CU11 / CU10), no sumas de dinero.
 *
 * Cobros (RF21 / CU12): la consulta de lo recaudado, con filtros por período
 * y sucursal (y caja/usuario para Sistemas).
 *
 * El período puede ser un rango de fechas o el "turno actual" del usuario,
 * que se resuelve según el rol:
 *  - PLAYERO: su turno de barrera activo.
 *  - CAJERO: su turno de caja activo.
 *  - SUPERVISOR / SISTEMAS: los turnos de barrera activos de la sucursal.
 *
 * El alcance (qué playa se mira) es siempre la sucursal del usuario; Sistemas
 * administra todas y puede acotar a una con el parámetro `sucursal`.
 */

const TIPOS = {
  ENTRADA: {
    campo: "fecha_ingreso",
    titulo: "Entrada de vehículos",
    etiquetaFecha: "Fecha de ingreso",
  },
  SALIDA: {
    campo: "fecha_egreso",
    titulo: "Salida de vehículos",
    etiquetaFecha: "Fecha de egreso",
  },
};

/** Tipos de informe cuyos movimientos son los autos que entran o salen. */
const TIPOS_MOVIMIENTO = ["ENTRADA", "SALIDA"];

/** Tipo de informe de cobros (RF21 / CU12): lo recaudado en el período. */
const TIPO_COBRO = "COBRO";

/** Tipo de informe de acarreos: los operativos realizados en el período. */
const TIPO_ACARREO = "ACARREO";

/** Estados de un acarreo que todavía está en la playa. */
const ESTADOS_EN_PLAYA = ["ACARREADO", "INGRESADO"];

/** Roles que pueden consultar los cobros (RF21): Supervisor y Sistemas. */
const ROLES_COBROS = ["SUPERVISOR", "SISTEMAS"];

/** Roles que pueden consultar el informe de acarreos: Supervisor y Sistemas. */
const ROLES_ACARREOS = ["SUPERVISOR", "SISTEMAS"];

/** Tipo de informe consolidado de la sucursal (RF15 / CU13). */
const TIPO_CONSOLIDADO = "TURNO_SUCURSAL";

/** Roles que pueden consultar el informe consolidado (Supervisor / Sistemas). */
const ROLES_CONSOLIDADO = ["SUPERVISOR", "SISTEMAS"];

const ATRIBUTOS_USUARIO = [
  "id",
  "nombre",
  "apellido",
  "legajo",
  "rol",
  "numero_turno",
];

/** Error de negocio con el status HTTP con el que se responde. */
class ErrorInforme extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/** Verifica que la fecha exista en el calendario (rechaza 2026-02-30). */
const fechaValida = (fecha) => {
  const [anio, mes, dia] = String(fecha).split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
};

/**
 * Arma un instante a partir de una fecha (`AAAA-MM-DD`) y una hora (`HH:MM`).
 * Si la hora no viene, se usa la de por defecto (inicio del día o fin del día).
 */
const construirMomento = (fecha, hora, horaPorDefecto) => {
  if (!FORMATO_FECHA.test(String(fecha ?? ""))) {
    throw new ErrorInforme(400, "Las fechas deben tener el formato AAAA-MM-DD");
  }

  if (!fechaValida(fecha)) {
    throw new ErrorInforme(400, "La fecha no es válida");
  }

  const horaLimpia = String(hora ?? "").trim() || horaPorDefecto;

  if (!FORMATO_HORA.test(horaLimpia)) {
    throw new ErrorInforme(400, "Las horas deben tener el formato HH:MM");
  }

  const momento = new Date(
    `${fecha}T${horaLimpia.length === 5 ? `${horaLimpia}:00` : horaLimpia}`,
  );

  if (Number.isNaN(momento.getTime())) {
    throw new ErrorInforme(400, "Las fechas deben tener el formato AAAA-MM-DD");
  }

  return momento;
};

/** Turno de barrera activo del usuario (el del playero). */
const obtenerTurnoBarreraActivo = async (idUsuario) => {
  const asignacion = await Turno_Barrera_Usuario.findOne({
    where: { id_usuario: idUsuario },
    include: [
      {
        model: Turno_Barrera,
        required: true,
        where: { activo: true },
        include: [{ model: Barrera, attributes: ["id", "ubicacion"] }],
      },
    ],
  });

  return asignacion?.turno_barrera ?? null;
};

/** Turno de caja activo del usuario (el del cajero). */
const obtenerTurnoCajaActivo = async (idUsuario) => {
  return Turno_Caja.findOne({
    where: { id_usuario: idUsuario, activo: true },
    include: [{ model: Caja, attributes: ["id", "numero_caja", "referencia"] }],
  });
};

/**
 * Sucursales del informe: la del usuario, salvo que sea Sistemas, que
 * administra todas y puede pedir una en concreto con el parámetro `sucursal`
 * (el nombre de la sucursal).
 */
const obtenerSucursalesDelInforme = async (req) => {
  const nombreSolicitado = req.query.sucursal;

  if (req.user.rol === "SISTEMAS") {
    if (nombreSolicitado) {
      const sucursal = await Sucursal.findOne({
        where: { nombre: nombreSolicitado },
      });

      if (!sucursal) {
        throw new ErrorInforme(
          404,
          `No se encontró la sucursal "${nombreSolicitado}"`,
        );
      }

      return [sucursal];
    }

    // Sistemas no tiene una sucursal propia con playa: sin filtro, se ve todo.
    const sucursales = await Sucursal.findAll({ order: [["nombre", "ASC"]] });

    if (sucursales.length === 0) {
      throw new ErrorInforme(404, "No hay sucursales cargadas");
    }

    return sucursales;
  }

  const sucursal = await Sucursal.findByPk(req.user.id_sucursal);

  if (!sucursal) {
    throw new ErrorInforme(404, "No se encontró la sucursal del usuario");
  }

  return [sucursal];
};

/**
 * Barreras que entran en el informe: todas las de las sucursales del alcance.
 * Con el playero se acotan a la suya, porque trabaja en una sola barrera.
 */
const obtenerBarrerasDelInforme = async (req, sucursales) => {
  if (req.user.rol === "PLAYERO") {
    const turno = await obtenerTurnoBarreraActivo(req.user.id);

    if (!turno) {
      throw new ErrorInforme(
        409,
        "No tenés un turno de barrera activo: elegí un rango de fechas",
      );
    }

    return [turno.id_barrera];
  }

  const barreras = await Barrera.findAll({
    where: { id_sucursal: { [Op.in]: sucursales.map((s) => s.id) } },
    attributes: ["id"],
  });

  return barreras.map((b) => b.id);
};

/**
 * Ventanas de tiempo del informe. Cada ventana es un intervalo [desde, hasta]
 * y un movimiento entra si cae en alguna de ellas.
 */
const resolverVentanas = async (req, modo, desde, hasta, desdeHora, hastaHora, sucursales) => {
  if (modo === "RANGO") {
    const inicio = construirMomento(desde, desdeHora, "00:00:00");
    const fin = construirMomento(hasta, hastaHora, "23:59:59");

    if (inicio.getTime() > fin.getTime()) {
      throw new ErrorInforme(400, "La fecha 'desde' no puede ser posterior a 'hasta'");
    }

    return {
      ventanas: [{ desde: inicio, hasta: fin }],
      detalle: `Del ${desde} ${desdeHora || "00:00"} al ${hasta} ${hastaHora || "23:59"}`,
    };
  }

  // Modo TURNO: cada rol tiene una noción distinta de "su turno actual".
  if (req.user.rol === "PLAYERO") {
    const turno = await obtenerTurnoBarreraActivo(req.user.id);

    if (!turno) {
      throw new ErrorInforme(
        409,
        "No tenés un turno de barrera activo: elegí un rango de fechas",
      );
    }

    return {
      ventanas: [
        {
          desde: new Date(turno.fecha_inicio),
          hasta: turno.fecha_fin ? new Date(turno.fecha_fin) : new Date(),
        },
      ],
      detalle: `Turno de ${turno.Barrera?.ubicacion ?? "barrera"}`,
    };
  }

  if (req.user.rol === "CAJERO") {
    const turno = await obtenerTurnoCajaActivo(req.user.id);

    if (!turno) {
      throw new ErrorInforme(
        409,
        "No tenés un turno de caja abierto: elegí un rango de fechas",
      );
    }

    return {
      ventanas: [
        {
          desde: new Date(turno.apertura),
          hasta: turno.cierre ? new Date(turno.cierre) : new Date(),
        },
      ],
      detalle: `Turno de caja N° ${turno.Caja?.numero_caja ?? "-"}`,
    };
  }

  // Supervisor y Sistemas: los turnos de barrera abiertos en la sucursal.
  const turnos = await Turno_Barrera.findAll({
    where: { activo: true },
    include: [
      {
        model: Barrera,
        where: { id_sucursal: { [Op.in]: sucursales.map((s) => s.id) } },
      },
    ],
    order: [["fecha_inicio", "ASC"]],
  });

  if (turnos.length === 0) {
    throw new ErrorInforme(
      409,
      "No hay turnos de barrera abiertos en la sucursal: elegí un rango de fechas",
    );
  }

  return {
    ventanas: turnos.map((turno) => ({
      desde: new Date(turno.fecha_inicio),
      hasta: turno.fecha_fin ? new Date(turno.fecha_fin) : new Date(),
    })),
    detalle: `${turnos.length} turno(s) de barrera abierto(s)`,
  };
};

/**
 * Arma los datos del informe (movimientos + totales + período). Lo usan tanto
 * el endpoint JSON como el PDF, para que ambos muestren exactamente lo mismo.
 */
const construirDatosMovimientos = async (req) => {
  const tipo = String(req.query.tipo ?? "").toUpperCase();
  const modo = String(req.query.modo ?? "TURNO").toUpperCase();

  if (!TIPOS[tipo]) {
    throw new ErrorInforme(
      400,
      "El tipo del informe debe ser ENTRADA, SALIDA o COBRO",
    );
  }

  if (!["RANGO", "TURNO"].includes(modo)) {
    throw new ErrorInforme(400, "El modo del informe debe ser RANGO o TURNO");
  }

  if (modo === "RANGO") {
    if (!req.query.desde || !req.query.hasta) {
      throw new ErrorInforme(
        400,
        "Para generar el informe por rango de fechas hacen falta 'desde' y 'hasta'",
      );
    }
  }

  const sucursales = await obtenerSucursalesDelInforme(req);
  const idsBarrera = await obtenerBarrerasDelInforme(req, sucursales);

  if (idsBarrera.length === 0) {
    throw new ErrorInforme(
      409,
      "Las sucursales del alcance no tienen barreras con playa: elegí un rango de fechas",
    );
  }

  const { ventanas, detalle } = await resolverVentanas(
    req,
    modo,
    req.query.desde,
    req.query.hasta,
    req.query.desde_hora,
    req.query.hasta_hora,
    sucursales,
  );

  // Todos los turnos (históricos) de las barreras del alcance: un auto puede
  // haber entrado en un turno anterior y salir durante el actual, así que el
  // filtro por turno no sirve para las salidas.
  const turnos = await Turno_Barrera.findAll({
    where: { id_barrera: { [Op.in]: idsBarrera } },
    attributes: ["id"],
  });

  const idsTurnoBarrera = turnos.map((t) => t.id);

  if (idsTurnoBarrera.length === 0) {
    throw new ErrorInforme(
      409,
      "Las barreras del alcance no tienen turnos cargados",
    );
  }

  const { campo } = TIPOS[tipo];

  const acarreos = await Acarreo.findAll({
    where: {
      [campo]: { [Op.not]: null },
      id_turno_barrera: { [Op.in]: idsTurnoBarrera },
      [Op.or]: ventanas.map((ventana) => ({
        [campo]: { [Op.gte]: ventana.desde, [Op.lte]: ventana.hasta },
      })),
    },
    order: [[campo, "ASC"]],
    include: [
      { model: Vehiculo, attributes: ["id", "patente", "marca", "modelo", "color"] },
      {
        model: Turno_Barrera,
        include: [
          {
            model: Barrera,
            attributes: ["id", "ubicacion"],
            include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
          },
          // Los playeros asignados a ese turno de barrera.
          {
            model: Turno_Barrera_Usuario,
            as: "usuarios_asignados",
            required: false,
            include: [{ model: Usuario, attributes: ATRIBUTOS_USUARIO }],
          },
        ],
      },
      {
        model: Turno_Grua,
        include: [
          { model: Grua, attributes: ["id", "patente", "numero"] },
          { model: Usuario, as: "chofer", attributes: ATRIBUTOS_USUARIO },
          { model: Usuario, as: "enganchador", attributes: ATRIBUTOS_USUARIO },
        ],
      },
      {
        model: Cobro,
        attributes: [
          "id",
          "total",
          "efectivo",
          "mp",
          "fecha",
          "numero_factura",
          "estadias",
        ],
      },
    ],
  });

  const movimientos = acarreos.map((acarreo) => {
    const vehiculo = acarreo.Vehiculo;
    const barrera = acarreo.turno_barrera?.Barrera;
    const grua = acarreo.Turno_Grua?.Grua;
    const chofer = acarreo.Turno_Grua?.chofer;
    const enganchador = acarreo.Turno_Grua?.enganchador;
    const cobro = acarreo.Cobro;

    // Playeros asignados al turno de barrera del movimiento.
    const playeros = (acarreo.turno_barrera?.usuarios_asignados ?? [])
      .map((asignado) => {
        const usuario = asignado.Usuario;

        return {
          id: usuario?.id ?? null,
          nombre: usuario?.nombre ?? null,
          apellido: usuario?.apellido ?? null,
          legajo: usuario?.legajo ?? null,
          nombre_completo: usuario
            ? `${usuario.nombre} ${usuario.apellido}`
            : null,
        };
      })
      .sort((a, b) => (a.nombre_completo ?? "").localeCompare(b.nombre_completo ?? ""));

    return {
      id: acarreo.id,
      fecha: acarreo[campo],
      patente: vehiculo?.patente ?? "-",
      marca: vehiculo?.marca ?? null,
      modelo: vehiculo?.modelo ?? null,
      color: vehiculo?.color ?? null,
      estado: acarreo.estado,
      motivo: acarreo.motivo,
      direccion: acarreo.direccion,
      barrera: barrera?.ubicacion ?? null,
      sucursal: barrera?.Sucursal?.nombre ?? null,
      turno_barrera: acarreo.turno_barrera
        ? {
            id: acarreo.turno_barrera.id,
            turno: acarreo.turno_barrera.turno,
            fecha_inicio: acarreo.turno_barrera.fecha_inicio,
            fecha_fin: acarreo.turno_barrera.fecha_fin,
          }
        : null,
      playeros,
      grua: grua ? { id: grua.id, patente: grua.patente, numero: grua.numero } : null,
      chofer: chofer ? `${chofer.nombre} ${chofer.apellido}` : null,
      enganchador: enganchador ? `${enganchador.nombre} ${enganchador.apellido}` : null,
      cobro: cobro
        ? {
            id: cobro.id,
            total: Number(cobro.total),
            efectivo: Number(cobro.efectivo),
            mp: Number(cobro.mp),
            fecha: cobro.fecha,
            numero_factura: cobro.numero_factura,
            estadias: cobro.estadias,
          }
        : null,
    };
  });

  const totales = movimientos.reduce(
    (acc, movimiento) => ({
      cantidad: acc.cantidad + 1,
      cobrados: acc.cobrados + (movimiento.cobro ? 1 : 0),
      sinCargo: acc.sinCargo + (movimiento.estado === "SIN_CARGO" ? 1 : 0),
      totalCobrado: acc.totalCobrado + (movimiento.cobro?.total ?? 0),
    }),
    { cantidad: 0, cobrados: 0, sinCargo: 0, totalCobrado: 0 },
  );

  const desde = ventanas.reduce(
    (min, ventana) =>
      ventana.desde.getTime() < min.getTime() ? ventana.desde : min,
    ventanas[0].desde,
  );
  const hasta = ventanas.reduce(
    (max, ventana) =>
      ventana.hasta.getTime() > max.getTime() ? ventana.hasta : max,
    ventanas[0].hasta,
  );

  return {
    tipo,
    modo,
    titulo: TIPOS[tipo].titulo,
    etiquetaFecha: TIPOS[tipo].etiquetaFecha,
    sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
    sucursal: {
      id: sucursales.length === 1 ? sucursales[0].id : null,
      nombre:
        sucursales.length === 1
          ? sucursales[0].nombre
          : `Todas las sucursales (${sucursales.length})`,
    },
    periodo: {
      desde,
      hasta,
      descripcion:
        modo === "TURNO" ? `Turno actual · ${detalle}` : `Rango de fechas · ${detalle}`,
    },
    movimientos,
    totales: {
      ...totales,
      totalCobrado: Math.round(totales.totalCobrado * 100) / 100,
    },
  };
};

/**
 * Arma los datos del informe de cobros (RF21 / CU12): lo recaudado en el
 * período, con su detalle (patente, cajero/caja, estadías, importes).
 *
 * El alcance es la sucursal del usuario (Sistemas puede acotar con `sucursal`
 * y además filtrar por caja con `caja`). Sólo Cajero, Supervisor y Sistemas
 * pueden pedirlo.
 */
const construirDatosCobros = async (req) => {
  const modo = String(req.query.modo ?? "TURNO").toUpperCase();

  if (!["RANGO", "TURNO"].includes(modo)) {
    throw new ErrorInforme(400, "El modo del informe debe ser RANGO o TURNO");
  }

  if (!ROLES_COBROS.includes(req.user.rol)) {
    throw new ErrorInforme(
      403,
      "No tenés permiso para consultar los cobros realizados",
    );
  }

  if (modo === "RANGO") {
    if (!req.query.desde || !req.query.hasta) {
      throw new ErrorInforme(
        400,
        "Para generar el informe por rango de fechas hacen falta 'desde' y 'hasta'",
      );
    }
  }

  const sucursales = await obtenerSucursalesDelInforme(req);

  const { ventanas, detalle } = await resolverVentanasCobros(
    req,
    modo,
    req.query.desde,
    req.query.hasta,
    req.query.desde_hora,
    req.query.hasta_hora,
    sucursales,
  );

  const { caja } = req.query;

  const cobros = await Cobro.findAll({
    where: {
      [Op.or]: ventanas.map((ventana) => ({
        fecha: { [Op.gte]: ventana.desde, [Op.lte]: ventana.hasta },
      })),
    },
    order: [["fecha", "ASC"]],
    include: [
      {
        model: Turno_Caja,
        required: true,
        where: caja ? { id_caja: caja } : undefined,
        include: [
          {
            model: Caja,
            attributes: ["id", "numero_caja", "referencia", "id_sucursal"],
            required: true,
            where: {
              id_sucursal: { [Op.in]: sucursales.map((s) => s.id) },
            },
            include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
          },
          { model: Usuario, attributes: ATRIBUTOS_USUARIO },
        ],
      },
      {
        model: Acarreo,
        attributes: ["id", "motivo", "direccion", "fecha_acarreo", "estado"],
        include: [
          { model: Vehiculo, attributes: ["id", "patente", "marca", "modelo", "color"] },
        ],
      },
    ],
  });

  const desde = ventanas.reduce(
    (min, ventana) =>
      ventana.desde.getTime() < min.getTime() ? ventana.desde : min,
    ventanas[0].desde,
  );
  const hasta = ventanas.reduce(
    (max, ventana) =>
      ventana.hasta.getTime() > max.getTime() ? ventana.hasta : max,
    ventanas[0].hasta,
  );

  return armarInformeCobros({
    cobros,
    modo,
    sucursales,
    periodo: {
      desde,
      hasta,
      descripcion:
        modo === "TURNO" ? `Turno actual · ${detalle}` : `Rango de fechas · ${detalle}`,
    },
  });
};

/**
 * Arma el informe de cobros (RF21 / CU12) a partir de los cobros ya cargados
 * (con `Turno_Caja` → `Caja`/`Usuario` y `Acarreo` → `Vehiculo`). Se separa
 * para reutilizarlo en el informe del turno de caja (al cerrarlo).
 */
export const armarInformeCobros = ({
  cobros,
  modo,
  sucursales,
  periodo,
  responsable = null,
  arqueo = null,
}) => {
  const movimientos = cobros.map((cobro) => {
    const turno = cobro.Turno_Caja;
    const cajaDelCobro = turno?.Caja;
    const usuario = turno?.Usuario;
    const acarreo = cobro.Acarreo;
    const vehiculo = acarreo?.Vehiculo;

    return {
      id: cobro.id,
      fecha: cobro.fecha,
      patente: vehiculo?.patente ?? "-",
      marca: vehiculo?.marca ?? null,
      modelo: vehiculo?.modelo ?? null,
      color: vehiculo?.color ?? null,
      estadias: cobro.estadias ?? null,
      total: Number(cobro.total),
      efectivo: Number(cobro.efectivo),
      mp: Number(cobro.mp),
      numero_factura: cobro.numero_factura,
      motivo: acarreo?.motivo ?? null,
      fecha_acarreo: acarreo?.fecha_acarreo ?? null,
      caja: cajaDelCobro
        ? {
            id: cajaDelCobro.id,
            numero_caja: cajaDelCobro.numero_caja,
            referencia: cajaDelCobro.referencia,
          }
        : null,
      sucursal: cajaDelCobro?.Sucursal?.nombre ?? null,
      cajero: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
      turno_caja: turno?.turno ?? null,
    };
  });

  const totales = movimientos.reduce(
    (acc, movimiento) => ({
      cantidad: acc.cantidad + 1,
      total: acc.total + movimiento.total,
      efectivo: acc.efectivo + movimiento.efectivo,
      mp: acc.mp + movimiento.mp,
      estadias: acc.estadias + (movimiento.estadias ?? 0),
    }),
    { cantidad: 0, total: 0, efectivo: 0, mp: 0, estadias: 0 },
  );

  const redondear = (valor) => Math.round(valor * 100) / 100;

  return {
    tipo: TIPO_COBRO,
    modo,
    titulo: "Cobros realizados",
    etiquetaFecha: "Fecha del cobro",
    etiquetaImporte: "Total cobrado",
    sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
    sucursal: {
      id: sucursales.length === 1 ? sucursales[0].id : null,
      nombre:
        sucursales.length === 1
          ? sucursales[0].nombre
          : `Todas las sucursales (${sucursales.length})`,
    },
    periodo,
    movimientos,
    responsable,
    arqueo,
    totales: {
      cantidad: totales.cantidad,
      estadias: totales.estadias,
      total: redondear(totales.total),
      efectivo: redondear(totales.efectivo),
      mp: redondear(totales.mp),
    },
  };
};

/** Fecha de hoy en formato AAAA-MM-DD (hora local del servidor). */
const fechaDeHoy = () => {
  const d = new Date();
  const dosDigitos = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
};

/**
 * Sucursal del informe consolidado: la del supervisor; Sistemas administra
 * todas y tiene que indicar de cuál se trata (el informe es de una sola
 * sucursal, con sus cajas, barreras y grúas).
 */
const obtenerSucursalDelInforme = async (req) => {
  if (req.user.rol === "SISTEMAS") {
    const nombre = req.query.sucursal;

    if (!nombre) {
      throw new ErrorInforme(
        400,
        "Indicá la sucursal del informe (parámetro 'sucursal')",
      );
    }

    const sucursal = await Sucursal.findOne({ where: { nombre } });

    if (!sucursal) {
      throw new ErrorInforme(
        404,
        `No se encontró la sucursal "${nombre}"`,
      );
    }

    return sucursal;
  }

  const sucursal = await Sucursal.findByPk(req.user.id_sucursal);

  if (!sucursal) {
    throw new ErrorInforme(404, "No se encontró la sucursal del usuario");
  }

  return sucursal;
};

/**
 * Arma el **informe consolidado de la sucursal** (RF15 / CU13): en un mismo
 * turno, lo que pasó con las cajas (cobros), las barreras (movimientos de la
 * playa) y las grúas (acarreos).
 *
 * Se pide una fecha (por defecto, hoy) y, opcionalmente, un turno (1, 2 o 3).
 * Sólo lo pueden ver el supervisor y sistemas.
 */
const construirDatosTurnoSucursal = async (req) => {
  if (!ROLES_CONSOLIDADO.includes(req.user.rol)) {
    throw new ErrorInforme(
      403,
      "No tenés permiso para consultar el informe de la sucursal",
    );
  }

  const sucursal = await obtenerSucursalDelInforme(req);

  const fecha = String(req.query.fecha ?? "").trim() || fechaDeHoy();

  if (!FORMATO_FECHA.test(fecha)) {
    throw new ErrorInforme(400, "La fecha debe tener el formato AAAA-MM-DD");
  }

  if (!fechaValida(fecha)) {
    throw new ErrorInforme(400, "La fecha no es válida");
  }

  const turno = req.query.turno ? String(req.query.turno).trim() : null;

  if (turno && !["1", "2", "3"].includes(turno)) {
    throw new ErrorInforme(400, "El turno debe ser 1, 2 o 3");
  }

  const desde = new Date(`${fecha}T00:00:00`);
  const hasta = new Date(`${fecha}T23:59:59.999`);

  const filtroTurno = turno ? { turno } : {};

  // ------------------------------------------------------------------
  // Cajas: los turnos de caja del día (o del turno pedido) y sus cobros.
  // ------------------------------------------------------------------
  const turnosCaja = await Turno_Caja.findAll({
    where: {
      ...filtroTurno,
      apertura: { [Op.lt]: hasta },
      [Op.or]: [{ cierre: null }, { cierre: { [Op.gt]: desde } }],
    },
    include: [
      {
        model: Caja,
        required: true,
        attributes: ["id", "numero_caja", "referencia"],
        where: { id_sucursal: sucursal.id },
      },
      { model: Usuario, attributes: ATRIBUTOS_USUARIO },
    ],
    order: [["apertura", "ASC"]],
  });

  const cobros = turnosCaja.length
    ? await Cobro.findAll({
        where: {
          id_turno_caja: { [Op.in]: turnosCaja.map((t) => t.id) },
          fecha: { [Op.between]: [desde, hasta] },
        },
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
                attributes: ["id", "patente", "marca", "modelo", "color"],
              },
            ],
          },
        ],
      })
    : [];

  // ------------------------------------------------------------------
  // Barreras: los turnos del día y los movimientos de la playa.
  // ------------------------------------------------------------------
  const turnosBarrera = await Turno_Barrera.findAll({
    where: {
      ...filtroTurno,
      fecha_inicio: { [Op.lt]: hasta },
      [Op.or]: [{ fecha_fin: null }, { fecha_fin: { [Op.gt]: desde } }],
    },
    include: [
      {
        model: Barrera,
        required: true,
        attributes: ["id", "ubicacion"],
        where: { id_sucursal: sucursal.id },
      },
    ],
    order: [["fecha_inicio", "ASC"]],
  });

  // La ventana de cada turno se recorta al día del informe: un turno que cruza
  // la medianoche aporta a cada día sólo la parte que le corresponde.
  const ventanas = turnosBarrera.map((t) => {
    const inicio = new Date(t.fecha_inicio).getTime();
    const fin = t.fecha_fin ? new Date(t.fecha_fin).getTime() : Date.now();

    return {
      desde: Math.max(inicio, desde.getTime()),
      hasta: Math.min(fin, hasta.getTime()),
    };
  });

  const movimientos = [];

  if (ventanas.length > 0) {
    // Todos los turnos (históricos) de las barreras: un auto puede haber
    // entrado en un turno anterior y salir durante el actual.
    const idsBarrera = [...new Set(turnosBarrera.map((t) => t.id_barrera))];

    const turnosDeLasBarreras = await Turno_Barrera.findAll({
      where: { id_barrera: { [Op.in]: idsBarrera } },
      attributes: ["id"],
      include: [{ model: Barrera, attributes: ["id", "ubicacion"] }],
    });

    const barreraPorTurno = new Map(
      turnosDeLasBarreras.map((t) => [t.id, t.Barrera?.ubicacion ?? "-"]),
    );

    const acarreos = await Acarreo.findAll({
      where: {
        id_turno_barrera: {
          [Op.in]: turnosDeLasBarreras.map((t) => t.id),
        },
      },
      include: [
        {
          model: Vehiculo,
          attributes: ["id", "patente", "marca", "modelo", "color"],
        },
      ],
    });

    const enVentana = (fecha) => {
      if (!fecha) return false;
      const momento = new Date(fecha).getTime();
      return ventanas.some((v) => momento >= v.desde && momento <= v.hasta);
    };

    const aMovimiento = (acarreo, tipo, fecha) => {
      const vehiculo = acarreo.Vehiculo;

      return {
        tipo,
        fecha,
        patente: vehiculo?.patente ?? "-",
        marca: vehiculo?.marca ?? null,
        modelo: vehiculo?.modelo ?? null,
        color: vehiculo?.color ?? null,
        barrera: barreraPorTurno.get(acarreo.id_turno_barrera) ?? "-",
      };
    };

    movimientos.push(
      ...acarreos
        .filter((a) => enVentana(a.fecha_ingreso))
        .map((a) => aMovimiento(a, "ENTRADA", a.fecha_ingreso)),
      ...acarreos
        .filter((a) => enVentana(a.fecha_egreso))
        .map((a) => aMovimiento(a, "SALIDA", a.fecha_egreso)),
    );

    movimientos.sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );
  }

  // ------------------------------------------------------------------
  // Grúas: los turnos del día y los acarreos que hicieron.
  // ------------------------------------------------------------------
  const turnosGrua = await Turno_Grua.findAll({
    where: {
      ...filtroTurno,
      fecha_inicio: { [Op.lt]: hasta },
      [Op.or]: [{ fecha_fin: null }, { fecha_fin: { [Op.gt]: desde } }],
    },
    include: [
      {
        model: Grua,
        required: true,
        attributes: ["id", "patente", "numero"],
        where: { id_sucursal: sucursal.id },
      },
    ],
    order: [["fecha_inicio", "ASC"]],
  });

  const acarreosGrua = turnosGrua.length
    ? await Acarreo.findAll({
        where: {
          id_turno_grua: { [Op.in]: turnosGrua.map((t) => t.id) },
          fecha_acarreo: { [Op.between]: [desde, hasta] },
        },
        order: [["fecha_acarreo", "ASC"]],
        include: [
          {
            model: Vehiculo,
            attributes: ["id", "patente", "marca", "modelo", "color"],
          },
          {
            model: Turno_Grua,
            attributes: ["id"],
            include: [{ model: Grua, attributes: ["id", "patente", "numero"] }],
          },
        ],
      })
    : [];

  const fechaTexto = formatoFecha(desde).split(" ")[0];
  const descripcionPeriodo = turno
    ? `Turno ${turno} · ${fechaTexto}`
    : `Todos los turnos del ${fechaTexto}`;

  const cobrosInforme = armarInformeCobros({
    cobros,
    modo: "TURNO",
    sucursales: [sucursal],
    periodo: {
      desde,
      hasta,
      descripcion: descripcionPeriodo,
    },
  });

  const totalCobrado = cobrosInforme.totales.total;
  const ingresos = movimientos.filter((m) => m.tipo === "ENTRADA").length;
  const egresos = movimientos.filter((m) => m.tipo === "SALIDA").length;

  const datos = {
    tipo: TIPO_CONSOLIDADO,
    titulo: "Informe consolidado de la sucursal",
    sucursal: { id: sucursal.id, nombre: sucursal.nombre },
    periodo: {
      desde,
      hasta,
      descripcion: descripcionPeriodo,
    },
    filasExtra: [
      { etiqueta: "Turno", valor: turno ? `Turno ${turno}` : "Todos los turnos" },
      {
        etiqueta: "Turnos de caja",
        valor: `${turnosCaja.length} · ${formatoImporte(totalCobrado)}`,
      },
      {
        etiqueta: "Turnos de barrera",
        valor: `${turnosBarrera.length}`,
      },
      {
        etiqueta: "Turnos de grúa",
        valor: `${turnosGrua.length}`,
      },
    ],
    resumen: [
      { etiqueta: "Cobros", valor: String(cobrosInforme.totales.cantidad) },
      { etiqueta: "Total cobrado", valor: formatoImporte(totalCobrado) },
      { etiqueta: "Ingresos a la playa", valor: String(ingresos) },
      { etiqueta: "Egresos de la playa", valor: String(egresos) },
      { etiqueta: "Acarreos de las grúas", valor: String(acarreosGrua.length) },
    ],
    secciones: [
      {
        titulo: "Cobros del turno",
        columnas: [
          ["fecha", "Fecha del cobro", 95],
          ["patente", "Patente", 75],
          ["vehiculo", "Vehículo", 135],
          ["cajero", "Cajero", 110],
          ["total", "Total", 80],
        ],
        filas: cobrosInforme.movimientos,
        mensajeVacio: "No hubo cobros en el turno.",
      },
      {
        titulo: "Movimientos en las barreras",
        columnas: [
          ["tipo", "Movimiento", 75],
          ["patente", "Patente", 75],
          ["vehiculo", "Vehículo", 140],
          ["barrera", "Barrera", 105],
          ["fecha", "Fecha y hora", 100],
        ],
        filas: movimientos,
        mensajeVacio: "No hubo entradas ni salidas en el turno.",
      },
      {
        titulo: "Acarreos de las grúas",
        columnas: [
          ["fecha", "Fecha y hora", 95],
          ["patente", "Patente", 75],
          ["vehiculo", "Vehículo", 130],
          ["grua", "Grúa", 95],
          ["direccion", "Dirección", 100],
        ],
        filas: acarreosGrua.map((acarreo) => {
          const vehiculo = acarreo.Vehiculo;

          return {
            fecha: acarreo.fecha_acarreo,
            patente: vehiculo?.patente ?? "-",
            marca: vehiculo?.marca ?? null,
            modelo: vehiculo?.modelo ?? null,
            color: vehiculo?.color ?? null,
            grua: acarreo.Turno_Grua?.Grua?.patente ?? "-",
            direccion: acarreo.direccion ?? "-",
          };
        }),
        mensajeVacio: "No hubo acarreos en el turno.",
      },
    ],
  };

  return {
    ...datos,
    modo: "TURNO",
    etiquetaFecha: "Fecha del cobro",
    movimientos: cobrosInforme.movimientos,
    totales: {
      ...cobrosInforme.totales,
      ingresos,
      egresos,
      acarreos: acarreosGrua.length,
    },
  };
};

/**
 * Ventanas de tiempo del informe de cobros. El "turno actual" depende del rol:
 * el cajero mira su turno de caja; supervisor/sistemas, los turnos de caja
 * abiertos de las cajas del alcance.
 */const resolverVentanasCobros = async (
  req,
  modo,
  desde,
  hasta,
  desdeHora,
  hastaHora,
  sucursales,
) => {
  if (modo === "RANGO") {
    const inicio = construirMomento(desde, desdeHora, "00:00:00");
    const fin = construirMomento(hasta, hastaHora, "23:59:59");

    if (inicio.getTime() > fin.getTime()) {
      throw new ErrorInforme(
        400,
        "La fecha 'desde' no puede ser posterior a 'hasta'",
      );
    }

    return {
      ventanas: [{ desde: inicio, hasta: fin }],
      detalle: `Del ${desde} ${desdeHora || "00:00"} al ${hasta} ${hastaHora || "23:59"}`,
    };
  }

  if (req.user.rol === "CAJERO") {
    const turno = await obtenerTurnoCajaActivo(req.user.id);

    if (!turno) {
      throw new ErrorInforme(
        409,
        "No tenés un turno de caja abierto: elegí un rango de fechas",
      );
    }

    return {
      ventanas: [
        {
          desde: new Date(turno.apertura),
          hasta: turno.cierre ? new Date(turno.cierre) : new Date(),
        },
      ],
      detalle: `Turno de caja N° ${turno.Caja?.numero_caja ?? "-"}`,
    };
  }

  // Supervisor y Sistemas: los turnos de caja abiertos de las cajas del alcance.
  const turnos = await Turno_Caja.findAll({
    where: { activo: true },
    include: [
      {
        model: Caja,
        required: true,
        where: { id_sucursal: { [Op.in]: sucursales.map((s) => s.id) } },
      },
    ],
    order: [["apertura", "ASC"]],
  });

  if (turnos.length === 0) {
    throw new ErrorInforme(
      409,
      "No hay turnos de caja abiertos en la sucursal: elegí un rango de fechas",
    );
  }

  return {
    ventanas: turnos.map((turno) => ({
      desde: new Date(turno.apertura),
      hasta: turno.cierre ? new Date(turno.cierre) : new Date(),
    })),
    detalle: `${turnos.length} turno(s) de caja abierto(s)`,
  };
};

/**
 * Resuelve las ventanas del informe de acarreos.
 *
 * En modo RANGO usa el rango pedido. En modo TURNO usa los turnos de grúa
 * abiertos del alcance: para un GRUERO, los suyos; para el resto, los de las
 * grúas de las sucursales del informe. Devuelve también los ids de esos turnos
 * para que el informe muestre exactamente los acarreos del turno.
 */
const resolverVentanasAcarreos = async (
  req,
  modo,
  desde,
  hasta,
  desdeHora,
  hastaHora,
  sucursales,
) => {
  if (modo === "RANGO") {
    const inicio = construirMomento(desde, desdeHora, "00:00:00");
    const fin = construirMomento(hasta, hastaHora, "23:59:59");

    if (inicio.getTime() > fin.getTime()) {
      throw new ErrorInforme(
        400,
        "La fecha 'desde' no puede ser posterior a 'hasta'",
      );
    }

    return {
      ventanas: [{ desde: inicio, hasta: fin }],
      detalle: `Del ${desde} ${desdeHora || "00:00"} al ${hasta} ${hastaHora || "23:59"}`,
      idsTurnoGrua: null,
    };
  }

  const where = { activo: true };

  if (req.user.rol === "GRUERO") {
    where[Op.or] = [
      { id_chofer: req.user.id },
      { id_enganchador: req.user.id },
    ];
  }

  const turnos = await Turno_Grua.findAll({
    where,
    include: [
      {
        model: Grua,
        required: true,
        attributes: ["id", "patente", "numero", "id_sucursal"],
        where: { id_sucursal: { [Op.in]: sucursales.map((s) => s.id) } },
      },
    ],
    order: [["fecha_inicio", "ASC"]],
  });

  if (turnos.length === 0) {
    throw new ErrorInforme(
      409,
      "No hay turnos de grúa abiertos en la sucursal: elegí un rango de fechas",
    );
  }

  return {
    ventanas: turnos.map((turno) => ({
      desde: new Date(turno.fecha_inicio),
      hasta: turno.fecha_fin ? new Date(turno.fecha_fin) : new Date(),
    })),
    detalle: `${turnos.length} turno(s) de grúa abierto(s)`,
    idsTurnoGrua: turnos.map((turno) => turno.id),
  };
};

/**
 * Arma el informe de acarreos: los operativos registrados en el período, con
 * vehículo, sucursal, grúa, personal, motivo, dirección y estado.
 *
 * Es un informe operativo (no un cierre de turno): puede incluir acarreos de
 * varios turnos de grúa y muestra el estado actual de cada acarreo.
 */
const construirDatosAcarreos = async (req) => {
  const modo = String(req.query.modo ?? "TURNO").toUpperCase();

  if (!["RANGO", "TURNO"].includes(modo)) {
    throw new ErrorInforme(400, "El modo del informe debe ser RANGO o TURNO");
  }

  if (modo === "RANGO") {
    if (!req.query.desde || !req.query.hasta) {
      throw new ErrorInforme(
        400,
        "Para generar el informe por rango de fechas hacen falta 'desde' y 'hasta'",
      );
    }
  }

  if (!ROLES_ACARREOS.includes(req.user.rol)) {
    throw new ErrorInforme(
      403,
      "No tenés permiso para consultar los acarreos realizados",
    );
  }

  const sucursales = await obtenerSucursalesDelInforme(req);
  const { ventanas, detalle, idsTurnoGrua } =
    await resolverVentanasAcarreos(
      req,
      modo,
      req.query.desde,
      req.query.hasta,
      req.query.desde_hora,
      req.query.hasta_hora,
      sucursales,
    );

  const where = {
    [Op.or]: ventanas.map((ventana) => ({
      fecha_acarreo: { [Op.gte]: ventana.desde, [Op.lte]: ventana.hasta },
    })),
  };

  if (idsTurnoGrua) {
    where.id_turno_grua = { [Op.in]: idsTurnoGrua };
  }

  const acarreos = await Acarreo.findAll({
    where,
    order: [["fecha_acarreo", "ASC"]],
    include: [
      {
        model: Vehiculo,
        attributes: ["id", "patente", "marca", "modelo", "color"],
      },
      {
        model: Turno_Grua,
        required: true,
        include: [
          {
            model: Grua,
            required: true,
            attributes: ["id", "patente", "numero", "id_sucursal"],
            where: {
              id_sucursal: { [Op.in]: sucursales.map((s) => s.id) },
            },
            include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
          },
          { model: Usuario, as: "chofer", attributes: ATRIBUTOS_USUARIO },
          {
            model: Usuario,
            as: "enganchador",
            attributes: ATRIBUTOS_USUARIO,
          },
          {
            model: Usuario,
            as: "supervisor",
            attributes: ATRIBUTOS_USUARIO,
          },
        ],
      },
    ],
  });

  const nombrePersona = (usuario) =>
    usuario ? `${usuario.nombre} ${usuario.apellido}` : null;

  const movimientos = acarreos.map((acarreo) => {
    const vehiculo = acarreo.Vehiculo;
    const turno = acarreo.Turno_Grua;
    const grua = turno?.Grua;
    const chofer = nombrePersona(turno?.chofer);
    const enganchador = nombrePersona(turno?.enganchador);
    const personal = [chofer, enganchador].filter(Boolean).join(" / ") || null;

    return {
      id: acarreo.id,
      fecha: acarreo.fecha_acarreo,
      patente: vehiculo?.patente ?? "-",
      marca: vehiculo?.marca ?? null,
      modelo: vehiculo?.modelo ?? null,
      color: vehiculo?.color ?? null,
      estado: acarreo.estado,
      motivo: acarreo.motivo,
      direccion: acarreo.direccion,
      numero_acta: acarreo.numero_acta,
      tuvo_siniestro: acarreo.tuvo_siniestro,
      fue_denuncia: acarreo.fue_denuncia,
      sucursal: grua?.Sucursal?.nombre ?? null,
      grua: grua
        ? { id: grua.id, patente: grua.patente, numero: grua.numero }
        : null,
      chofer,
      enganchador,
      supervisor: nombrePersona(turno?.supervisor),
      personal,
      turno_grua: turno
        ? {
            id: turno.id,
            turno: turno.turno,
            fecha_inicio: turno.fecha_inicio,
            fecha_fin: turno.fecha_fin,
          }
        : null,
    };
  });

  const totales = movimientos.reduce(
    (acc, movimiento) => ({
      cantidad: acc.cantidad + 1,
      enPlaya:
        acc.enPlaya +
        (ESTADOS_EN_PLAYA.includes(movimiento.estado) ? 1 : 0),
      cobrados: acc.cobrados + (movimiento.estado === "COBRADO" ? 1 : 0),
      sinCargo: acc.sinCargo + (movimiento.estado === "SIN_CARGO" ? 1 : 0),
      egresados: acc.egresados + (movimiento.estado === "EGRESADO" ? 1 : 0),
    }),
    { cantidad: 0, enPlaya: 0, cobrados: 0, sinCargo: 0, egresados: 0 },
  );

  const desde = ventanas.reduce(
    (min, ventana) =>
      ventana.desde.getTime() < min.getTime() ? ventana.desde : min,
    ventanas[0].desde,
  );
  const hasta = ventanas.reduce(
    (max, ventana) =>
      ventana.hasta.getTime() > max.getTime() ? ventana.hasta : max,
    ventanas[0].hasta,
  );

  // Cuando el informe abarca varias sucursales, el PDF necesita una columna
  // para distinguirlas. En ese caso se reemplaza "Personal" por "Sucursal".
  const columnasPdf =
    sucursales.length > 1
      ? [
          ["fecha", "Fecha/hora", 80],
          ["patente", "Patente", 55],
          ["vehiculo", "Vehículo", 80],
          ["sucursal", "Sucursal", 65],
          ["grua", "Grúa", 50],
          ["motivo", "Motivo", 110],
          ["estado", "Estado", 55],
        ]
      : undefined;

  return {
    tipo: TIPO_ACARREO,
    modo,
    titulo: "Acarreos realizados",
    etiquetaFecha: "Fecha del acarreo",
    sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
    sucursal: {
      id: sucursales.length === 1 ? sucursales[0].id : null,
      nombre:
        sucursales.length === 1
          ? sucursales[0].nombre
          : `Todas las sucursales (${sucursales.length})`,
    },
    periodo: {
      desde,
      hasta,
      descripcion:
        modo === "TURNO"
          ? `Turno actual · ${detalle}`
          : `Rango de fechas · ${detalle}`,
    },
    columnasPdf,
    movimientos,
    totales,
  };
};

/** Despacha el armado del informe según el tipo pedido. */
const obtenerDatosInforme = async (req) => {
  const tipo = String(req.query.tipo ?? "").toUpperCase();

  if (tipo === TIPO_COBRO) {
    return construirDatosCobros(req);
  }

  if (tipo === TIPO_ACARREO) {
    return construirDatosAcarreos(req);
  }

  if (TIPOS_MOVIMIENTO.includes(tipo)) {
    return construirDatosMovimientos(req);
  }

  throw new ErrorInforme(
    400,
    "El tipo del informe debe ser ENTRADA, SALIDA, COBRO o ACARREO",
  );
};

/** GET /informes/movimientos — listado de entradas o salidas de autos. */
export const obtenerMovimientos = async (req, res) => {
  try {
    const datos = await obtenerDatosInforme(req);

    return res.status(200).json({
      success: true,
      data: datos,
      message: "Informe generado exitosamente",
    });
  } catch (error) {
    if (error instanceof ErrorInforme) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /informes/movimientos.pdf — el mismo informe, en PDF, para imprimir.
 */
export const generarInformeMovimientosPdf = async (req, res) => {
  try {
    const datos = await obtenerDatosInforme(req);
    const doc = construirInformePdf(datos);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-${datos.tipo.toLowerCase()}-${Date.now()}.pdf"`,
    );

    doc.pipe(res);
    doc.end();
  } catch (error) {
    if (error instanceof ErrorInforme) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /informes/consolidado — informe consolidado de la sucursal (RF15 / CU13):
 * en un mismo turno, los cobros de las cajas, los movimientos de las barreras
 * y los acarreos de las grúas.
 */
export const obtenerInformeTurnoSucursal = async (req, res) => {
  try {
    const datos = await construirDatosTurnoSucursal(req);

    return res.status(200).json({
      success: true,
      data: datos,
      message: "Informe consolidado generado exitosamente",
    });
  } catch (error) {
    if (error instanceof ErrorInforme) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /informes/consolidado.pdf — el informe consolidado de la sucursal, en
 * PDF, para imprimir.
 */
export const generarInformeTurnoSucursalPdf = async (req, res) => {
  try {
    const datos = await construirDatosTurnoSucursal(req);
    const doc = construirInformePdf(datos);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-sucursal-${Date.now()}.pdf"`,
    );

    doc.pipe(res);
    doc.end();
  } catch (error) {
    if (error instanceof ErrorInforme) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// ---------------------------------------------------------------------------
// Informe de fin de turno (detallado)
// ---------------------------------------------------------------------------

/** Tipo del informe detallado de fin de turno. */
const TIPO_FIN_TURNO = "FIN_TURNO";

/** Sólo el supervisor y sistemas pueden pedir el informe detallado. */
const ROLES_FIN_TURNO = ["SUPERVISOR", "SISTEMAS"];

/**
 * Ventanas fijas del informe de fin de turno. El turno noche cruza la
 * medianoche: la fecha que se elige es la del inicio (23:00).
 */
const PERIODOS_FIN_TURNO = {
  MANANA: {
    etiqueta: "Turno mañana",
    desde: "07:00:00",
    hasta: "15:00:00",
  },
  TARDE: {
    etiqueta: "Turno tarde",
    desde: "15:00:00",
    hasta: "23:00:00",
  },
  NOCHE: {
    etiqueta: "Turno noche",
    desde: "23:00:00",
    hasta: "07:00:00",
    cruzaMedianoche: true,
  },
};

/** Nombre y rol de un usuario, para los informes. */
const nombreUsuarioConRol = (usuario) =>
  usuario
    ? `${usuario.nombre} ${usuario.apellido}${usuario.rol ? ` (${usuario.rol})` : ""}`
    : "-";

/**
 * Resuelve la ventana del informe de fin de turno:
 *  - `periodo=MANANA|TARDE|NOCHE` + `fecha` (AAAA-MM-DD, por defecto hoy).
 *  - `periodo=RANGO` + `desde` y `hasta` (AAAA-MM-DD), con `desde_hora` y
 *    `hasta_hora` opcionales.
 *
 * La ventana de los turnos fijos es semiabierta ([desde, hasta)): el instante
 * exacto del cambio de turno pertenece al turno que empieza. Para el rango
 * personalizado, `hasta` incluye todo el segundo indicado.
 */
const resolverPeriodoFinTurno = (req) => {
  const periodo = String(req.query.periodo ?? "MANANA").toUpperCase();

  if (periodo === "RANGO") {
    const fechaDesde = String(req.query.desde ?? "").trim();
    const fechaHasta = String(req.query.hasta ?? "").trim();

    if (!fechaDesde || !fechaHasta) {
      throw new ErrorInforme(400, "Indicá las fechas 'desde' y 'hasta'");
    }

    const desde = construirMomento(
      fechaDesde,
      req.query.desde_hora,
      "00:00:00",
    );
    const hastaBase = construirMomento(
      fechaHasta,
      req.query.hasta_hora,
      "23:59:59",
    );
    const hasta = new Date(hastaBase.getTime() + 999);

    if (desde.getTime() > hasta.getTime()) {
      throw new ErrorInforme(
        400,
        "La fecha 'desde' no puede ser posterior a 'hasta'",
      );
    }

    return {
      periodo,
      desde,
      hasta,
      hastaMostrar: hasta,
      descripcion: `Rango de fechas · ${formatoFecha(desde)} al ${formatoFecha(hasta)}`,
    };
  }

  const config = PERIODOS_FIN_TURNO[periodo];

  if (!config) {
    throw new ErrorInforme(
      400,
      "El período debe ser MANANA, TARDE, NOCHE o RANGO",
    );
  }

  const fecha = String(req.query.fecha ?? "").trim() || fechaDeHoy();

  if (!FORMATO_FECHA.test(fecha)) {
    throw new ErrorInforme(400, "La fecha debe tener el formato AAAA-MM-DD");
  }

  if (!fechaValida(fecha)) {
    throw new ErrorInforme(400, "La fecha no es válida");
  }

  const desde = new Date(`${fecha}T${config.desde}`);
  const finExclusivo = new Date(`${fecha}T${config.hasta}`);

  if (Number.isNaN(desde.getTime()) || Number.isNaN(finExclusivo.getTime())) {
    throw new ErrorInforme(400, "La fecha no es válida");
  }

  if (config.cruzaMedianoche) {
    finExclusivo.setDate(finExclusivo.getDate() + 1);
  }

  const hasta = new Date(finExclusivo.getTime() - 1);

  return {
    periodo,
    desde,
    hasta,
    hastaMostrar: finExclusivo,
    descripcion: `${config.etiqueta} · ${formatoFecha(desde)} al ${formatoFecha(finExclusivo)}`,
  };
};

/**
 * Arma el **informe de fin de turno** (detallado), el único que muestra la
 * cuenta de vehículos por estado. Incluye, para la ventana pedida:
 *  - los turnos de caja, barrera y grúa con sus usuarios y roles;
 *  - los vehículos con actividad en el período, por estado al cierre;
 *  - los autos que quedaron en la playa al cierre;
 *  - los movimientos de cada barrera;
 *  - los acarreos de cada grúa;
 *  - los cobros de cada caja;
 *  - las incidencias de los turnos.
 *
 * Sólo supervisor y sistemas.
 */
const construirDatosFinTurno = async (req) => {
  if (!ROLES_FIN_TURNO.includes(req.user.rol)) {
    throw new ErrorInforme(
      403,
      "Sólo supervisores y sistemas pueden generar el informe de fin de turno",
    );
  }

  const sucursal = await obtenerSucursalDelInforme(req);
  const { periodo, desde, hasta, hastaMostrar, descripcion } =
    resolverPeriodoFinTurno(req);

  const enRango = (fecha) => {
    if (!fecha) return false;
    const momento = new Date(fecha).getTime();
    return momento >= desde.getTime() && momento <= hasta.getTime();
  };

  // Entidades de la sucursal. Se listan todas: las secciones de cada barrera,
  // grúa y caja se muestran aunque no hayan tenido movimiento.
  const [cajas, barreras, gruas] = await Promise.all([
    Caja.findAll({
      where: { id_sucursal: sucursal.id },
      attributes: ["id", "numero_caja", "referencia"],
      order: [["numero_caja", "ASC"]],
    }),
    Barrera.findAll({
      where: { id_sucursal: sucursal.id },
      attributes: ["id", "ubicacion"],
      order: [["ubicacion", "ASC"]],
    }),
    Grua.findAll({
      where: { id_sucursal: sucursal.id },
      attributes: ["id", "patente", "numero"],
      order: [["numero", "ASC"]],
    }),
  ]);

  // ------------------------------------------------------------------
  // Turnos que se solapan con la ventana.
  // ------------------------------------------------------------------
  const [turnosCaja, turnosBarrera, turnosGrua] = await Promise.all([
    Turno_Caja.findAll({
      where: {
        apertura: { [Op.lte]: hasta },
        [Op.or]: [{ cierre: null }, { cierre: { [Op.gte]: desde } }],
      },
      include: [
        {
          model: Caja,
          required: true,
          attributes: ["id", "numero_caja", "referencia"],
          where: { id_sucursal: sucursal.id },
        },
        { model: Usuario, attributes: ATRIBUTOS_USUARIO },
      ],
      order: [["apertura", "ASC"]],
    }),
    Turno_Barrera.findAll({
      where: {
        fecha_inicio: { [Op.lte]: hasta },
        [Op.or]: [{ fecha_fin: null }, { fecha_fin: { [Op.gte]: desde } }],
      },
      include: [
        {
          model: Barrera,
          required: true,
          attributes: ["id", "ubicacion"],
          where: { id_sucursal: sucursal.id },
        },
        {
          model: Turno_Barrera_Usuario,
          as: "usuarios_asignados",
          include: [{ model: Usuario, attributes: ATRIBUTOS_USUARIO }],
        },
      ],
      order: [["fecha_inicio", "ASC"]],
    }),
    Turno_Grua.findAll({
      where: {
        fecha_inicio: { [Op.lte]: hasta },
        [Op.or]: [{ fecha_fin: null }, { fecha_fin: { [Op.gte]: desde } }],
      },
      include: [
        {
          model: Grua,
          required: true,
          attributes: ["id", "patente", "numero"],
          where: { id_sucursal: sucursal.id },
        },
        { model: Usuario, as: "chofer", attributes: ATRIBUTOS_USUARIO },
        { model: Usuario, as: "enganchador", attributes: ATRIBUTOS_USUARIO },
        { model: Usuario, as: "supervisor", attributes: ATRIBUTOS_USUARIO },
      ],
      order: [["fecha_inicio", "ASC"]],
    }),
  ]);

  // ------------------------------------------------------------------
  // Cobros de las cajas en la ventana.
  // ------------------------------------------------------------------
  const cobros = turnosCaja.length
    ? await Cobro.findAll({
        where: {
          id_turno_caja: { [Op.in]: turnosCaja.map((t) => t.id) },
          fecha: { [Op.between]: [desde, hasta] },
        },
        order: [["fecha", "ASC"]],
        include: [
          {
            model: Turno_Caja,
            required: true,
            include: [
              {
                model: Caja,
                required: true,
                attributes: ["id", "numero_caja", "referencia"],
                where: { id_sucursal: sucursal.id },
              },
              { model: Usuario, attributes: ATRIBUTOS_USUARIO },
            ],
          },
          {
            model: Acarreo,
            include: [
              {
                model: Vehiculo,
                attributes: ["id", "patente", "marca", "modelo", "color"],
              },
            ],
          },
        ],
      })
    : [];

  const informeCobros = armarInformeCobros({
    cobros,
    modo: periodo === "RANGO" ? "RANGO" : "TURNO",
    sucursales: [sucursal],
    periodo: { desde, hasta: hastaMostrar, descripcion },
  });

  // ------------------------------------------------------------------
  // Movimientos de las barreras: entradas y salidas de la ventana.
  // ------------------------------------------------------------------
  const turnosBarreraHistorico = barreras.length
    ? await Turno_Barrera.findAll({
        where: { id_barrera: { [Op.in]: barreras.map((b) => b.id) } },
        attributes: ["id", "id_barrera"],
      })
    : [];

  const barreraIdPorTurno = new Map(
    turnosBarreraHistorico.map((t) => [t.id, t.id_barrera]),
  );
  const barreraPorId = new Map(barreras.map((b) => [b.id, b]));

  const nombreBarreraDeTurno = (idTurno) => {
    const idBarrera = barreraIdPorTurno.get(idTurno);
    return barreraPorId.get(idBarrera)?.ubicacion ?? "-";
  };

  const acarreosBarrera = turnosBarreraHistorico.length
    ? await Acarreo.findAll({
        where: {
          id_turno_barrera: {
            [Op.in]: turnosBarreraHistorico.map((t) => t.id),
          },
          [Op.or]: [
            { fecha_ingreso: { [Op.between]: [desde, hasta] } },
            { fecha_egreso: { [Op.between]: [desde, hasta] } },
          ],
        },
        include: [
          {
            model: Vehiculo,
            attributes: ["id", "patente", "marca", "modelo", "color"],
          },
          // El cobro permite reconstruir el estado del auto al cierre de la
          // ventana (no el estado actual, que puede haber cambiado después).
          { model: Cobro, attributes: ["id", "fecha"] },
        ],
        order: [["fecha_ingreso", "ASC"]],
      })
    : [];

  const movimientosBarrera = [];

  acarreosBarrera.forEach((acarreo) => {
    const vehiculo = acarreo.Vehiculo;
    const base = {
      patente: vehiculo?.patente ?? "-",
      marca: vehiculo?.marca ?? null,
      modelo: vehiculo?.modelo ?? null,
      color: vehiculo?.color ?? null,
      barrera: nombreBarreraDeTurno(acarreo.id_turno_barrera),
      barreraId: barreraIdPorTurno.get(acarreo.id_turno_barrera) ?? null,
      turnoBarreraId: acarreo.id_turno_barrera,
    };

    if (enRango(acarreo.fecha_ingreso)) {
      movimientosBarrera.push({
        ...base,
        tipo: "ENTRADA",
        fecha: acarreo.fecha_ingreso,
      });
    }

    if (enRango(acarreo.fecha_egreso)) {
      movimientosBarrera.push({
        ...base,
        tipo: "SALIDA",
        fecha: acarreo.fecha_egreso,
      });
    }
  });

  movimientosBarrera.sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  );

  // Turnos históricos de las grúas de la sucursal. Sirven para ubicar los
  // acarreos que entraron a la playa sin un turno de barrera asociado.
  const turnosGruaHistorico = gruas.length
    ? await Turno_Grua.findAll({
        where: { id_grua: { [Op.in]: gruas.map((grua) => grua.id) } },
        attributes: ["id"],
      })
    : [];

  // Autos que están en la playa al cierre de la ventana. Se mira la sucursal
  // completa: un auto puede haber ingresado por una barrera o haber sido
  // acarreado por una grúa sin turno de barrera.
  const autosEnPlaya =
    turnosBarreraHistorico.length || turnosGruaHistorico.length
      ? await Acarreo.findAll({
          where: {
            fecha_ingreso: { [Op.lte]: hasta },
            [Op.and]: [
              {
                [Op.or]: [
                  {
                    id_turno_barrera: {
                      [Op.in]: turnosBarreraHistorico.map((t) => t.id),
                    },
                  },
                  {
                    id_turno_grua: {
                      [Op.in]: turnosGruaHistorico.map((t) => t.id),
                    },
                  },
                ],
              },
              {
                [Op.or]: [
                  { fecha_egreso: null },
                  { fecha_egreso: { [Op.gt]: hasta } },
                ],
              },
            ],
          },
          include: [
            {
              model: Vehiculo,
              attributes: ["id", "patente", "marca", "modelo", "color"],
            },
          ],
          order: [["fecha_ingreso", "ASC"]],
        })
      : [];

  const autosEnPlayaFilas = autosEnPlaya.map((acarreo) => ({
    patente: acarreo.Vehiculo?.patente ?? "-",
    marca: acarreo.Vehiculo?.marca ?? null,
    modelo: acarreo.Vehiculo?.modelo ?? null,
    color: acarreo.Vehiculo?.color ?? null,
    fecha: acarreo.fecha_ingreso,
    barrera: acarreo.id_turno_barrera
      ? nombreBarreraDeTurno(acarreo.id_turno_barrera)
      : "Sin barrera",
  }));

  // ------------------------------------------------------------------
  // Acarreos de las grúas en la ventana.
  // ------------------------------------------------------------------
  const acarreosGrua = turnosGrua.length
    ? await Acarreo.findAll({
        where: {
          id_turno_grua: { [Op.in]: turnosGrua.map((t) => t.id) },
          fecha_acarreo: { [Op.between]: [desde, hasta] },
        },
        order: [["fecha_acarreo", "ASC"]],
        include: [
          {
            model: Vehiculo,
            attributes: ["id", "patente", "marca", "modelo", "color"],
          },
          { model: Cobro, attributes: ["id", "fecha"] },
          {
            model: Turno_Grua,
            required: true,
            attributes: ["id", "id_grua"],
            include: [
              { model: Grua, attributes: ["id", "patente", "numero"] },
              { model: Usuario, as: "chofer", attributes: ATRIBUTOS_USUARIO },
              {
                model: Usuario,
                as: "enganchador",
                attributes: ATRIBUTOS_USUARIO,
              },
            ],
          },
        ],
      })
    : [];

  const acarreosPorGrua = new Map(gruas.map((grua) => [grua.id, []]));

  acarreosGrua.forEach((acarreo) => {
    const idGrua = acarreo.Turno_Grua?.id_grua;

    if (idGrua && acarreosPorGrua.has(idGrua)) {
      acarreosPorGrua.get(idGrua).push(acarreo);
    }
  });

  // Vehículos con actividad en el período (acarreados, ingresados o
  // egresados), por estado al cierre. Es la única parte del sistema que
  // muestra estados de vehículos en un informe; los cierres de turno no los
  // muestran.
  const vehiculosDelPeriodo = [
    ...new Map(
      [...acarreosBarrera, ...acarreosGrua].map((acarreo) => [
        acarreo.id,
        acarreo,
      ]),
    ).values(),
  ];

  // Estado del vehículo al cierre de la ventana, reconstruido con las fechas.
  // No se usa el estado actual: un auto que estaba en la playa al cierre pudo
  // egresar después y figurar hoy como EGRESADO.
  const estadoAlCierre = (acarreo) => {
    const ingreso = acarreo.fecha_ingreso
      ? new Date(acarreo.fecha_ingreso).getTime()
      : null;
    const egreso = acarreo.fecha_egreso
      ? new Date(acarreo.fecha_egreso).getTime()
      : null;
    const cobro = acarreo.Cobro?.fecha
      ? new Date(acarreo.Cobro.fecha).getTime()
      : null;
    const fin = hasta.getTime();

    if (ingreso === null || ingreso > fin) return "ACARREADO";

    const cobradoAlCierre = cobro !== null && cobro <= fin;

    if (egreso !== null && egreso <= fin) {
      return cobradoAlCierre ? "EGRESADO" : "SIN_CARGO";
    }

    return cobradoAlCierre ? "COBRADO" : "INGRESADO";
  };

  const estados = [
    "ACARREADO",
    "INGRESADO",
    "COBRADO",
    "EGRESADO",
    "SIN_CARGO",
  ];
  const conteoEstados = estados.map((estado) => ({
    estado,
    cantidad: vehiculosDelPeriodo.filter(
      (acarreo) => estadoAlCierre(acarreo) === estado,
    ).length,
  }));

  // Turnos que corresponden al período: los que empezaron o terminaron en la
  // ventana, o los que tuvieron actividad en ella. Así no se cuelan turnos
  // viejos que quedaron abiertos y no movieron nada.
  const turnosConCobros = new Set(cobros.map((cobro) => cobro.id_turno_caja));
  const turnosConMovimientos = new Set(
    acarreosBarrera.map((acarreo) => acarreo.id_turno_barrera),
  );
  const turnosConAcarreos = new Set(
    acarreosGrua.map((acarreo) => acarreo.id_turno_grua),
  );

  const turnosCajaPeriodo = turnosCaja.filter(
    (turno) =>
      enRango(turno.apertura) ||
      enRango(turno.cierre) ||
      turnosConCobros.has(turno.id),
  );
  const turnosBarreraPeriodo = turnosBarrera.filter(
    (turno) =>
      enRango(turno.fecha_inicio) ||
      enRango(turno.fecha_fin) ||
      turnosConMovimientos.has(turno.id),
  );
  const turnosGruaPeriodo = turnosGrua.filter(
    (turno) =>
      enRango(turno.fecha_inicio) ||
      enRango(turno.fecha_fin) ||
      turnosConAcarreos.has(turno.id),
  );

  const notaUsuariosDeGrua = (lista) => {
    const choferes = new Set();
    const enganchadores = new Set();

    lista.forEach((acarreo) => {
      if (acarreo.Turno_Grua?.chofer) {
        choferes.add(nombreUsuarioConRol(acarreo.Turno_Grua.chofer));
      }

      if (acarreo.Turno_Grua?.enganchador) {
        enganchadores.add(nombreUsuarioConRol(acarreo.Turno_Grua.enganchador));
      }
    });

    return [
      choferes.size ? `Chofer: ${[...choferes].join(" · ")}` : null,
      enganchadores.size
        ? `Enganchador: ${[...enganchadores].join(" · ")}`
        : null,
    ]
      .filter(Boolean)
      .join("   ");
  };

  // ------------------------------------------------------------------
  // Cobros agrupados por caja.
  // ------------------------------------------------------------------
  const cobrosPorCaja = new Map(cajas.map((caja) => [caja.id, []]));

  informeCobros.movimientos.forEach((movimiento) => {
    if (movimiento.caja?.id && cobrosPorCaja.has(movimiento.caja.id)) {
      cobrosPorCaja.get(movimiento.caja.id).push(movimiento);
    }
  });

  // ------------------------------------------------------------------
  // Turnos del período (con usuarios y roles) e incidencias.
  // ------------------------------------------------------------------
  const turnosPeriodo = [
    ...turnosCajaPeriodo.map((turno) => ({
      tipoEntidad: "Caja",
      entidad: `N° ${turno.Caja?.numero_caja ?? "-"}`,
      turno: turno.turno,
      inicio: turno.apertura,
      cierre: turno.cierre,
      usuarios: nombreUsuarioConRol(turno.Usuario),
      incidencias: turno.incidencias,
      orden: new Date(turno.apertura).getTime(),
    })),
    ...turnosBarreraPeriodo.map((turno) => ({
      tipoEntidad: "Barrera",
      entidad: turno.Barrera?.ubicacion ?? "-",
      turno: turno.turno,
      inicio: turno.fecha_inicio,
      cierre: turno.fecha_fin,
      usuarios:
        (turno.usuarios_asignados ?? [])
          .map((asignado) => nombreUsuarioConRol(asignado.Usuario))
          .filter((nombre) => nombre !== "-")
          .join(" · ") || "-",
      incidencias: turno.incidencias,
      orden: new Date(turno.fecha_inicio).getTime(),
    })),
    ...turnosGruaPeriodo.map((turno) => ({
      tipoEntidad: "Grúa",
      entidad: turno.Grua
        ? `N° ${turno.Grua.numero} · ${turno.Grua.patente}`
        : "-",
      turno: turno.turno,
      inicio: turno.fecha_inicio,
      cierre: turno.fecha_fin,
      usuarios:
        [
          turno.chofer
            ? `Chofer: ${nombreUsuarioConRol(turno.chofer)}`
            : null,
          turno.enganchador
            ? `Enganchador: ${nombreUsuarioConRol(turno.enganchador)}`
            : null,
          turno.supervisor
            ? `Supervisor: ${nombreUsuarioConRol(turno.supervisor)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "-",
      incidencias: turno.incidencias,
      orden: new Date(turno.fecha_inicio).getTime(),
    })),
  ].sort((a, b) => a.orden - b.orden);

  // Usuarios y roles de los turnos del período, uno por fila para que entren
  // completos en el PDF (la tabla de turnos no los muestra).
  const usuariosPeriodo = [];

  turnosCajaPeriodo.forEach((turno) => {
    if (!turno.Usuario) return;

    usuariosPeriodo.push({
      tipoEntidad: "Caja",
      entidad: `N° ${turno.Caja?.numero_caja ?? "-"}`,
      turno: turno.turno,
      funcion: "Cajero",
      usuario: `${turno.Usuario.nombre} ${turno.Usuario.apellido}`,
      rol: turno.Usuario.rol ?? "-",
    });
  });

  turnosBarreraPeriodo.forEach((turno) => {
    (turno.usuarios_asignados ?? []).forEach((asignado) => {
      if (!asignado.Usuario) return;

      usuariosPeriodo.push({
        tipoEntidad: "Barrera",
        entidad: turno.Barrera?.ubicacion ?? "-",
        turno: turno.turno,
        funcion: "Playero",
        usuario: `${asignado.Usuario.nombre} ${asignado.Usuario.apellido}`,
        rol: asignado.Usuario.rol ?? "-",
      });
    });
  });

  turnosGruaPeriodo.forEach((turno) => {
    const entidad = turno.Grua
      ? `N° ${turno.Grua.numero} · ${turno.Grua.patente}`
      : "-";

    [
      { funcion: "Chofer", usuario: turno.chofer },
      { funcion: "Enganchador", usuario: turno.enganchador },
      { funcion: "Supervisor", usuario: turno.supervisor },
    ].forEach(({ funcion, usuario }) => {
      if (!usuario) return;

      usuariosPeriodo.push({
        tipoEntidad: "Grúa",
        entidad,
        turno: turno.turno,
        funcion,
        usuario: `${usuario.nombre} ${usuario.apellido}`,
        rol: usuario.rol ?? "-",
      });
    });

    // El agente no es un usuario del sistema: se guarda como nombre y número
    // en el turno de grúa. Se muestra igual para no perder el dato.
    if (turno.nombre_agente) {
      usuariosPeriodo.push({
        tipoEntidad: "Grúa",
        entidad,
        turno: turno.turno,
        funcion: "Agente",
        usuario: `${turno.nombre_agente}${
          turno.numero_agente ? ` (${turno.numero_agente})` : ""
        }`,
        rol: "AGENTE",
      });
    }
  });

  const incidenciasPeriodo = turnosPeriodo.filter(
    (turno) => turno.incidencias && String(turno.incidencias).trim() !== "",
  );

  // ------------------------------------------------------------------
  // Secciones del PDF.
  // ------------------------------------------------------------------
  const secciones = [
    {
      titulo: `Turnos del período (${turnosPeriodo.length})`,
      columnas: [
        ["tipoEntidad", "Tipo", 55],
        ["entidad", "Entidad", 150],
        ["turno", "Turno", 45],
        ["inicio", "Inicio", 120],
        ["cierre", "Cierre", 125],
      ],
      filas: turnosPeriodo,
      mensajeVacio: "No hubo turnos en el período.",
    },
    {
      titulo: `Usuarios por turno (${usuariosPeriodo.length})`,
      columnas: [
        ["tipoEntidad", "Tipo", 50],
        ["entidad", "Entidad", 95],
        ["turno", "Turno", 35],
        ["funcion", "Función", 75],
        ["usuario", "Usuario", 140],
        ["rol", "Rol", 100],
      ],
      filas: usuariosPeriodo,
      mensajeVacio: "No hay usuarios asignados en los turnos del período.",
    },
    {
      titulo: "Vehículos por estado",
      columnas: [
        ["estado", "Estado", 300],
        ["cantidad", "Cantidad", 195],
      ],
      filas: [
        ...conteoEstados,
        { estado: "Total", cantidad: vehiculosDelPeriodo.length },
      ],
      mensajeVacio: "No hubo vehículos con actividad en el período.",
      nota: "Cuenta de los vehículos con actividad en el período (acarreados, ingresados o egresados), según su estado al cierre.",
      nuevaPagina: true,
    },
    {
      titulo: `Autos en la playa al cierre (${autosEnPlayaFilas.length})`,
      columnas: [
        ["patente", "Patente", 75],
        ["vehiculo", "Vehículo", 190],
        ["fecha", "Ingresó", 120],
        ["barrera", "Barrera de ingreso", 110],
      ],
      filas: autosEnPlayaFilas,
      mensajeVacio: "No hay autos en la playa al cierre del período.",
      nuevaPagina: true,
    },
    ...barreras.map((barrera) => {
      const filas = movimientosBarrera.filter(
        (movimiento) => movimiento.barreraId === barrera.id,
      );

      return {
        titulo: `Barrera ${barrera.ubicacion} — movimientos (${filas.length})`,
        columnas: [
          ["tipo", "Movimiento", 75],
          ["patente", "Patente", 75],
          ["vehiculo", "Vehículo", 225],
          ["fecha", "Fecha y hora", 120],
        ],
        filas,
        mensajeVacio: "No hubo entradas ni salidas en el período.",
        nuevaPagina: filas.length > 0,
      };
    }),
    ...gruas.map((grua) => {
      const filas = (acarreosPorGrua.get(grua.id) ?? []).map((acarreo) => {
        const vehiculo = acarreo.Vehiculo;

        return {
          fecha: acarreo.fecha_acarreo,
          patente: vehiculo?.patente ?? "-",
          marca: vehiculo?.marca ?? null,
          modelo: vehiculo?.modelo ?? null,
          color: vehiculo?.color ?? null,
          direccion: acarreo.direccion ?? "-",
          motivo: acarreo.motivo ?? "-",
          chofer: nombreUsuarioConRol(acarreo.Turno_Grua?.chofer),
        };
      });

      return {
        titulo: `Grúa N° ${grua.numero} · ${grua.patente} — acarreos (${filas.length})`,
        columnas: [
          ["fecha", "Fecha y hora", 80],
          ["patente", "Patente", 60],
          ["vehiculo", "Vehículo", 115],
          ["direccion", "Dirección", 80],
          ["motivo", "Motivo", 80],
          ["chofer", "Chofer", 80],
        ],
        filas,
        nota: notaUsuariosDeGrua(acarreosPorGrua.get(grua.id) ?? []),
        mensajeVacio: "No hubo acarreos en el período.",
        nuevaPagina: filas.length > 0,
      };
    }),
    ...cajas.map((caja) => {
      const filas = cobrosPorCaja.get(caja.id) ?? [];
      const cajeros = [
        ...new Set(
          turnosCajaPeriodo
            .filter((turno) => turno.Caja?.id === caja.id && turno.Usuario)
            .map((turno) => nombreUsuarioConRol(turno.Usuario)),
        ),
      ];

      return {
        titulo: `Caja N° ${caja.numero_caja}${
          caja.referencia ? ` · ${caja.referencia}` : ""
        } — cobros (${filas.length})`,
        columnas: [
          ["fecha", "Fecha y hora", 85],
          ["patente", "Patente", 50],
          ["vehiculo", "Vehículo", 90],
          ["cajero", "Cajero", 85],
          ["estadias", "Estadías", 50],
          ["total", "Total", 50],
          ["efectivo", "Efectivo", 45],
          ["mp", "M. Pago", 40],
        ],
        filas,
        nota: cajeros.length ? `Cajero(s): ${cajeros.join(" · ")}` : null,
        mensajeVacio: "No hubo cobros en el período.",
        nuevaPagina: filas.length > 0,
      };
    }),
    ...(incidenciasPeriodo.length
      ? [
          {
            titulo: `Incidencias del período (${incidenciasPeriodo.length})`,
            columnas: [
              ["tipoEntidad", "Tipo", 55],
              ["entidad", "Entidad", 110],
              ["turno", "Turno", 40],
              ["incidencias", "Incidencia", 290],
            ],
            filas: incidenciasPeriodo,
            mensajeVacio: "No hubo incidencias en el período.",
            nuevaPagina: true,
          },
        ]
      : []),
  ];

  const ingresos = movimientosBarrera.filter(
    (movimiento) => movimiento.tipo === "ENTRADA",
  ).length;
  const egresos = movimientosBarrera.filter(
    (movimiento) => movimiento.tipo === "SALIDA",
  ).length;
  const totalTurnos =
    turnosCajaPeriodo.length +
    turnosBarreraPeriodo.length +
    turnosGruaPeriodo.length;

  return {
    tipo: TIPO_FIN_TURNO,
    modo: periodo === "RANGO" ? "RANGO" : "TURNO",
    titulo: "Informe de fin de turno",
    etiquetaFecha: "Fecha y hora",
    sucursal: { id: sucursal.id, nombre: sucursal.nombre },
    periodo: { desde, hasta: hastaMostrar, descripcion },
    filasExtra: [
      { etiqueta: "Cajas", valor: String(cajas.length) },
      { etiqueta: "Barreras", valor: String(barreras.length) },
      { etiqueta: "Grúas", valor: String(gruas.length) },
      { etiqueta: "Turnos del período", valor: String(totalTurnos) },
    ],
    resumen: [
      { etiqueta: "Cobros", valor: String(informeCobros.totales.cantidad) },
      {
        etiqueta: "Total cobrado",
        valor: formatoImporte(informeCobros.totales.total),
      },
      {
        etiqueta: "Efectivo",
        valor: formatoImporte(informeCobros.totales.efectivo),
      },
      {
        etiqueta: "Mercado Pago",
        valor: formatoImporte(informeCobros.totales.mp),
      },
      { etiqueta: "Ingresos a la playa", valor: String(ingresos) },
      { etiqueta: "Egresos de la playa", valor: String(egresos) },
      { etiqueta: "Acarreos de las grúas", valor: String(acarreosGrua.length) },
      {
        etiqueta: "Vehículos en playa al cierre",
        valor: String(autosEnPlayaFilas.length),
      },
    ],
    secciones,
    totales: {
      ...informeCobros.totales,
      ingresos,
      egresos,
      acarreos: acarreosGrua.length,
      enPlaya: autosEnPlayaFilas.length,
      turnos: totalTurnos,
    },
  };
};

/**
 * GET /informes/fin-turno — informe detallado de fin de turno (JSON).
 * Sólo supervisor y sistemas.
 */
export const obtenerInformeFinTurno = async (req, res) => {
  try {
    const datos = await construirDatosFinTurno(req);

    return res.status(200).json({
      success: true,
      data: datos,
      message: "Informe de fin de turno generado exitosamente",
    });
  } catch (error) {
    if (error instanceof ErrorInforme) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * GET /informes/fin-turno.pdf — el informe detallado de fin de turno, en PDF.
 */
export const generarInformeFinTurnoPdf = async (req, res) => {
  try {
    const datos = await construirDatosFinTurno(req);
    const doc = construirInformePdf(datos);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-fin-turno-${Date.now()}.pdf"`,
    );

    doc.pipe(res);
    doc.end();
  } catch (error) {
    if (error instanceof ErrorInforme) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }

    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
