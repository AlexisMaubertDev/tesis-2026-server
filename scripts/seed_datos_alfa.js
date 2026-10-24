import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import sequelize from "../src/config/db.js";
import {
  Acarreo,
  Barrera,
  Caja,
  Cobro,
  Grua,
  Sucursal,
  Tarifa,
  Turno_Barrera,
  Turno_Barrera_Usuario,
  Turno_Caja,
  Turno_Grua,
  Usuario,
  Vehiculo,
} from "../src/models/index.js";

/**
 * Datos de prueba para la etapa alfa.
 *
 * Crea 3 sucursales nuevas (Norte, Centro y Oeste) con:
 *  - 17 usuarios por sucursal: 2 supervisores, 3 cajeros, 6 grueros y 6 playeros.
 *  - 2 cajas, 2 grúas y 2 barreras por sucursal.
 *  - 30 días de turnos cerrados y el turno actual abierto (si corresponde).
 *  - Acarreos, ingresos/egresos de playa, cobros, incidencias y arqueos.
 *
 * Uso:
 *   node scripts/seed_datos_alfa.js --simular   # prueba y revierte todo
 *   node scripts/seed_datos_alfa.js             # escribe en la base
 *
 * El script no toca las sucursales existentes. Si las sucursales Norte,
 * Centro u Oeste ya existen, aborta para no duplicar datos.
 *
 * Contraseña de todos los usuarios nuevos: Alfa2026!
 */

const PASSWORD = "Alfa2026!";
const DIAS_HISTORIAL = 30;
const SIMULAR = process.argv.includes("--simular");

const TURNOS = [
  { numero: "1", inicio: 7, fin: 15, etiqueta: "Mañana" },
  { numero: "2", inicio: 15, fin: 23, etiqueta: "Tarde" },
  // El turno noche empieza a las 23 y termina a las 07 del día siguiente.
  { numero: "3", inicio: 23, fin: 31, etiqueta: "Noche" },
];

const SUCURSALES = [
  {
    key: "norte",
    nombre: "Norte",
    direccion: "Av. Cabildo 2230, CABA",
    codigo: "NOR",
    prefijoPatente: "AN",
  },
  {
    key: "centro",
    nombre: "Centro",
    direccion: "Av. Belgrano 850, CABA",
    codigo: "CEN",
    prefijoPatente: "AC",
  },
  {
    key: "oeste",
    nombre: "Oeste",
    direccion: "Av. Rivadavia 5400, CABA",
    codigo: "OES",
    prefijoPatente: "AO",
  },
];

const NOMBRES = [
  "Lucía",
  "Diego",
  "María",
  "Julián",
  "Carla",
  "Andrés",
  "Pablo",
  "Nicolás",
  "Sergio",
  "Martín",
  "Ezequiel",
  "Romina",
  "Federico",
  "Micaela",
  "Gonzalo",
  "Camila",
  "Emiliano",
  "Valentina",
  "Matías",
  "Florencia",
];

const APELLIDOS = [
  "Herrera",
  "Sosa",
  "Benítez",
  "Ríos",
  "Medina",
  "Molina",
  "Ferreyra",
  "Aguirre",
  "Cabrera",
  "Ledesma",
  "Ponce",
  "Acosta",
  "Silva",
  "Ortiz",
  "Vega",
  "Rojas",
  "Castro",
  "Domínguez",
  "Pereyra",
  "Navarro",
];

const MARCAS = [
  ["Toyota", "Corolla", "Blanco"],
  ["Volkswagen", "Gol", "Gris"],
  ["Ford", "Focus", "Negro"],
  ["Chevrolet", "Onix", "Rojo"],
  ["Renault", "Clio", "Azul"],
  ["Peugeot", "208", "Plateado"],
  ["Fiat", "Cronos", "Blanco"],
  ["Honda", "Civic", "Gris"],
  ["Nissan", "Versa", "Negro"],
  ["Citroën", "C4", "Azul"],
];

const MOTIVOS = [
  "Estacionamiento en zona prohibida",
  "Vehículo abandonado en la vía pública",
  "Bloqueo de rampa para discapacitados",
  "Estacionamiento sobre senda peatonal",
  "Vehículo sin dominio visible",
  "Obstrucción de parada de colectivos",
  "Estacionamiento en doble fila",
  "Vehículo en zona de carga y descarga",
  "Accidente con daños materiales",
  "Retiro por control municipal",
];

