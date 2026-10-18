import sequelize from "../config/db.js";
import { Tarifa } from "../models/index.js";
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

// Devuelve la tarifa vigente de la playa (histórico: `GET /tarifas`).
export const obtenerTarifaVigente = async (req, res) => {
  try {
    const tarifa = await Tarifa.findOne({
      where: { vigente: true },
      order: [["vigente_desde", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: tarifa,
      message: tarifa
        ? "Tarifa vigente obtenida exitosamente"
        : "No hay una tarifa vigente configurada",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

// Historial completo de tarifas (la vigente primero).
export const obtenerTarifas = async (req, res) => {
  try {
    const tarifas = await Tarifa.findAll({
      order: [
        ["vigente_desde", "DESC"],
        ["vigente", "DESC"],
      ],
    });

    return res.status(200).json({
      success: true,
      data: tarifas,
      message: "Tarifas obtenidas exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

/**
 * Configura una nueva tarifa (CU20, rol Sistemas).
 *
 * Cierra la tarifa vigente (`vigente: false` y `vigente_hasta: ahora`) y crea
 * la nueva con `vigente: true` y `vigente_desde: ahora`.
 */
export const crearTarifa = async (req, res) => {
  const { acarreo, estadia } = req.body;

  if (!esImporteValido(acarreo) || !esImporteValido(estadia)) {
    return res.status(400).json({
      success: false,
      message: "Las tarifas deben ser números mayores o iguales a cero",
    });
  }

  const nuevoAcarreo = aImporte(acarreo);
  const nuevaEstadia = aImporte(estadia);

  let transaction;

  try {
    transaction = await sequelize.transaction();

    const vigente = await Tarifa.findOne({
      where: { vigente: true },
      order: [["vigente_desde", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // CU20 (flujo alternativo 2.1): las tarifas nuevas deben superar a las
    // actuales.
    if (
      vigente &&
      (nuevoAcarreo < aImporte(vigente.acarreo) ||
        nuevaEstadia < aImporte(vigente.estadia))
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Las tarifas nuevas deben ser mayores a las actuales",
      });
    }

    const ahora = new Date();

    if (vigente) {
      await vigente.update(
        { vigente: false, vigente_hasta: ahora },
        { transaction },
      );
    }

    const tarifa = await Tarifa.create(
      {
        acarreo: nuevoAcarreo,
        estadia: nuevaEstadia,
        vigente: true,
        vigente_desde: ahora,
        vigente_hasta: null,
      },
      { transaction },
    );

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "CREAR",
      entidad: "TARIFA",
      idEntidad: tarifa.id,
      descripcion: `Configuró la tarifa de acarreo $${nuevoAcarreo} y estadía $${nuevaEstadia}`,
      antes: vigente
        ? {
            acarreo: aImporte(vigente.acarreo),
            estadia: aImporte(vigente.estadia),
          }
        : null,
      despues: { acarreo: nuevoAcarreo, estadia: nuevaEstadia },
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      data: tarifa,
      message: "Tarifa creada exitosamente",
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
