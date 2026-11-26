import { Op } from "sequelize";
import { Auditoria, Usuario } from "../models/index.js";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Las fechas del filtro llegan como `AAAA-MM-DD` (las de un <input type="date">)
// y representan días del usuario en Argentina. Se construyen con el offset
// -03:00 para que el rango no se corra cuando el server corre en UTC (Vercel).
const parseFecha = (valor, finDelDia) => {
  if (!FORMATO_FECHA.test(String(valor ?? ""))) return null;

  const fecha = new Date(
    `${valor}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}-03:00`,
  );

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * GET /api/auditorias — listado de auditorías del sistema.
 *
 * Sólo accesible para el rol SISTEMAS. Devuelve los registros paginados y con
 * el usuario que realizó cada acción (`Usuario`), para poder mostrar el
 * nombre en la tabla. Acepta los filtros:
 *   - desde / hasta: fechas `AAAA-MM-DD` (inclusive)
 *   - accion: una de las acciones del ENUM del modelo
 *   - entidad: nombre del modelo auditado (VEHICULO, USUARIO, etc.)
 *   - usuario: texto a buscar en nombre o apellido
 *   - page / limit: paginación (limit por defecto 20, máximo 100)
 *
 * También devuelve las acciones y entidades disponibles para poblar los
 * selects del front.
 */
export const obtenerAuditorias = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      accion,
      entidad,
      usuario,
      page,
      limit,
    } = req.query;

    const where = {};

    if (desde || hasta) {
      const fechaDesde = desde ? parseFecha(desde, false) : null;
      const fechaHasta = hasta ? parseFecha(hasta, true) : null;

      if ((desde && !fechaDesde) || (hasta && !fechaHasta)) {
        return res.status(400).json({
          success: false,
          message: "Las fechas deben tener el formato AAAA-MM-DD",
        });
      }

      if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
        return res.status(400).json({
          success: false,
          message: "La fecha 'desde' no puede ser posterior a 'hasta'",
        });
      }

      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }

    const accionesValidas = Auditoria.rawAttributes.accion.values;

    if (accion) {
      if (!accionesValidas.includes(accion)) {
        return res.status(400).json({
          success: false,
          message: "La acción indicada no es válida",
        });
      }
      where.accion = accion;
    }

    if (entidad) {
      where.entidad = entidad;
    }

    // Búsqueda por nombre o apellido del usuario que hizo la acción. Se usa
    // iLike (Postgres) para que no importen mayúsculas ni acentos parciales.
    const textoUsuario = String(usuario ?? "").trim();
    const whereUsuario = textoUsuario
      ? {
          [Op.or]: [
            { nombre: { [Op.iLike]: `%${textoUsuario}%` } },
            { apellido: { [Op.iLike]: `%${textoUsuario}%` } },
          ],
        }
      : null;

    const pagina = Math.max(1, Number.parseInt(page, 10) || 1);
    const limite = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );

    const { count, rows } = await Auditoria.findAndCountAll({
      where,
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "legajo", "rol"],
          required: Boolean(whereUsuario),
          ...(whereUsuario ? { where: whereUsuario } : {}),
        },
      ],
      order: [["fecha", "DESC"]],
      limit: limite,
      offset: (pagina - 1) * limite,
      // Sin `subQuery`, el filtro por nombre de usuario se aplica en el JOIN
      // antes del LIMIT. Con la subquery por defecto, Sequelize limita primero
      // las auditorías y recién después filtra por usuario, devolviendo páginas
      // incompletas. Acá el JOIN es 1 a 1 (belongsTo), así que no duplica filas.
      subQuery: false,
      // `distinct` evita que el count se infle si en el futuro se agrega otro
      // include que duplique filas.
      distinct: true,
    });

    const entidades = await Auditoria.findAll({
      attributes: ["entidad"],
      group: ["entidad"],
      order: [["entidad", "ASC"]],
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      total: count,
      pagina,
      limite,
      paginas: Math.max(1, Math.ceil(count / limite)),
      filtros: {
        acciones: accionesValidas,
        entidades: entidades.map((fila) => fila.entidad).filter(Boolean),
      },
      message: "Auditorías obtenidas exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