const CALLES = [
  "Av. Cabildo",
  "Av. Belgrano",
  "Av. Rivadavia",
  "Av. Corrientes",
  "Av. Santa Fe",
  "Av. Callao",
  "Av. Entre Ríos",
  "Av. San Juan",
  "Av. Directorio",
  "Av. La Plata",
  "Av. Boedo",
  "Av. Independencia",
];

const INCIDENCIAS_GRUA = [
  "Demora por tránsito intenso en la zona.",
  "Se coordinó el ingreso con la barrera.",
  "El vehículo presentaba daños previos.",
  "Se solicitó apoyo de otra grúa.",
  "Sin novedades relevantes.",
];

const INCIDENCIAS_BARRERA = [
  "Se verificó la documentación del vehículo.",
  "Demora en la apertura por mantenimiento.",
  "Se informó al supervisor de turno.",
  "Ingreso de vehículo con daños visibles.",
  "Sin novedades relevantes.",
];

const INCIDENCIAS_CAJA = [
  "Se registró un pago mixto.",
  "Faltó cambio menor al cierre.",
  "Se corrigió un importe antes del cierre.",
  "Sin novedades relevantes.",
];

// ---------------------------------------------------------------------------
// Utilidades de fechas y números
// ---------------------------------------------------------------------------

const dosDigitos = (n) => String(n).padStart(2, "0");

const inicioDelDia = (fecha) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

const sumarDias = (fecha, dias) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);

const fechaLocal = (fecha, hora, minuto = 0) =>
  new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    hora,
    minuto,
    0,
    0,
  );

const sumarMinutos = (fecha, minutos) =>
  new Date(fecha.getTime() + minutos * 60 * 1000);

const claveDia = (fecha) =>
  `${fecha.getFullYear()}${dosDigitos(fecha.getMonth() + 1)}${dosDigitos(
    fecha.getDate(),
  )}`;

const textoFecha = (fecha) =>
  `${dosDigitos(fecha.getDate())}/${dosDigitos(
    fecha.getMonth() + 1,
  )}/${fecha.getFullYear()} ${dosDigitos(fecha.getHours())}:${dosDigitos(
    fecha.getMinutes(),
  )}`;

const limpiarTexto = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");

