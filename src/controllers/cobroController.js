import sequelize from "../config/db.js";
import { Acarreo, Cobro, Turno_Caja, Vehiculo } from "../models/index.js";
import { registrarAuditoria } from "../utils/auditoria.js";

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
 * Registra el cobro de un vehículo ingresado en la playa (cajero).
 *
 * Verifica el turno de caja abierto del usuario, que el acarreo esté
 * INGRESADO y que los importes sean coherentes; luego crea el `Cobro`, pasa el
 * acarreo a COBRADO y lo vincula (`id_cobro`).
 */
export const crearCobro = async (req, res) => {
  const { id_acarreo, estadias, total, efectivo, mp, numero_factura } = req.body;

  if (!id_acarreo) {
    return res
      .status(400)
      .json({ success: false, message: "Falta el acarreo a cobrar" });
  }

  if (![total, efectivo, mp].every(esImporteValido)) {
    return res.status(400).json({
      success: false,
      message: "Los importes deben ser números mayores o iguales a cero",
    });
  }

  const totalNum = aImporte(total);
  const efectivoNum = aImporte(efectivo);
  const mpNum = aImporte(mp);

  if (totalNum <= 0) {
    return res.status(400).json({
      success: false,
      message: "El total del cobro debe ser mayor a cero",
    });
  }

  if (aImporte(efectivoNum + mpNum) !== totalNum) {
    return res.status(400).json({
      success: false,
      message:
        "El total debe coincidir con la suma de efectivo y Mercado Pago",
    });
  }

  if (
    estadias !== undefined &&
    estadias !== null &&
    estadias !== "" &&
    (!Number.isInteger(Number(estadias)) || Number(estadias) < 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Las estadías deben ser un número entero mayor o igual a cero",
    });
  }

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

    const acarreo = await Acarreo.findByPk(id_acarreo, {
      include: [{ model: Vehiculo }],
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

    const cobro = await Cobro.create(
      {
        id_turno_caja: turnoCaja.id,
        id_acarreo: acarreo.id,
        total: totalNum,
        efectivo: efectivoNum,
        mp: mpNum,
        fecha: new Date(),
        estadias:
          estadias === undefined || estadias === null || estadias === ""
            ? null
            : Number(estadias),
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
