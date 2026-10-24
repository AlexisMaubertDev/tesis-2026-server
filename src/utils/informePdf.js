import PDFDocument from "pdfkit";

// Paleta de marca (misma que el comprobante de cobro y que la web).
const COLOR = {
  cerulean: "#41778b",
  ceruleanOscuro: "#213c45",
  ceruleanClaro: "#eef4f7",
  ceruleanMedio: "#dceaef",
  scarlet: "#d92632",
  gris: "#5b6b70",
  grisClaro: "#e8eef0",
  blanco: "#ffffff",
};

// Formatea una fecha como `dd/MM/yyyy HH:mm`.
export const formatoFecha = (fecha) => {
  if (!fecha) return "-";

  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) return "-";

  const dosDigitos = (n) => String(n).padStart(2, "0");

  return (
    `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}` +
    ` ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
  );
};

// Formatea un importe como `$ 83.000,00`.
export const formatoImporte = (valor) => {
  const numero = Number(valor ?? 0);

  if (!Number.isFinite(numero)) return "-";

  const [entero, decimal] = numero.toFixed(2).split(".");

  return `$ ${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
};

/**
 * Etiqueta legible del estado de un acarreo. Sólo la usan los informes
 * detallados (el de fin de turno): los informes de cierre de un turno no
 * muestran estados de vehículos.
 */
export const etiquetaEstado = (estado) =>
  ({
    ACARREADO: "Acarreado",
    INGRESADO: "En playa",
    COBRADO: "Cobrado",
    EGRESADO: "Egresado",
    SIN_CARGO: "Sin cargo",
  })[estado] ?? estado ?? "-";

/**
 * Recorta un texto para que entre en la celda: las filas de la tabla tienen un
 * solo alto de línea, así que un valor largo se corta con puntos suspensivos.
 */
const truncar = (valor, ancho) => {
  const texto = String(valor ?? "");

  if (!texto) return "";

  const maximo = Math.max(6, Math.floor((ancho - 12) / 4.2));

  if (texto.length <= maximo) return texto;

  return `${texto.slice(0, maximo - 1)}…`;
};

/**
 * Columnas de la tabla: [clave, título, ancho].
 * La fecha es la del movimiento en la playa (ingreso o egreso), no la del
 * acarreo, así que su título depende del tipo de informe.
 */
const columnasMovimientos = (datos) => [
  ["patente", "Patente", 70],
  ["vehiculo", "Vehículo", 130],
  ["fecha", datos.etiquetaFecha ?? "Fecha y hora", 100],
  ["barrera", "Barrera", 195],
];

/**
 * Columnas de la tabla del informe de cobros (RF21 / CU12).
 * Entran: fecha del cobro, patente, cajero/caja, estadías, total, efectivo, MP.
 */
const columnasCobros = (datos) => [
  ["fecha", datos.etiquetaFecha ?? "Fecha del cobro", 85],
  ["patente", "Patente", 52],
  ["cajero", "Cajero", 80],
  ["caja", "Caja", 40],
  ["estadias", "Estadías", 48],
  ["total", "Total", 62],
  ["efectivo", "Efectivo", 64],
  ["mp", "M. Pago", 64],
];

/**
 * Columnas del informe de un turno de barrera (RF15 / CU13): los movimientos
 * de la playa (entradas y salidas) durante el turno.
 */
const columnasTurnoBarrera = () => [
  ["tipo", "Movimiento", 75],
  ["patente", "Patente", 80],
  ["vehiculo", "Vehículo", 200],
  ["fecha", "Fecha y hora", 140],
];

/**
 * Columnas del informe de un turno de grúa (RF15 / RF27): los acarreos que
 * hizo la grúa durante el turno.
 */
const columnasTurnoGrua = () => [
  ["fecha", "Fecha y hora", 80],
  ["patente", "Patente", 60],
  ["vehiculo", "Vehículo", 115],
  ["direccion", "Dirección", 70],
  ["motivo", "Motivo", 80],
  ["incidencias", "Incidencias", 90],
];

const ALTO_ENCABEZADO_TABLA = 20;
const ALTO_FILA = 24;

/** Columnas de la tabla según el tipo de informe. */
const columnasDe = (datos) => {
  switch (datos.tipo) {
    case "COBRO":
      return columnasCobros(datos);
    case "TURNO_BARRERA":
      return columnasTurnoBarrera();
    case "TURNO_GRUA":
      return columnasTurnoGrua();
    default:
      return columnasMovimientos(datos);
  }
};

/** Título de la sección donde va la tabla. */
const tituloTablaDe = (datos) => {
  switch (datos.tipo) {
    case "COBRO":
      return "Detalle de cobros";
    case "TURNO_BARRERA":
      return "Detalle de movimientos";
    case "TURNO_GRUA":
      return "Detalle de acarreos";
    default:
      return "Detalle de vehículos";
  }
};

/** Mensaje que se muestra cuando la tabla no tiene filas. */
const mensajeVacioDe = (datos) => {
  switch (datos.tipo) {
    case "COBRO":
      return "No hay cobros en el período seleccionado.";
    case "TURNO_BARRERA":
      return "No hubo entradas ni salidas durante el turno.";
    case "TURNO_GRUA":
      return "No hubo acarreos durante el turno.";
    default:
      return "No hay movimientos en el período seleccionado.";
  }
};

/**
 * Filas del resumen. Si el informe las trae ya armadas (`datos.resumen`), se
 * usan esas; si no, se calculan según el tipo de informe.
 */
const resumenDe = (datos) => {
  if (Array.isArray(datos.resumen)) return datos.resumen;

  switch (datos.tipo) {
    case "COBRO":
      return [
        { etiqueta: "Cobros", valor: String(datos.totales.cantidad) },
        { etiqueta: "Total cobrado", valor: formatoImporte(datos.totales.total) },
        { etiqueta: "Efectivo", valor: formatoImporte(datos.totales.efectivo) },
        { etiqueta: "Mercado Pago", valor: formatoImporte(datos.totales.mp) },
        { etiqueta: "Estadías", valor: String(datos.totales.estadias ?? 0) },
      ];
    case "TURNO_BARRERA":
      return [
        {
          etiqueta: "Ingresos a la playa",
          valor: String(datos.totales.ingresos ?? 0),
        },
        {
          etiqueta: "Egresos de la playa",
          valor: String(datos.totales.egresos ?? 0),
        },
        {
          etiqueta: "Movimientos",
          valor: String(datos.totales.cantidad ?? 0),
        },
      ];
    case "TURNO_GRUA":
      // Regla de informes: el cierre de un turno no muestra estados de los
      // vehículos, sólo lo que hizo el turno (los acarreos de la grúa).
      return [
        { etiqueta: "Acarreos", valor: String(datos.totales.cantidad ?? 0) },
      ];
    default:
      return [
        { etiqueta: "Vehículos", valor: String(datos.totales.cantidad) },
        { etiqueta: "Con cobro", valor: String(datos.totales.cobrados) },
        { etiqueta: "Sin cargo", valor: String(datos.totales.sinCargo) },
        { etiqueta: "Total cobrado", valor: formatoImporte(datos.totales.totalCobrado) },
      ];
  }
};

/**
 * Construye el PDF de un informe. Devuelve el `PDFDocument` listo para
 * `pipe()`.
 *
 * Además de los informes de movimientos (RF19/RF20) y de cobros (RF21/CU12),
 * sirve para los informes de turno (RF15 / RF27): el de una barrera, el de una
 * grúa y el consolidado de la sucursal. Estos últimos pueden traer:
 *  - `filasExtra`: filas adicionales en la sección "Datos del informe".
 *  - `resumen`: las filas del resumen ya armadas.
 *  - `secciones`: varias tablas (una por sección) en vez de una sola.
 *
 * Regla de informes del proyecto:
 *  - Los **cierres de turno** muestran sólo lo del turno (datos, usuarios y
 *    roles, inicio/cierre, incidencias y los movimientos de esa entidad). No
 *    muestran estados de vehículos.
 *  - El **informe de fin de turno** (detallado, por rango de tiempo) es el
 *    único que muestra la cuenta de vehículos por estado y todas las secciones
 *    por barrera, grúa y caja.
 */
export const construirInformePdf = (datos) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    info: {
      Title: `${datos.titulo} — ${datos.sucursal.nombre}`,
      Author: "Sistema de Gestión de Acarreos",
    },
  });

  const MARGEN = 50;
  const ANCHO = doc.page.width; // 595.28 (A4)
  const ANCHO_UTIL = ANCHO - MARGEN * 2;
  const X = MARGEN;
  const PIE = doc.page.height - 72;

  // --------------------------------------------------------------------
  // Encabezado: banda de color con la marca y el tipo de informe.
  // --------------------------------------------------------------------
  const ALTO_ENCABEZADO = 116;
  const ANCHO_BLOQUE_DERECHO = 185;
  const X_BLOQUE_DERECHO = ANCHO - ANCHO_BLOQUE_DERECHO;
  const ANCHO_TEXTO_DERECHO = ANCHO_BLOQUE_DERECHO - 24;
  const ANCHO_TEXTO_IZQUIERDO = X_BLOQUE_DERECHO - X - 20;

  doc.rect(0, 0, ANCHO, ALTO_ENCABEZADO).fill(COLOR.cerulean);
  doc.rect(0, ALTO_ENCABEZADO, ANCHO, 5).fill(COLOR.scarlet);
  doc
    .rect(X_BLOQUE_DERECHO, 0, ANCHO_BLOQUE_DERECHO, ALTO_ENCABEZADO)
    .fill(COLOR.ceruleanOscuro);

  doc
    .fillColor(COLOR.blanco)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text("ParkControl", X, 30, { width: ANCHO_TEXTO_IZQUIERDO });

  doc
    .font("Helvetica")
    .fontSize(13)
    .text("Sistema de Gestión de Acarreos", X, 58, {
      width: ANCHO_TEXTO_IZQUIERDO,
      characterSpacing: 0.5,
    });

  doc
    .fontSize(9)
    .fillColor(COLOR.ceruleanMedio)
    .text(datos.titulo.toLowerCase(), X, 84, { width: ANCHO_TEXTO_IZQUIERDO });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLOR.ceruleanMedio)
    .text("INFORME", X_BLOQUE_DERECHO + 12, 30, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(datos.sucursal.nombre.length > 18 ? 12 : 18)
    .fillColor(COLOR.blanco)
    .text(datos.sucursal.nombre, X_BLOQUE_DERECHO + 12, 44, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLOR.ceruleanMedio)
    .text("Generado el", X_BLOQUE_DERECHO + 12, 72, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLOR.blanco)
    .text(formatoFecha(new Date()), X_BLOQUE_DERECHO + 12, 84, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  let y = ALTO_ENCABEZADO + 30;

  // --------------------------------------------------------------------
  // Helpers de dibujo
  // --------------------------------------------------------------------

  const tituloSeccion = (texto, yActual) => {
    doc.rect(X, yActual, ANCHO_UTIL, 22).fill(COLOR.cerulean);
    doc
      .fillColor(COLOR.blanco)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(truncar(texto.toUpperCase(), ANCHO_UTIL - 20), X + 10, yActual + 6, {
        width: ANCHO_UTIL - 20,
        characterSpacing: 0.6,
      });
    return yActual + 22;
  };

  const tarjetaDatos = (filas, yActual) => {
    const anchoEtiqueta = 150;
    let yFila = yActual;

    filas.forEach((fila, indice) => {
      if (indice % 2 === 0) {
        doc.rect(X, yFila, ANCHO_UTIL, ALTO_FILA).fill(COLOR.ceruleanClaro);
      }

      doc
        .fillColor(COLOR.gris)
        .font("Helvetica")
        .fontSize(9)
        .text(truncar(fila.etiqueta, anchoEtiqueta), X + 12, yFila + 6, {
          width: anchoEtiqueta,
        });

      doc
        .fillColor(COLOR.ceruleanOscuro)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(truncar(fila.valor, ANCHO_UTIL - anchoEtiqueta - 24), X + 12 + anchoEtiqueta, yFila + 6, {
          width: ANCHO_UTIL - anchoEtiqueta - 24,
        });

      yFila += ALTO_FILA;
    });

    doc
      .rect(X, yActual, ANCHO_UTIL, yFila - yActual)
      .lineWidth(0.5)
      .strokeColor(COLOR.grisClaro)
      .stroke();

    return yFila;
  };

  // --------------------------------------------------------------------
  // Sección: datos del informe
  // --------------------------------------------------------------------
  y = tituloSeccion("Datos del informe", y);

  const filasInforme = [
    { etiqueta: "Tipo de informe", valor: datos.titulo },
    { etiqueta: "Sucursal", valor: datos.sucursal.nombre },
    { etiqueta: "Período", valor: datos.periodo.descripcion },
    {
      etiqueta: "Desde / hasta",
      valor: `${formatoFecha(datos.periodo.desde)}  al  ${formatoFecha(datos.periodo.hasta)}`,
    },
  ];

  // Informe de cierre de turno (RF14/CU08 y RF15/CU13): se agrega el responsable.
  if (datos.responsable) {
    filasInforme.push({ etiqueta: "Responsable", valor: datos.responsable });
  }

  // Datos propios del informe (barrera, grúa, responsables del turno, etc.).
  if (Array.isArray(datos.filasExtra)) {
    filasInforme.push(...datos.filasExtra);
  }

  y = tarjetaDatos(filasInforme, y);

  y += 24;

  // --------------------------------------------------------------------
  // Sección: resumen
  // --------------------------------------------------------------------
  y = tituloSeccion("Resumen", y);
  y = tarjetaDatos(resumenDe(datos), y);

  y += 24;

  // --------------------------------------------------------------------
  // Sección: arqueo de cierre (sólo el informe de un turno de caja)
  // --------------------------------------------------------------------
  if (datos.arqueo) {
    const { numero_sobre, efectivoEsperado, efectivoContado, diferencia } =
      datos.arqueo;

    const filasArqueo = [
      { etiqueta: "N° de sobre", valor: numero_sobre || "-" },
      {
        etiqueta: "Efectivo esperado",
        valor: formatoImporte(efectivoEsperado),
      },
      {
        etiqueta: "Efectivo contado",
        valor:
          efectivoContado === null || efectivoContado === undefined
            ? "No informado"
            : formatoImporte(efectivoContado),
      },
    ];

    if (diferencia !== null && diferencia !== undefined) {
      const signo = diferencia > 0 ? "Sobrante" : diferencia < 0 ? "Faltante" : "Sin diferencia";
      filasArqueo.push({
        etiqueta: "Diferencia",
        valor: `${formatoImporte(Math.abs(diferencia))} (${signo})`,
      });
    }

    y = tituloSeccion("Arqueo de cierre", y);
    y = tarjetaDatos(filasArqueo, y);

    y += 24;
  }

  // --------------------------------------------------------------------
  // Secciones de tablas
  // --------------------------------------------------------------------
  const valorColumna = (movimiento, clave) => {
    switch (clave) {
      case "patente":
        return movimiento.patente ?? "-";
      case "vehiculo":
        return (
          [movimiento.marca, movimiento.modelo, movimiento.color]
            .filter(Boolean)
            .join(" ") || "-"
        );
      case "fecha":
        return formatoFecha(movimiento.fecha);
      case "inicio":
        return formatoFecha(movimiento.inicio);
      case "cierre":
        return movimiento.cierre
          ? formatoFecha(movimiento.cierre)
          : "Turno abierto";
      case "barrera":
        return movimiento.barrera ?? "-";
      case "tipo":
        return movimiento.tipo === "SALIDA" ? "Salida" : "Entrada";
      case "direccion":
        return movimiento.direccion ?? "-";
      case "motivo":
        return movimiento.motivo ?? "-";
      case "grua":
        return movimiento.grua ?? "-";
      case "cajero":
        return movimiento.cajero ?? "-";
      case "caja":
        return movimiento.caja
          ? `N° ${movimiento.caja.numero_caja}`
          : "-";
      case "estadias":
        return movimiento.estadias != null ? String(movimiento.estadias) : "-";
      case "total":
        return formatoImporte(movimiento.total);
      case "efectivo":
        return formatoImporte(movimiento.efectivo);
      case "mp":
        return formatoImporte(movimiento.mp);
      case "estado":
        return etiquetaEstado(movimiento.estado);
      case "cantidad":
        return String(movimiento.cantidad ?? 0);
      case "turno":
        return movimiento.turno != null ? String(movimiento.turno) : "-";
      case "entidad":
        return movimiento.entidad ?? "-";
      case "usuarios":
        return movimiento.usuarios ?? "-";
      case "incidencias":
        return movimiento.incidencias ?? "-";
      case "tipoEntidad":
        return movimiento.tipoEntidad ?? "-";
      default:
        return movimiento[clave] ?? "-";
    }
  };

  /**
   * Dibuja una tabla (encabezado + filas) y devuelve la posición vertical
   * siguiente. Si la fila no entra en la página, pasa a una nueva y repite el
   * encabezado.
   */
  const dibujarTabla = (columnas, filas, yActual, mensajeVacio) => {
    let yTabla = yActual;

    const dibujarEncabezadoTabla = (yIni) => {
      let x = X;

      doc.rect(X, yIni, ANCHO_UTIL, ALTO_ENCABEZADO_TABLA).fill(COLOR.ceruleanOscuro);

      columnas.forEach(([, titulo, ancho]) => {
        doc
          .fillColor(COLOR.blanco)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(truncar(titulo.toUpperCase(), ancho), x + 6, yIni + 6, {
            width: ancho - 12,
            characterSpacing: 0.4,
          });
        x += ancho;
      });

      return yIni + ALTO_ENCABEZADO_TABLA;
    };

    yTabla = dibujarEncabezadoTabla(yTabla);

    if (filas.length === 0) {
      doc
        .fillColor(COLOR.gris)
        .font("Helvetica-Oblique")
        .fontSize(9)
        .text(mensajeVacio, X + 10, yTabla + 10, { width: ANCHO_UTIL - 20 });

      return yTabla + 30;
    }

    filas.forEach((fila, indice) => {
      // Si la fila no entra, se pasa a página nueva y se repite el encabezado.
      if (yTabla + ALTO_FILA > PIE - 10) {
        doc.addPage();
        yTabla = MARGEN + 10;
        yTabla = dibujarEncabezadoTabla(yTabla);
      }

      if (indice % 2 === 0) {
        doc.rect(X, yTabla, ANCHO_UTIL, ALTO_FILA).fill(COLOR.ceruleanClaro);
      }

      let x = X;

      columnas.forEach(([clave, , ancho]) => {
        const valor = valorColumna(fila, clave);

        doc
          .fillColor(COLOR.gris)
          .font("Helvetica")
          .fontSize(8)
          .text(truncar(valor, ancho), x + 6, yTabla + 8, { width: ancho - 12 });

        x += ancho;
      });

      yTabla += ALTO_FILA;
    });

    // Línea de cierre de la tabla (en la última página).
    doc
      .moveTo(X, yTabla)
      .lineTo(X + ANCHO_UTIL, yTabla)
      .lineWidth(0.5)
      .strokeColor(COLOR.grisClaro)
      .stroke();

    return yTabla;
  };

  // Los informes de turno (RF15 / RF27) pueden traer varias tablas: una por
  // sección (cobros, barreras, grúas...). Los demás traen una sola.
  const secciones = Array.isArray(datos.secciones)
    ? datos.secciones
    : [
        {
          titulo: tituloTablaDe(datos),
          columnas: columnasDe(datos),
          filas: datos.movimientos ?? [],
          mensajeVacio: mensajeVacioDe(datos),
          nota:
            datos.tipo === "ENTRADA" || datos.tipo === "SALIDA"
              ? "Los playeros mostrados son los asignados al turno de barrera del movimiento."
              : null,
        },
      ];

  secciones.forEach((seccion, indice) => {
    // Si la sección pide página nueva (informe detallado) o no entra la tabla,
    // se pasa a página nueva.
    if (indice > 0 && (seccion.nuevaPagina || y + 120 > PIE - 10)) {
      doc.addPage();
      y = MARGEN + 10;
    }

    y = tituloSeccion(seccion.titulo, y);
    y = dibujarTabla(
      seccion.columnas,
      seccion.filas ?? [],
      y,
      seccion.mensajeVacio ?? "No hay datos para mostrar.",
    );

    if (seccion.nota) {
      doc
        .fillColor(COLOR.gris)
        .font("Helvetica-Oblique")
        .fontSize(7)
        .text(seccion.nota, X, y + 8, { width: ANCHO_UTIL });

      y += 18;
    }

    y += 24;
  });

  // --------------------------------------------------------------------
  // Pie de página
  // --------------------------------------------------------------------
  const dibujarPie = () => {
    const yPie = PIE;

    doc
      .moveTo(MARGEN, yPie)
      .lineTo(ANCHO - MARGEN, yPie)
      .lineWidth(0.5)
      .strokeColor(COLOR.grisClaro)
      .stroke();

    doc
      .fillColor(COLOR.gris)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Documento interno generado por el sistema. No es válido como factura fiscal.",
        MARGEN,
        yPie + 8,
        { width: ANCHO_UTIL, align: "center" },
      );

    doc
      .fillColor(COLOR.cerulean)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Sistema de Gestión de Acarreos", MARGEN, yPie + 20, {
        width: ANCHO_UTIL,
        align: "center",
      });

    doc
      .fillColor(COLOR.gris)
      .font("Helvetica")
      .fontSize(8)
      .text("ParkControl", MARGEN, yPie + 32, { width: ANCHO_UTIL, align: "center" });
  };

  const rango = doc.bufferedPageRange();

  for (let i = rango.start; i < rango.start + rango.count; i += 1) {
    doc.switchToPage(i);
    dibujarPie();

    doc
      .fillColor(COLOR.gris)
      .font("Helvetica")
      .fontSize(8)
      .text(`Página ${i - rango.start + 1} de ${rango.count}`, MARGEN, PIE + 44, {
        width: ANCHO_UTIL,
        align: "center",
      });
  }

  return doc;
};
