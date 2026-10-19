import sequelize from "../config/db.js";
import {
  Acarreo,
  Caja,
  Cobro,
  Tarifa,
  Turno_Caja,
  Vehiculo,
} from "../models/index.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import {
  HORAS_POR_ESTADIA,
  MAX_ESTADIAS,
  calcularEstadias,
} from "../utils/estadias.js";

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
