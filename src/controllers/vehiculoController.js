import {
  Acarreo,
  Grua,
  Sucursal,
  Turno_Grua,
  Vehiculo,
} from "../models/index.js";
import { construirInformePdf } from "../utils/informePdf.js";

// Estados de un acarreo en los que el vehículo todavía está en la playa.
const ESTADOS_EN_PLAYA = ["ACARREADO", "INGRESADO"];
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
const FORMATO_FECHA_ZONA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

class ErrorFiltro extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

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

/** Toma un parámetro de query que puede venir repetido. */
const listaDeQuery = (valor) => {
  const valores = Array.isArray(valor) ? valor : [valor];

  return valores
    .flatMap((item) => String(item ?? "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
};

const textoDeQuery = (valor) =>
  String(Array.isArray(valor) ? valor[0] ?? "" : valor ?? "").trim();

/**
 * Fecha `AAAA-MM-DD` del último acarreo en la zona horaria del país. Es la
 * misma fecha que usa la web (`toFechaInput`) para filtrar la tabla.
 */
const fechaEnZona = (fecha) => {
  if (!fecha) return "";

  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) return "";

  const partes = FORMATO_FECHA_ZONA.formatToParts(d);

  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value ?? "";

  return `${valor("year")}-${valor("month")}-${valor("day")}`;
};

const formatearFechaFiltro = (fecha) => {
  if (!FORMATO_FECHA.test(fecha)) return fecha;

  const [anio, mes, dia] = fecha.split("-");

  return `${dia}/${mes}/${anio}`;
};

/** Datos de todos los vehículos con su último acarreo resuelto. */
const obtenerVehiculosConUltimoAcarreo = async () => {
  const vehiculos = await Vehiculo.findAll({
    attributes: ["id", "patente", "marca", "modelo", "color"],
    include: [
      {
        model: Acarreo,
        attributes: ["id", "fecha_acarreo", "estado"],
        required: false,
        include: [
          {
            model: Turno_Grua,
            attributes: ["id"],
            include: [
              {
                model: Grua,
                attributes: ["id", "patente"],
                include: [
                  { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  // El último acarreo define el estado y la sucursal del vehículo. Se resuelve
  // en memoria porque cada vehículo tiene pocos acarreos (evita subconsultas
  // correlacionadas o funciones de ventana).
  return vehiculos
    .map((vehiculo) => {
      const json = vehiculo.toJSON();

      const acarreos = [...(json.Acarreos ?? [])].sort(
        (a, b) => new Date(b.fecha_acarreo) - new Date(a.fecha_acarreo),
      );

      const ultimo = acarreos[0] ?? null;
      const estado = ultimo?.estado ?? null;
      const sucursal = ultimo?.Turno_Grua?.Grua?.Sucursal ?? null;

      return {
        id: json.id,
        patente: json.patente,
        marca: json.marca,
        modelo: json.modelo,
        color: json.color,
        cantidad_acarreos: acarreos.length,
        ultimo_acarreo: ultimo?.fecha_acarreo ?? null,
        // Id del último acarreo: las acciones de la barrera (ingresar/egresar)
        // operan sobre ese acarreo.
        ultimo_acarreo_id: ultimo?.id ?? null,
        ultimo_acarreo_estado: estado,
        en_playa: ESTADOS_EN_PLAYA.includes(estado),
        Sucursal: sucursal
          ? {
              id: sucursal.id,
              nombre: sucursal.nombre,
              direccion: sucursal.direccion,
            }
          : null,
      };
    })
    // Orden pedido: primero los que están en playa y después por la fecha del
    // último acarreo (más reciente primero). Los vehículos sin acarreos van al
    // final.
    .sort((a, b) => {
      if (a.en_playa !== b.en_playa) return a.en_playa ? -1 : 1;

      const fechaA = new Date(a.ultimo_acarreo).getTime() || 0;
      const fechaB = new Date(b.ultimo_acarreo).getTime() || 0;

      return fechaB - fechaA;
    });
};

/**
 * Aplica los mismos filtros que la tabla de `/vehiculos`: búsqueda por patente
 * o modelo, sucursal y estado del último acarreo, y rango de fecha de ese
 * último acarreo.
 */
const filtrarVehiculos = (vehiculos, filtros) => {
  const busqueda = filtros.busqueda.toLowerCase();

  return vehiculos.filter((vehiculo) => {
    const cumpleBusqueda =
      !busqueda ||
      String(vehiculo.patente ?? "")
        .toLowerCase()
        .includes(busqueda) ||
      String(vehiculo.modelo ?? "")
        .toLowerCase()
        .includes(busqueda);

    const cumpleSucursal =
      filtros.sucursales.length === 0 ||
      (!!vehiculo.Sucursal &&
        filtros.sucursales.includes(vehiculo.Sucursal.nombre));

    const cumpleEstado =
      filtros.estados.length === 0 ||
      (!!vehiculo.ultimo_acarreo_estado &&
        filtros.estados.includes(vehiculo.ultimo_acarreo_estado));

    // La fecha se compara como texto `yyyy-MM-dd` en la zona horaria del país,
    // igual que en la tabla.
    const fecha = fechaEnZona(vehiculo.ultimo_acarreo);
    const cumpleDesde =
      !filtros.fechaDesde || (fecha !== "" && fecha >= filtros.fechaDesde);
    const cumpleHasta =
      !filtros.fechaHasta || (fecha !== "" && fecha <= filtros.fechaHasta);

    return (
      cumpleBusqueda &&
      cumpleSucursal &&
      cumpleEstado &&
      cumpleDesde &&
      cumpleHasta
    );
  });
};

const leerFiltrosVehiculos = (req) => {
  const filtros = {
    busqueda: textoDeQuery(req.query.busqueda),
    sucursales: listaDeQuery(req.query.sucursal),
    estados: listaDeQuery(req.query.estado).map((estado) =>
      estado.toUpperCase(),
    ),
    fechaDesde: textoDeQuery(req.query.fecha_desde),
    fechaHasta: textoDeQuery(req.query.fecha_hasta),
  };

  if (filtros.fechaDesde && !FORMATO_FECHA.test(filtros.fechaDesde)) {
    throw new ErrorFiltro(
      "El filtro 'fecha_desde' debe tener el formato AAAA-MM-DD",
    );
  }

  if (filtros.fechaHasta && !FORMATO_FECHA.test(filtros.fechaHasta)) {
    throw new ErrorFiltro(
      "El filtro 'fecha_hasta' debe tener el formato AAAA-MM-DD",
    );
  }

  if (filtros.fechaDesde && !fechaValida(filtros.fechaDesde)) {
    throw new ErrorFiltro("La fecha 'fecha_desde' no es válida");
  }

  if (filtros.fechaHasta && !fechaValida(filtros.fechaHasta)) {
    throw new ErrorFiltro("La fecha 'fecha_hasta' no es válida");
  }

  return filtros;
};

const construirDatosInformeVehiculos = async (req) => {
  const filtros = leerFiltrosVehiculos(req);
  const vehiculos = await obtenerVehiculosConUltimoAcarreo();
  const filtrados = filtrarVehiculos(vehiculos, filtros);

  const nombreSucursal =
    filtros.sucursales.length === 0
      ? "Todas las sucursales"
      : filtros.sucursales.length === 1
        ? filtros.sucursales[0]
        : `${filtros.sucursales.length} sucursales seleccionadas`;

  const rangoUltimoAcarreo =
    !filtros.fechaDesde && !filtros.fechaHasta
      ? "Sin filtro"
      : filtros.fechaDesde && filtros.fechaHasta
        ? `${formatearFechaFiltro(filtros.fechaDesde)} al ${formatearFechaFiltro(filtros.fechaHasta)}`
        : filtros.fechaDesde
          ? `Desde ${formatearFechaFiltro(filtros.fechaDesde)}`
          : `Hasta ${formatearFechaFiltro(filtros.fechaHasta)}`;

  const responsable =
    [req.user?.nombre, req.user?.apellido].filter(Boolean).join(" ") ||
    "Usuario del sistema";

  return {
    tipo: "VEHICULOS",
    titulo: "Listado de vehículos",
    tituloDatosInforme: "Datos del informe y filtros aplicados",
    sucursal: {
      id: null,
      nombre: nombreSucursal,
    },
    // El detalle de las fechas va en "Filtros aplicados"; así no se muestra
    // una hora artificial cuando el filtro es sólo por día.
    periodo: {
      desde: null,
      hasta: null,
      descripcion: "Según los filtros aplicados",
    },
    responsable: `${responsable} (${req.user?.rol ?? "USUARIO"})`,
    filasExtra: [
      {
        etiqueta: "Sucursal(es)",
        valor:
          filtros.sucursales.length === 0
            ? "Todas las sucursales"
            : filtros.sucursales.join(", "),
      },
      {
        etiqueta: "Estado(s)",
        valor:
          filtros.estados.length === 0
            ? "Todos los estados"
            : filtros.estados.join(", "),
      },
      {
        etiqueta: "Último acarreo",
        valor: rangoUltimoAcarreo,
      },
      {
        etiqueta: "Búsqueda",
        valor: filtros.busqueda || "Sin búsqueda",
      },
    ],
    resumen: [
      {
        etiqueta: "Vehículos listados",
        valor: String(filtrados.length),
      },
      {
        etiqueta: "En playa",
        valor: String(
          filtrados.filter((vehiculo) =>
            ESTADOS_EN_PLAYA.includes(vehiculo.ultimo_acarreo_estado),
          ).length,
        ),
      },
    ],
    movimientos: filtrados.map((vehiculo) => ({
      patente: vehiculo.patente,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      color: vehiculo.color,
      sucursal: vehiculo.Sucursal?.nombre ?? "Sin sucursal",
      estado: vehiculo.ultimo_acarreo_estado,
      cantidad_acarreos: vehiculo.cantidad_acarreos,
      ultimo_acarreo: vehiculo.ultimo_acarreo,
    })),
  };
};

export const obtenerVehiculos = async (req, res) => {
  try {
    const data = await obtenerVehiculosConUltimoAcarreo();

    return res.status(200).json({
      success: true,
      data,
      message: "Vehiculos obtenidos exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /vehiculos/informe.pdf — listado de vehículos con los filtros de la
 * pantalla (búsqueda, sucursal, estado y rango del último acarreo).
 */
export const generarInformeVehiculosPdf = async (req, res) => {
  try {
    const datos = await construirDatosInformeVehiculos(req);
    const doc = construirInformePdf(datos);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="informe-vehiculos-${Date.now()}.pdf"`,
    );

    doc.pipe(res);
    doc.end();
  } catch (err) {
    if (err instanceof ErrorFiltro) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }

    console.error("Error al generar el informe de vehículos:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const obtenerVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findByPk(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    return res.status(200).json({
      success: true,
      data: vehiculo,
      message: "Vehiculo obtenido exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const ingresarVehiculoAPlaya = async (req, res) => {
  try {
    const { patente, marca, modelo, color, fue_denuncia, playero_ingreso_id } =
      req.body;
    const vehiculo = await Vehiculo.create({
      patente,
      marca,
      modelo,
      color,
      playero_ingreso_id,
      estado: "INGRESADO",
      fue_denuncia,
    });

    return res.status(201).json({
      success: true,
      data: vehiculo,
      message: "Vehículo ingresado a la playa exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const editarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    // De un vehículo sólo se editan marca, modelo y color: la patente lo
    // identifica (decisión del autor).
    const { marca, modelo, color } = req.body;

    const esTextoValido = (valor) =>
      typeof valor === "string" && valor.trim() !== "";

    if (
      !esTextoValido(marca) ||
      !esTextoValido(modelo) ||
      !esTextoValido(color)
    ) {
      return res.status(400).json({
        success: false,
        message: "Los campos marca, modelo y color son obligatorios",
      });
    }

    const vehiculo = await Vehiculo.findByPk(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    // Igual que en el alta de acarreo (`crearAcarreo`), los datos del vehículo
    // se guardan en mayúsculas.
    await vehiculo.update({
      marca: marca.toUpperCase(),
      modelo: modelo.toUpperCase(),
      color: color.toUpperCase(),
    });

    return res.status(200).json({
      success: true,
      data: vehiculo,
      message: "Vehículo actualizado exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const eliminarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;

    const vehiculo = await Vehiculo.findByPk(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    const acarreos = await Acarreo.count({ where: { id_vehiculo: id } });

    if (acarreos > 0) {
      return res.status(409).json({
        success: false,
        message:
          "No se puede eliminar el vehículo porque tiene acarreos asociados",
      });
    }

    await vehiculo.destroy();

    return res.status(200).json({
      success: true,
      message: "Vehículo eliminado exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