/** PRNG determinista para que dos ejecuciones generen los mismos datos. */
const crearRandom = (semilla) => {
  let estado = semilla >>> 0;

  return () => {
    estado += 0x6d2b79f5;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const random = crearRandom(20261023);

const entero = (min, max) =>
  Math.floor(random() * (max - min + 1)) + min;

const elegir = (lista) => lista[entero(0, lista.length - 1)];

const redondear = (valor) => Math.round(valor * 100) / 100;

const enLotes = (lista, tamano) => {
  const lotes = [];

  for (let i = 0; i < lista.length; i += tamano) {
    lotes.push(lista.slice(i, i + tamano));
  }

  return lotes;
};

const insertarEnLotes = async (Modelo, filas, transaction) => {
  for (const lote of enLotes(filas, 400)) {
    await Modelo.bulkCreate(lote, { transaction });
  }
};

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

const rolesPorIndice = [
  { rol: "SUPERVISOR", turno: 1, grupo: "supervisores" },
  { rol: "SUPERVISOR", turno: 2, grupo: "supervisores" },
  { rol: "CAJERO", turno: 1, grupo: "cajeros" },
  { rol: "CAJERO", turno: 2, grupo: "cajeros" },
  { rol: "CAJERO", turno: 3, grupo: "cajeros" },
  { rol: "GRUERO", turno: 1, grupo: "choferes" },
  { rol: "GRUERO", turno: 2, grupo: "choferes" },
  { rol: "GRUERO", turno: 3, grupo: "choferes" },
  { rol: "GRUERO", turno: 1, grupo: "enganchadores" },
  { rol: "GRUERO", turno: 2, grupo: "enganchadores" },
  { rol: "GRUERO", turno: 3, grupo: "enganchadores" },
  { rol: "PLAYERO", turno: 1, grupo: "playeros0" },
  { rol: "PLAYERO", turno: 2, grupo: "playeros0" },
  { rol: "PLAYERO", turno: 3, grupo: "playeros0" },
  { rol: "PLAYERO", turno: 1, grupo: "playeros1" },
  { rol: "PLAYERO", turno: 2, grupo: "playeros1" },
  { rol: "PLAYERO", turno: 3, grupo: "playeros1" },
];

const construirUsuarios = (sucursal, indiceSucursal, hashPassword) =>
  rolesPorIndice.map((config, indiceUsuario) => {
    const indiceGlobal = indiceSucursal * rolesPorIndice.length + indiceUsuario;
    const nombre = NOMBRES[indiceGlobal % NOMBRES.length];
    const apellido =
      APELLIDOS[Math.floor(indiceGlobal / NOMBRES.length) % APELLIDOS.length];
    const legajo = 2001 + indiceGlobal;
    const dni = String(41000001 + indiceGlobal);

    return {
      id: randomUUID(),
      nombre,
      apellido,
      legajo,
      dni,
      email: `${limpiarTexto(nombre)}.${limpiarTexto(
        apellido,
      )}.${legajo}@alfa.test`,
      rol: config.rol,
      password: hashPassword,
      numero_turno: config.turno,
      trabaja_domingo: config.turno === 3,
      bloqueado: false,
      intentos_restantes: 3,
      id_sucursal: sucursal.id,
      // Metadatos sólo para armar los turnos; no se envían a la base.
      _grupo: config.grupo,
      _turno: config.turno,
    };
  });

// ---------------------------------------------------------------------------
// Armado de turnos
// ---------------------------------------------------------------------------

const ventanaTurno = (dia, turno) => {
  const inicio = fechaLocal(dia, turno.inicio === 31 ? 23 : turno.inicio);
  let fin;

  if (turno.inicio === 31) {
    // Turno noche: 23:00 del día indicado a 07:00 del día siguiente.
    fin = fechaLocal(sumarDias(dia, 1), 7);
  } else {
    fin = fechaLocal(dia, turno.fin);
  }

  return { inicio, fin };
};

const buscarTurnoQueContiene = (turnos, fecha) =>
  turnos.find((turno) => {
    const fin = turno.fecha_fin ?? new Date();
    return fecha >= turno.fecha_inicio && fecha <= fin;
  });

const buscarTurnoAnterior = (turnos, fecha) => {
  const anteriores = turnos
    .filter((turno) => turno.fecha_inicio <= fecha)
    .sort((a, b) => b.fecha_inicio - a.fecha_inicio);

  return anteriores[0] ?? turnos[0] ?? null;
};

const buscarCajaQueContiene = (turnos, fecha) =>
  turnos.find((turno) => {
    const fin = turno.cierre ?? new Date();
    return fecha >= turno.apertura && fecha <= fin;
  });

const buscarCajaAnterior = (turnos, fecha) => {
  const anteriores = turnos
    .filter((turno) => turno.apertura <= fecha)
    .sort((a, b) => b.apertura - a.apertura);

  return anteriores[0] ?? turnos[0] ?? null;
};

// ---------------------------------------------------------------------------
// Generación de un acarreo
// ---------------------------------------------------------------------------

const generarTimeline = ({ fechaAcarreo, ahora, turnoActivo }) => {
  const entrada = sumarMinutos(fechaAcarreo, entero(5, 90));

  // Si todavía no alcanzó a ingresar a la playa, queda ACARREADO.
  if (entrada > ahora) {
    return {
      fecha_ingreso: null,
      fecha_pago: null,
      fecha_egreso: null,
      estado: "ACARREADO",
      sinCargo: false,
    };
  }

  // Una parte de los vehículos sale sin cargo.
  if (random() < 0.08) {
    const salida = sumarMinutos(entrada, entero(30, 480));

    if (salida > ahora) {
      return {
        fecha_ingreso: entrada,
        fecha_pago: null,
        fecha_egreso: null,
        estado: "INGRESADO",
        sinCargo: false,
      };
    }

    return {
      fecha_ingreso: entrada,
      fecha_pago: null,
      fecha_egreso: salida,
      estado: "SIN_CARGO",
      sinCargo: true,
    };
  }

  // Pago: la mayoría dentro de las primeras 24 h; algunos quedan varios días.
  const tramo = random();
  let minutosPago;

  if (tramo < 0.7) {
    minutosPago = entero(15, 24 * 60);
  } else if (tramo < 0.9) {
    minutosPago = entero(24 * 60, 5 * 24 * 60);
  } else {
    minutosPago = entero(5 * 24 * 60, 20 * 24 * 60);
  }

  const pago = sumarMinutos(entrada, minutosPago);

  if (pago > ahora) {
    return {
      fecha_ingreso: entrada,
      fecha_pago: null,
      fecha_egreso: null,
      estado: "INGRESADO",
      sinCargo: false,
    };
  }

  const salida = sumarMinutos(pago, entero(10, 480));

  // En un turno abierto, un auto recién cobrado puede seguir en la playa.
  if (salida > ahora && turnoActivo) {
    return {
      fecha_ingreso: entrada,
      fecha_pago: pago,
      fecha_egreso: null,
      estado: "COBRADO",
      sinCargo: false,
    };
  }

  return {
    fecha_ingreso: entrada,
    fecha_pago: pago,
    fecha_egreso: salida <= ahora ? salida : null,
    estado: salida <= ahora ? "EGRESADO" : "COBRADO",
    sinCargo: false,
  };
};

const generarPatente = (sucursal, contador, usadas) => {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let intento = contador;

  while (true) {
    const numero = intento % 1000;
    const letra1 = letras[Math.floor(intento / 1000) % 26];
    const letra2 = letras[Math.floor(intento / 26000) % 26];
    const patente = `${sucursal.prefijoPatente}${String(numero).padStart(
      3,
      "0",
    )}${letra1}${letra2}`;

    if (!usadas.has(patente)) {
      usadas.add(patente);
      return { patente, siguiente: intento + 1 };
    }

    intento += 1;
  }
};

// ---------------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------------

async function main() {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.authenticate();

    const existentes = await Sucursal.findAll({
      where: { nombre: { [Op.in]: SUCURSALES.map((s) => s.nombre) } },
      transaction,
    });

    if (existentes.length > 0) {
      throw new Error(
        `Ya existen sucursales con estos nombres: ${existentes
          .map((s) => s.nombre)
          .join(", ")}. El seed no se ejecutó para no duplicar datos.`,
      );
    }

    const hashPassword = await bcrypt.hash(PASSWORD, 10);

    const tarifa =
      (await Tarifa.findOne({
        where: { vigente: true },
        order: [["vigente_desde", "DESC"]],
        transaction,
      })) ??
      (await Tarifa.create(
        {
          acarreo: 83000,
          estadia: 15000,
          vigente: true,
          vigente_desde: sumarDias(new Date(), -60),
        },
        { transaction },
      ));

    const ahora = new Date();
    const hoy = inicioDelDia(ahora);

    const resumen = {
      sucursales: [],
      usuarios: 0,
      cajas: 0,
      gruas: 0,
      barreras: 0,
      turnosGrua: 0,
      turnosBarrera: 0,
      turnosCaja: 0,
      acarreos: 0,
      cobros: 0,
      estados: {},
      totalCobrado: 0,
    };

    const vehiculosUsados = new Set(
      (
        await Vehiculo.findAll({
          attributes: ["patente"],
          transaction,
        })
      ).map((v) => v.patente.toUpperCase()),
    );

    let contadorActa = 900000;
    let contadorFactura = 1;
    let contadorPatente = 1;

    for (const [indiceSucursal, configSucursal] of SUCURSALES.entries()) {
      const sucursal = await Sucursal.create(
        {
          id: randomUUID(),
          nombre: configSucursal.nombre,
          direccion: configSucursal.direccion,
        },
        { transaction },
      );

      const usuarios = construirUsuarios(
        sucursal,
        indiceSucursal,
        hashPassword,
      );

      await insertarEnLotes(
        Usuario,
        usuarios.map(({ _grupo, _turno, ...usuario }) => usuario),
        transaction,
      );

      const usuariosPorGrupo = usuarios.reduce((acc, usuario) => {
        acc[usuario._grupo] = acc[usuario._grupo] ?? [];
        acc[usuario._grupo].push(usuario);
        return acc;
      }, {});

      const cajas = await Promise.all(
        [1, 2].map((numero) =>
          Caja.create(
            {
              id: randomUUID(),
              id_sucursal: sucursal.id,
              numero_caja: numero,
              referencia: `${configSucursal.key}-${String(numero).padStart(
                3,
                "0",
              )}`,
              referencia_pago: `r-${configSucursal.key}${String(numero).padStart(
                3,
                "0",
              )}`,
            },
            { transaction },
          ),
        ),
      );

      const gruas = await Promise.all(
        [1, 2].map((numero) =>
          Grua.create(
            {
              id: randomUUID(),
              id_sucursal: sucursal.id,
              patente: `${configSucursal.prefijoPatente}${String(numero).padStart(
                3,
                "0",
              )}GR`,
              modelo: numero === 1 ? "IVECO" : "MERCEDES",
              numero,
              estado: "DISPONIBLE",
            },
            { transaction },
          ),
        ),
      );

      const barreras = await Promise.all(
        [
          `Entrada ${configSucursal.nombre}`,
          `Salida ${configSucursal.nombre}`,
        ].map((ubicacion) =>
          Barrera.create(
            {
              id: randomUUID(),
              id_sucursal: sucursal.id,
              ubicacion,
            },
            { transaction },
          ),
        ),
      );

      const turnosGrua = [];
      const turnosBarrera = [];
      const turnosCaja = [];

      // -----------------------------------------------------------------
      // Turnos: 30 días cerrados + el turno actual abierto (si corresponde).
      // -----------------------------------------------------------------
      for (let offset = DIAS_HISTORIAL; offset >= 0; offset -= 1) {
        const dia = sumarDias(hoy, -offset);

        for (const [indiceTurno, turno] of TURNOS.entries()) {
          const { inicio, fin } = ventanaTurno(dia, turno);

          if (inicio > ahora) continue;

          const activo = fin > ahora;
          const fechaFin = activo ? null : fin;
          const esActivo = activo;
          const incidenciaGrua =
            random() < 0.12 ? elegir(INCIDENCIAS_GRUA) : null;
          const incidenciaBarrera =
            random() < 0.12 ? elegir(INCIDENCIAS_BARRERA) : null;
          const incidenciaCaja =
            random() < 0.08 ? elegir(INCIDENCIAS_CAJA) : null;

          const grua = gruas[(offset + indiceTurno) % gruas.length];
          const chofer = usuariosPorGrupo.choferes[indiceTurno];
          const enganchador = usuariosPorGrupo.enganchadores[indiceTurno];
          const supervisor = usuariosPorGrupo.supervisores[indiceTurno % 2];

          const turnoGrua = {
            id: randomUUID(),
            id_grua: grua.id,
            id_chofer: chofer.id,
            id_enganchador: enganchador.id,
            id_supervisor: supervisor.id,
            turno: turno.numero,
            nombre_agente: `Agente ${configSucursal.nombre} ${turno.etiqueta}`,
            numero_agente: `7${String(indiceSucursal + 1)}${String(
              indiceTurno + 1,
            )}${String(offset + 1).padStart(3, "0")}`,
            incidencias: incidenciaGrua,
            activo: esActivo,
            fecha_inicio: inicio,
            fecha_fin: fechaFin,
            _inicio: inicio,
            _fin: fin,
            _activo: esActivo,
            _sucursal: configSucursal,
          };

          turnosGrua.push(turnoGrua);

          const turnosDeBarreraSucursal = [];

          for (const [indiceBarrera, barrera] of barreras.entries()) {
            const playero =
              usuariosPorGrupo[`playeros${indiceBarrera}`][indiceTurno];

            const turnoBarrera = {
              id: randomUUID(),
              id_barrera: barrera.id,
              turno: turno.numero,
              activo: esActivo,
              fecha_inicio: inicio,
              fecha_fin: fechaFin,
              incidencias: incidenciaBarrera,
              _inicio: inicio,
              _fin: fin,
              _activo: esActivo,
              _idBarrera: barrera.id,
              _idPlayero: playero.id,
              _sucursalKey: configSucursal.key,
            };

            turnosDeBarreraSucursal.push(turnoBarrera);
            turnosBarrera.push(turnoBarrera);
          }

          const caja = cajas[(offset + indiceTurno) % cajas.length];
          const cajero = usuariosPorGrupo.cajeros[indiceTurno];

          turnosCaja.push({
            id: randomUUID(),
            id_usuario: cajero.id,
            id_caja: caja.id,
            turno: turno.numero,
            apertura: inicio,
            cierre: fechaFin,
            activo: esActivo,
            total_autos: 0,
            total_estadias: 0,
            total_acarreos: 0,
            total_efectivo: 0,
            total_mp: 0,
            total: 0,
            numero_sobre: esActivo
              ? null
              : `S-${configSucursal.codigo}-${claveDia(dia)}-${turno.numero}`,
            efectivo_contado: null,
            incidencias: incidenciaCaja,
            _inicio: inicio,
            _fin: fin,
            _activo: esActivo,
            _sucursalKey: configSucursal.key,
            _cobros: 0,
            _estadias: 0,
            _efectivo: 0,
            _mp: 0,
            _total: 0,
          });
        }
      }

      // -----------------------------------------------------------------
      // Persistencia de los turnos.
      // -----------------------------------------------------------------
      await insertarEnLotes(
        Turno_Grua,
        turnosGrua.map(
          ({ _inicio, _fin, _activo, _sucursal, ...turno }) => turno,
        ),
        transaction,
      );
      await insertarEnLotes(
        Turno_Barrera,
        turnosBarrera.map(
          (
            {
              _inicio,
              _fin,
              _activo,
              _idBarrera,
              _idPlayero,
              _sucursalKey,
              ...turno
            },
          ) => turno,
        ),
        transaction,
      );
      await insertarEnLotes(
        Turno_Caja,
        turnosCaja.map(
          (
            {
              _inicio,
              _fin,
              _activo,
              _sucursalKey,
              _cobros,
              _estadias,
              _efectivo,
              _mp,
              _total,
              ...turno
            },
          ) => turno,
        ),
        transaction,
      );

      await insertarEnLotes(
        Turno_Barrera_Usuario,
        turnosBarrera.map((turno) => ({
          id: randomUUID(),
          id_turno_barrera: turno.id,
          id_usuario: turno._idPlayero,
        })),
        transaction,
      );

      const turnosBarreraPorBarrera = new Map(
        barreras.map((barrera) => [
          barrera.id,
          turnosBarrera.filter((turno) => turno._idBarrera === barrera.id),
        ]),
      );

      // -----------------------------------------------------------------
      // Acarreos de cada turno de grúa.
      // -----------------------------------------------------------------
      const acarreos = [];
      const cobros = [];
      const enlacesCobro = [];

      for (const turnoGrua of turnosGrua) {
        const duracion = turnoGrua._fin - turnoGrua._inicio;
        const disponibleHasta = Math.min(
          turnoGrua._fin.getTime(),
          ahora.getTime(),
        );
        const duracionDisponible = Math.max(
          30 * 60 * 1000,
          disponibleHasta - turnoGrua._inicio.getTime(),
        );
        const fraccion = Math.min(1, duracionDisponible / duracion);
        const base = entero(9, 15);
        const cantidad = turnoGrua._activo
          ? Math.max(4, Math.round(base * fraccion))
          : base;

        for (let i = 0; i < cantidad; i += 1) {
          const fechaAcarreo = new Date(
            turnoGrua._inicio.getTime() +
              Math.floor(random() * duracionDisponible),
          );

          if (fechaAcarreo > ahora) continue;

          const timeline = generarTimeline({
            fechaAcarreo,
            ahora,
            turnoActivo: turnoGrua._activo,
          });

          const indiceBarrera = entero(0, barreras.length - 1);
          const barrera = barreras[indiceBarrera];
          const turnosDeLaBarrera = turnosBarreraPorBarrera.get(barrera.id);

          const turnoBarrera =
            timeline.fecha_ingreso &&
            (buscarTurnoQueContiene(
              turnosDeLaBarrera,
              timeline.fecha_ingreso,
            ) ??
              buscarTurnoAnterior(
                turnosDeLaBarrera,
                timeline.fecha_ingreso,
              ));

          const cajaTurno =
            timeline.fecha_pago &&
            (buscarCajaQueContiene(
              turnosCaja.filter(
                (turno) => turno._sucursalKey === configSucursal.key,
              ),
              timeline.fecha_pago,
            ) ??
              buscarCajaAnterior(
                turnosCaja.filter(
                  (turno) => turno._sucursalKey === configSucursal.key,
                ),
                timeline.fecha_pago,
              ));

          const { patente, siguiente } = generarPatente(
            configSucursal,
            contadorPatente,
            vehiculosUsados,
          );
          contadorPatente = siguiente;

          const [marca, modelo, color] = elegir(MARCAS);
          const vehiculoId = randomUUID();
          const acarreoId = randomUUID();

          const esDenuncia = random() < 0.25;
          const tuvoSiniestro = random() < 0.05;
          const tieneDanios = random() < 0.18;
          const calle = elegir(CALLES);
          const direccion = `${calle} ${entero(100, 5900)}`;
          const motivo = elegir(MOTIVOS);
          const acta = contadorActa;
          contadorActa += 1;

          const incidenciasAcarreo = timeline.sinCargo
            ? `Salida sin cargo (${textoFecha(
                timeline.fecha_egreso,
              )}): autorizada por el supervisor de turno.`
            : random() < 0.1
              ? "El vehículo presentaba daños visibles al momento del acarreo."
              : null;

          const damages = tieneDanios
            ? {
                frontal: { width: 300, height: 300, paths: [] },
                lateralIzq: { width: 300, height: 300, paths: [] },
                lateralDer: { width: 300, height: 300, paths: [] },
                trasera: { width: 300, height: 300, paths: [] },
                techo: { width: 300, height: 300, paths: [] },
              }
            : null;

          acarreos.push({
            id: acarreoId,
            id_vehiculo: vehiculoId,
            id_cobro: null,
            id_turno_grua: turnoGrua.id,
            id_turno_barrera: turnoBarrera?.id ?? null,
            fecha_acarreo: fechaAcarreo,
            fecha_ingreso: timeline.fecha_ingreso,
            fecha_egreso: timeline.fecha_egreso,
            numero_acta: acta,
            estado: timeline.estado,
            direccion,
            motivo,
            fue_denuncia: esDenuncia,
            tuvo_siniestro: tuvoSiniestro,
            incidencias: incidenciasAcarreo,
            damages,
            _vehiculo: {
              id: vehiculoId,
              patente,
              marca,
              modelo,
              color,
            },
          });

          resumen.estados[timeline.estado] =
            (resumen.estados[timeline.estado] ?? 0) + 1;

          if (timeline.fecha_pago && cajaTurno) {
            const estadias = Math.min(
              70,
              Math.max(
                0,
                Math.floor(
                  (timeline.fecha_pago - fechaAcarreo) / (12 * 60 * 60 * 1000),
                ),
              ),
            );
            const total = redondear(
              Number(tarifa.acarreo) + Number(tarifa.estadia) * estadias,
            );

            const formaPago = random();
            let efectivo;

            if (formaPago < 0.6) {
              efectivo = total;
            } else if (formaPago < 0.85) {
              efectivo = 0;
            } else {
              efectivo = redondear(total * (0.2 + random() * 0.6));
            }

            const mp = redondear(total - efectivo);
            const cobroId = randomUUID();

            cobros.push({
              id: cobroId,
              id_turno_caja: cajaTurno.id,
              id_acarreo: acarreoId,
              total,
              efectivo,
              mp,
              fecha: timeline.fecha_pago,
              estadias,
              numero_factura:
                random() < 0.55
                  ? `F-${configSucursal.codigo}-${String(
                      contadorFactura,
                    ).padStart(6, "0")}`
                  : null,
              _cajaTurnoId: cajaTurno.id,
            });
            contadorFactura += 1;

            enlacesCobro.push({ acarreoId, cobroId });

            cajaTurno._cobros += 1;
            cajaTurno._estadias += estadias;
            cajaTurno._efectivo += efectivo;
            cajaTurno._mp += mp;
            cajaTurno._total += total;

            resumen.totalCobrado += total;
          }
        }
      }

      const vehiculos = acarreos.map((acarreo) => acarreo._vehiculo);
      const acarreosParaInsertar = acarreos.map(({ _vehiculo, ...acarreo }) => acarreo);
      const cobrosParaInsertar = cobros.map(({ _cajaTurnoId, ...cobro }) => cobro);

      await insertarEnLotes(Vehiculo, vehiculos, transaction);
      await insertarEnLotes(Acarreo, acarreosParaInsertar, transaction);
      await insertarEnLotes(Cobro, cobrosParaInsertar, transaction);

      // Enlace inverso acarreo → cobro (la FK es circular, por eso se actualiza
      // después de crear los cobros).
      for (const lote of enLotes(enlacesCobro, 400)) {
        const casos = lote
          .map(
            ({ acarreoId, cobroId }) =>
              `WHEN '${acarreoId}' THEN '${cobroId}'`,
          )
          .join(" ");
        const ids = lote.map(({ acarreoId }) => `'${acarreoId}'`).join(",");

        await sequelize.query(
          `UPDATE acarreos SET id_cobro = CASE id ${casos} END WHERE id IN (${ids})`,
          { transaction },
        );
      }

      // Totales y arqueo de cada turno de caja.
      for (const turno of turnosCaja) {
        const total = redondear(turno._total);
        const efectivo = redondear(turno._efectivo);
        const mp = redondear(turno._mp);
        const efectivoContado = turno._activo
          ? null
          : Math.max(
              0,
              redondear(
                efectivo + (random() < 0.2 ? entero(-2, 2) * 500 : 0),
              ),
            );

        await Turno_Caja.update(
          {
            total_autos: turno._cobros,
            total_estadias: turno._estadias,
            total_acarreos: turno._cobros,
            total_efectivo: efectivo,
            total_mp: mp,
            total,
            efectivo_contado: efectivoContado,
          },
          { where: { id: turno.id }, transaction },
        );
      }

      // Las grúas que tienen un turno abierto quedan en servicio.
      const idsGruasActivas = [
        ...new Set(
          turnosGrua
            .filter((turno) => turno._activo)
            .map((turno) => turno.id_grua),
        ),
      ];

      if (idsGruasActivas.length > 0) {
        await Grua.update(
          { estado: "EN_SERVICIO" },
          { where: { id: { [Op.in]: idsGruasActivas } }, transaction },
        );
      }

      resumen.sucursales.push({
        nombre: sucursal.nombre,
        id: sucursal.id,
        usuarios: usuarios.length,
        cajas: cajas.length,
        gruas: gruas.length,
        barreras: barreras.length,
        turnosGrua: turnosGrua.length,
        turnosBarrera: turnosBarrera.length,
        turnosCaja: turnosCaja.length,
        acarreos: acarreos.length,
        cobros: cobros.length,
      });
      resumen.usuarios += usuarios.length;
      resumen.cajas += cajas.length;
      resumen.gruas += gruas.length;
      resumen.barreras += barreras.length;
      resumen.turnosGrua += turnosGrua.length;
      resumen.turnosBarrera += turnosBarrera.length;
      resumen.turnosCaja += turnosCaja.length;
      resumen.acarreos += acarreos.length;
      resumen.cobros += cobros.length;
    }

    if (SIMULAR) {
      await transaction.rollback();
      console.log("\nSIMULACIÓN: se revirtieron todos los cambios.\n");
    } else {
      await transaction.commit();
      console.log("\nDatos alfa creados y confirmados.\n");
    }

    resumen.totalCobrado = redondear(resumen.totalCobrado);
    console.log(JSON.stringify(resumen, null, 2));
    console.log(`\nContraseña de los usuarios nuevos: ${PASSWORD}`);
    console.log(
      "Supervisores: Norte DNI 41000001 / Centro DNI 41000018 / Oeste DNI 41000035",
    );
    console.log("Cajeros: DNI 41000003, 41000004, 41000005, etc.");
    console.log(
      "Los legajos van de 2001 a 2051 y los DNI de 41000001 a 41000051.\n",
    );
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("Error al generar los datos alfa:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
