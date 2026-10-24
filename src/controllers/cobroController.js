import sequelize from "../config/db.js";
import {
  Acarreo,
  Caja,
  Cobro,
  Tarifa,
  Turno_Caja,
  Usuario,
  Vehiculo,
} from "../models/index.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import {
  HORAS_POR_ESTADIA,
  MAX_ESTADIAS,
  calcularEstadias,
} from "../utils/estadias.js";
import PDFDocument from "pdfkit";

// Formatea una fecha como `dd/MM/yyyy HH:mm` en hora local del servidor.
const formatoFecha = (fecha) => {
  if (!fecha) return "-";

  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) return "-";

  const dosDigitos = (n) => String(n).padStart(2, "0");

  return (
    `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}` +
    ` ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
  );
};

// Paleta de marca (misma que la web, ver src/styles/index.css).
const COLOR = {
  cerulean: "#41778b",
  ceruleanOscuro: "#213c45",
  ceruleanClaro: "#eef4f7",
  ceruleanMedio: "#dceaef",
  scarlet: "#d92632",
  scarletOscuro: "#ad1f28",
  sanMarino: "#39659e",
  gris: "#5b6b70",
  grisClaro: "#e8eef0",
  blanco: "#ffffff",
};

// Formatea un importe como `$ 83.000,00` (separador de miles punto, decimales coma).
const formatoImporte = (valor) =>
  `$ ${Number(valor || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Los importes se guardan con 2 decimales: redondear antes de comparar evita
// falsos negativos por errores de punto flotante (0.1 + 0.2 !== 0.3).
const aImporte = (valor) => Math.round(Number(valor) * 100) / 100;

const esImporteValido = (valor) =>
  valor !== "" &&
  valor !== null &&
  valor !== undefined &&
  Number.isFinite(Number(valor)) &&
  Number(valor) >= 0;

/**
 * Vista previa del cobro (lo que la pantalla del cajero muestra antes de
 * registrar): la tarifa vigente, las estadías calculadas por reloj y el total
 * a abonar. Así el importe se calcula en un solo lugar (el servidor).
 */
export const obtenerPreviewCobro = async (req, res) => {
  try {
    const { id_acarreo } = req.params;

    const acarreo = await Acarreo.findByPk(id_acarreo);

    if (!acarreo) {
      return res
        .status(404)
        .json({ success: false, message: "Acarreo no encontrado" });
    }

    const tarifa = await Tarifa.findOne({
      where: { vigente: true },
      order: [["vigente_desde", "DESC"]],
    });

    const estadias = calcularEstadias(acarreo.fecha_acarreo);
    const total = tarifa
      ? aImporte(Number(tarifa.acarreo) + Number(tarifa.estadia) * estadias)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        id_acarreo: acarreo.id,
        fecha_acarreo: acarreo.fecha_acarreo,
        estadias,
        max_estadias: MAX_ESTADIAS,
        horas_por_estadia: HORAS_POR_ESTADIA,
        tope_estadias: estadias >= MAX_ESTADIAS,
        tarifa,
        total,
      },
      message: tarifa
        ? "Total calculado exitosamente"
        : "No hay una tarifa vigente configurada",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * Registra el cobro de un vehículo ingresado en la playa (cajero).
 *
 * Verifica el turno de caja abierto del usuario, que el acarreo esté
 * INGRESADO y los importes sean coherentes. El total lo calcula el servidor a
 * partir de la tarifa vigente y de las estadías por reloj (cada 12 horas desde
 * el acarreo, tope 70): `acarreo + estadía × estadías`. El cliente sólo informa
 * los medios de pago, que deben sumar exactamente ese total. Luego crea el
 * `Cobro`, pasa el acarreo a COBRADO y lo vincula (`id_cobro`).
 */
export const crearCobro = async (req, res) => {
  const { id_acarreo, efectivo, mp, numero_factura } = req.body;

  if (!id_acarreo) {
    return res
      .status(400)
      .json({ success: false, message: "Falta el acarreo a cobrar" });
  }

  if (!esImporteValido(efectivo) || !esImporteValido(mp)) {
    return res.status(400).json({
      success: false,
      message: "Los importes deben ser números mayores o iguales a cero",
    });
  }

  const efectivoNum = aImporte(efectivo);
  const mpNum = aImporte(mp);

  let transaction;

  try {
    transaction = await sequelize.transaction();

    // El cobro se asocia al turno de caja abierto del cajero.
    const turnoCaja = await Turno_Caja.findOne({
      where: { id_usuario: req.user.id, activo: true },
      transaction,
    });

    if (!turnoCaja) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Necesitás un turno de caja abierto para registrar cobros",
      });
    }

    // El acarreo debe existir, estar en la playa y no tener cobro.
    const acarreo = await Acarreo.findByPk(id_acarreo, {
      include: { model: Vehiculo },
      transaction,
    });

    if (!acarreo) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Acarreo no encontrado" });
    }

    if (acarreo.estado !== "INGRESADO") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "El vehículo no está en la playa (ingresado), no se puede cobrar",
      });
    }

    if (acarreo.id_cobro) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "El acarreo ya tiene un cobro registrado",
      });
    }

    // El importe sale de la tarifa vigente y de las estadías por reloj:
    // acarreo + estadía × estadías (cada 12 h desde el acarreo, tope 70).
    const tarifa = await Tarifa.findOne({
      where: { vigente: true },
      order: [["vigente_desde", "DESC"]],
      transaction,
    });

    if (!tarifa) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "No hay una tarifa vigente configurada",
      });
    }

    const estadiasNum = calcularEstadias(acarreo.fecha_acarreo);

    const totalNum = aImporte(
      Number(tarifa.acarreo) + Number(tarifa.estadia) * estadiasNum,
    );

    if (aImporte(efectivoNum + mpNum) !== totalNum) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El total a pagar es $${totalNum}: el efectivo más Mercado Pago debe sumar ese importe`,
      });
    }

    const cobro = await Cobro.create(
      {
        id_turno_caja: turnoCaja.id,
        id_acarreo: acarreo.id,
        total: totalNum,
        efectivo: efectivoNum,
        mp: mpNum,
        fecha: new Date(),
        estadias: estadiasNum,
        numero_factura:
          typeof numero_factura === "string" && numero_factura.trim() !== ""
            ? numero_factura.trim()
            : null,
      },
      { transaction },
    );

    await acarreo.update(
      { estado: "COBRADO", id_cobro: cobro.id },
      { transaction },
    );

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "REGISTRAR_COBRO",
      entidad: "COBRO",
      idEntidad: cobro.id,
      descripcion: `Se registró el cobro del acarreo ${acarreo.id} por $${totalNum}`,
      antes: { estado: "INGRESADO" },
      despues: { estado: "COBRADO", cobro: cobro.toJSON() },
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      data: { cobro, acarreo },
      message: "Cobro registrado exitosamente",
    });
  } catch (error) {
    // Si la transacción ya se cerró (commit), no se puede revertir.
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * Cobros del turno de caja abierto del cajero (home del cajero).
 *
 * Devuelve el turno, los cobros del turno (con el acarreo y el vehículo de
 * cada uno) y los totales calculados a partir de los cobros. Si el usuario no
 * tiene un turno abierto, devuelve la lista vacía.
 */
export const obtenerCobrosDeMiTurno = async (req, res) => {
  try {
    const turnoCaja = await Turno_Caja.findOne({
      where: { id_usuario: req.user.id, activo: true },
      include: {
        model: Caja,
        attributes: ["id", "numero_caja", "referencia"],
      },
    });

    if (!turnoCaja) {
      return res.status(200).json({
        success: true,
        data: {
          turno_caja: null,
          cobros: [],
          totales: { cantidad: 0, total: 0, efectivo: 0, mp: 0 },
        },
        message: "No tenés un turno de caja abierto",
      });
    }

    const cobros = await Cobro.findAll({
      where: { id_turno_caja: turnoCaja.id },
      order: [["fecha", "DESC"]],
      include: [{ model: Acarreo, include: [{ model: Vehiculo }] }],
    });

    const totales = cobros.reduce(
      (acc, cobro) => ({
        cantidad: acc.cantidad + 1,
        total: aImporte(acc.total + Number(cobro.total)),
        efectivo: aImporte(acc.efectivo + Number(cobro.efectivo)),
        mp: aImporte(acc.mp + Number(cobro.mp)),
      }),
      { cantidad: 0, total: 0, efectivo: 0, mp: 0 },
    );

    return res.status(200).json({
      success: true,
      data: { turno_caja: turnoCaja, cobros, totales },
      message: "Cobros del turno obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * Construye el documento PDF del comprobante de un cobro (sin enviarlo). Se
 * separa del controlador para poder reutilizarlo desde scripts de prueba.
 * Devuelve el `PDFDocument` listo para `pipe()` (respuesta HTTP o archivo).
 */
export const construirComprobantePdf = (cobro) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    info: {
      Title: `Comprobante de cobro ${cobro.id}`,
      Author: "Sistema de Gestión de Acarreos",
    },
  });

  const vehiculo = cobro.Acarreo?.Vehiculo;
  const turno = cobro.Turno_Caja;

  const MARGEN = 50;
  const ANCHO = doc.page.width; // 595.28 (A4)
  const ANCHO_UTIL = ANCHO - MARGEN * 2;
  const X = MARGEN;

  // El número de comprobante coincide con el N° de factura del cobro; si el
  // cobro no tiene factura cargada, se usa un identificador corto del cobro.
  const numeroComprobante =
    cobro.numero_factura?.trim() || `#${String(cobro.id).slice(0, 8).toUpperCase()}`;

  // --------------------------------------------------------------------
  // Encabezado: banda de color a todo el ancho con título y número.
  // --------------------------------------------------------------------
  const ALTO_ENCABEZADO = 116;
  const ANCHO_BLOQUE_DERECHO = 185;
  const X_BLOQUE_DERECHO = ANCHO - ANCHO_BLOQUE_DERECHO;
  const ANCHO_TEXTO_DERECHO = ANCHO_BLOQUE_DERECHO - 24;

  doc.rect(0, 0, ANCHO, ALTO_ENCABEZADO).fill(COLOR.cerulean);
  // Franja de acento roja al pie del encabezado.
  doc.rect(0, ALTO_ENCABEZADO, ANCHO, 5).fill(COLOR.scarlet);

  // Bloque decorativo a la derecha (más oscuro) para el número.
  doc
    .rect(X_BLOQUE_DERECHO, 0, ANCHO_BLOQUE_DERECHO, ALTO_ENCABEZADO)
    .fill(COLOR.ceruleanOscuro);

  const ANCHO_TEXTO_IZQUIERDO = X_BLOQUE_DERECHO - X - 20;

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
    .text("comprobante de cobro", X, 84, {
      width: ANCHO_TEXTO_IZQUIERDO,
    });

  // Columna derecha: número de comprobante y fecha de emisión. Si el número es
  // largo (ej: "A-0001 / B-2015") se reduce la fuente para que entre en un
  // renglón.
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLOR.ceruleanMedio)
    .text("COMPROBANTE N°", X_BLOQUE_DERECHO + 12, 30, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  const tamanoNumero = numeroComprobante.length > 12 ? 13 : 18;

  doc
    .font("Helvetica-Bold")
    .fontSize(tamanoNumero)
    .fillColor(COLOR.blanco)
    .text(numeroComprobante, X_BLOQUE_DERECHO + 12, 44, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLOR.ceruleanMedio)
    .text("Emitido el", X_BLOQUE_DERECHO + 12, 72, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLOR.blanco)
    .text(formatoFecha(cobro.fecha), X_BLOQUE_DERECHO + 12, 84, {
      width: ANCHO_TEXTO_DERECHO,
      align: "right",
    });

  let y = ALTO_ENCABEZADO + 30;

  // --------------------------------------------------------------------
  // Helpers de dibujo
  // --------------------------------------------------------------------

  // Barra de título de sección (fondo de marca + texto blanco).
  const tituloSeccion = (texto, yActual) => {
    doc.rect(X, yActual, ANCHO_UTIL, 22).fill(COLOR.cerulean);
    doc
      .fillColor(COLOR.blanco)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(texto.toUpperCase(), X + 10, yActual + 6, {
        width: ANCHO_UTIL - 20,
        characterSpacing: 0.6,
      });
    return yActual + 22;
  };

  // Tarjeta de filas etiqueta/valor; las filas pares llevan fondo claro.
  const tarjetaDatos = (filas, yActual) => {
    const ALTO_FILA = 20;
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
        .text(fila.etiqueta, X + 12, yFila + 6, { width: anchoEtiqueta });

      doc
        .fillColor(COLOR.ceruleanOscuro)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(fila.valor, X + 12 + anchoEtiqueta, yFila + 6, {
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

  const espacio = (alto) => {
    y += alto;
  };

  // --------------------------------------------------------------------
  // Sección: datos del cobro
  // --------------------------------------------------------------------
  y = tituloSeccion("Datos del cobro", y);
  y = tarjetaDatos(
    [
      { etiqueta: "N° de comprobante", valor: numeroComprobante },
      { etiqueta: "Fecha y hora del cobro", valor: formatoFecha(cobro.fecha) },
      { etiqueta: "Estadías aplicadas", valor: String(cobro.estadias ?? "-") },
    ],
    y,
  );

  espacio(22);

  // --------------------------------------------------------------------
  // Sección: vehículo y acarreo
  // --------------------------------------------------------------------
  y = tituloSeccion("Vehículo y acarreo", y);
  y = tarjetaDatos(
    [
      { etiqueta: "Patente", valor: vehiculo?.patente || "-" },
      {
        etiqueta: "Vehículo",
        valor:
          [vehiculo?.marca, vehiculo?.modelo, vehiculo?.color]
            .filter(Boolean)
            .join(" - ") || "-",
      },
      {
        etiqueta: "Fecha y hora del acarreo",
        valor: formatoFecha(cobro.Acarreo?.fecha_acarreo),
      },
      {
        etiqueta: "Dirección del acarreo",
        valor: cobro.Acarreo?.direccion || "-",
      },
      {
        etiqueta: "Motivo del acarreo",
        valor: cobro.Acarreo?.motivo || "-",
      },
    ],
    y,
  );

  espacio(22);

  // --------------------------------------------------------------------
  // Sección: caja
  // --------------------------------------------------------------------
  y = tituloSeccion("Caja", y);
  y = tarjetaDatos(
    [
      {
        etiqueta: "Caja",
        valor: turno?.Caja
          ? `N° ${turno.Caja.numero_caja} · ${turno.Caja.referencia || "-"}`
          : "-",
      },
    ],
    y,
  );

  espacio(22);

  // --------------------------------------------------------------------
  // Sección: detalle de pago
  // --------------------------------------------------------------------
  y = tituloSeccion("Detalle de pago", y);

  const ALTO_FILA_PAGO = 22;
  const pagos = [
    { etiqueta: "Efectivo", valor: formatoImporte(cobro.efectivo) },
    { etiqueta: "Mercado Pago", valor: formatoImporte(cobro.mp) },
  ];

  pagos.forEach((pago, indice) => {
    if (indice % 2 === 0) {
      doc.rect(X, y, ANCHO_UTIL, ALTO_FILA_PAGO).fill(COLOR.ceruleanClaro);
    }

    doc
      .fillColor(COLOR.gris)
      .font("Helvetica")
      .fontSize(10)
      .text(pago.etiqueta, X + 12, y + 6, { width: ANCHO_UTIL - 24 });

    doc
      .fillColor(COLOR.ceruleanOscuro)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(pago.valor, X, y + 6, { width: ANCHO_UTIL - 12, align: "right" });

    y += ALTO_FILA_PAGO;
  });

  // Fila del total resaltada con el rojo de marca.
  doc.rect(X, y, ANCHO_UTIL, 34).fill(COLOR.scarlet);
  doc
    .fillColor(COLOR.blanco)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("TOTAL ABONADO", X + 12, y + 10, { width: ANCHO_UTIL - 24 });

  doc
    .fillColor(COLOR.blanco)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(formatoImporte(cobro.total), X, y + 9, {
      width: ANCHO_UTIL - 12,
      align: "right",
    });

  y += 34;

  // --------------------------------------------------------------------
  // Pie de página
  // --------------------------------------------------------------------
  const dibujarPie = () => {
    const yPie = doc.page.height - 72;

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
        "Este documento es un comprobante interno del sistema. No es válido como factura fiscal.",
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
      .text("ParkControl", MARGEN, yPie + 32, {
        width: ANCHO_UTIL,
        align: "center",
      });
  };

  dibujarPie();

  // Numeración de páginas (bufferPages permite recorrerlas al final).
  const rango = doc.bufferedPageRange();

  for (let i = rango.start; i < rango.start + rango.count; i += 1) {
    doc.switchToPage(i);

    if (i > rango.start) dibujarPie();

    doc
      .fillColor(COLOR.gris)
      .font("Helvetica")
      .fontSize(8)
      .text(`Página ${i + 1} de ${rango.count}`, MARGEN, doc.page.height - 30, {
        width: ANCHO_UTIL,
        align: "center",
      });
  }

  return doc;
};

/**
 * Genera el comprobante en PDF del cobro registrado.
 * GET /cobros/:id/comprobante.pdf
 */
export const generarComprobanteCobro = async (req, res) => {
  const { id } = req.params;

  try {
    const cobro = await Cobro.findByPk(id, {
      include: [
        {
          model: Turno_Caja,
          attributes: ["id", "id_usuario"],
          include: [
            {
              model: Usuario,
              attributes: ["nombre", "apellido", "dni", "legajo"],
            },
            { model: Caja, attributes: ["numero_caja", "referencia"] },
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

    if (!cobro) {
      return res
        .status(404)
        .json({ success: false, message: "Cobro no encontrado" });
    }

    // Un cajero sólo puede emitir comprobantes de cobros de sus propios
    // turnos. Supervisor y Sistemas conservan el acceso administrativo.
    if (
      req.user.rol === "CAJERO" &&
      cobro.Turno_Caja?.id_usuario !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Sólo podés acceder a los comprobantes de tus propios cobros",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="comprobante-cobro-${cobro.id}.pdf"`,
    );

    const doc = construirComprobantePdf(cobro);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error al generar comprobante PDF:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: "Error al generar el comprobante" });
    }
  }
};
