import crypto from "node:crypto";
import { SyncOperation } from "../models/index.js";

/**
 * Idempotencia de escrituras para la outbox offline.
 *
 * Se aplica después de `authMiddleware` (necesita `req.user`) y antes del
 * controller. Sin header `Idempotency-Key` el comportamiento es el de siempre,
 * así los clientes viejos siguen funcionando.
 *
 * - Primera vez: crea el registro EN_PROCESO y deja pasar.
 * - Reintento con la misma clave y el mismo body:
 *   - COMPLETADA -> repite la respuesta guardada (no vuelve a ejecutar).
 *   - EN_PROCESO -> 409 con `reintentar: true` (la primera sigue corriendo).
 *   - FALLIDA (5xx) o EN_PROCESO vieja -> reintenta la operación.
 * - Misma clave con otro body/ruta -> 409 (clave reutilizada).
 *
 * Si la tabla todavía no existe (por ejemplo, antes de correr la migración en
 * producción), el middleware falla abierto: la API sigue funcionando sin
 * idempotencia y deja un aviso en el log.
 */

const MAX_KEY_LENGTH = 255;
const STALE_MS =
  Number(process.env.IDEMPOTENCY_STALE_MS) || 2 * 60 * 1000;

let tablaDisponible = true;

const esObjeto = (valor) =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor);

// JSON.stringify depende del orden de las claves; el body de un reintento
// debería venir igual, pero ordenarlo evita falsos conflictos.
const stringifyEstable = (valor) => {
  if (Array.isArray(valor)) {
    return `[${valor.map(stringifyEstable).join(",")}]`;
  }
  if (esObjeto(valor)) {
    return `{${Object.keys(valor)
      .sort()
      .map((clave) => `${JSON.stringify(clave)}:${stringifyEstable(valor[clave])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor);
};

const huellaDeRequest = (req) =>
  crypto
    .createHash("sha256")
    .update(
      `${req.method}\n${req.originalUrl}\n${stringifyEstable(req.body ?? {})}`,
    )
    .digest("hex");

const idDeRespuesta = (body) => {
  const data = body?.data;
  if (!esObjeto(data)) return null;
  if (typeof data.id === "string") return data.id;
  if (typeof data.cobro?.id === "string") return data.cobro.id;
  return null;
};

const esTablaAusente = (error) =>
  error?.name === "SequelizeDatabaseError" &&
  /does not exist|doesn't exist|no such table|unknown table|42P01|1146/i.test(
    error.message ?? "",
  );

const responderReplay = (res, registro) => {
  res.set("Idempotent-Replayed", "true");
  return res
    .status(registro.status_code ?? 200)
    .json(
      registro.respuesta ?? {
        success: true,
        message: "La operación ya fue procesada",
      },
    );
};

const responderEnProceso = (res) => {
  res.set("Retry-After", "2");
  return res.status(409).json({
    success: false,
    code: "OPERACION_EN_PROCESO",
    reintentar: true,
    message:
      "La operación con esta Idempotency-Key todavía se está procesando. Reintentá en unos segundos.",
  });
};

const responderClaveReutilizada = (res) =>
  res.status(409).json({
    success: false,
    code: "IDEMPOTENCY_KEY_REUTILIZADA",
    message:
      "La Idempotency-Key ya se usó para otra operación. Generá una clave nueva.",
  });

export const idempotencyMiddleware = async (req, res, next) => {
  const claveCruda = req.headers["idempotency-key"];

  if (claveCruda === undefined) return next();

  if (
    typeof claveCruda !== "string" ||
    claveCruda.trim() === "" ||
    claveCruda.length > MAX_KEY_LENGTH
  ) {
    return res.status(400).json({
      success: false,
      code: "IDEMPOTENCY_KEY_INVALIDA",
      message: `La Idempotency-Key debe ser un texto no vacío de hasta ${MAX_KEY_LENGTH} caracteres.`,
    });
  }

  // Por si el orden de los middlewares cambia en el futuro: sin usuario no hay
  // a quién asociar la operación.
  if (!req.user?.id) return next();

  if (!tablaDisponible) return next();

  const clave = claveCruda.trim();
  const idUsuario = req.user.id;
  const hash = huellaDeRequest(req);
  const datosBase = {
    metodo: req.method,
    ruta: req.originalUrl,
    request_hash: hash,
  };

  const claveCoincide = (registro) =>
    registro.request_hash === hash &&
    registro.metodo === req.method &&
    registro.ruta === req.originalUrl;

  try {
    let registro = await SyncOperation.findOne({
      where: { id_usuario: idUsuario, idempotency_key: clave },
    });

    if (registro) {
      if (!claveCoincide(registro)) return responderClaveReutilizada(res);

      if (registro.estado === "COMPLETADA") {
        return responderReplay(res, registro);
      }

      const enProcesoVencida =
        registro.estado === "EN_PROCESO" &&
        Date.now() - new Date(registro.actualizado_en).getTime() > STALE_MS;

      if (registro.estado === "EN_PROCESO" && !enProcesoVencida) {
        return responderEnProceso(res);
      }

      // FALLIDA (5xx) o EN_PROCESO abandonada: se puede reintentar.
      await registro.update({
        ...datosBase,
        estado: "EN_PROCESO",
        status_code: null,
        respuesta: null,
        id_recurso: null,
        actualizado_en: new Date(),
      });
    } else {
      try {
        registro = await SyncOperation.create({
          id_usuario: idUsuario,
          idempotency_key: clave,
          ...datosBase,
          estado: "EN_PROCESO",
          actualizado_en: new Date(),
        });
      } catch (error) {
        if (error?.name !== "SequelizeUniqueConstraintError") throw error;

        // Dos reintentos simultáneos: el índice único deja ganar a uno.
        registro = await SyncOperation.findOne({
          where: { id_usuario: idUsuario, idempotency_key: clave },
        });

        if (!registro) throw error;
        if (!claveCoincide(registro)) return responderClaveReutilizada(res);
        if (registro.estado === "COMPLETADA") {
          return responderReplay(res, registro);
        }
        return responderEnProceso(res);
      }
    }

    const jsonOriginal = res.json.bind(res);
    let capturado = false;

    res.json = async (body) => {
      // Si un controller responde dos veces, no se pisa el registro.
      if (capturado) return jsonOriginal(body);
      capturado = true;

      const status = res.statusCode;
      const completada = status < 500;

      try {
        await registro.update({
          estado: completada ? "COMPLETADA" : "FALLIDA",
          status_code: status,
          respuesta: completada ? body : null,
          id_recurso: completada ? idDeRespuesta(body) : null,
          actualizado_en: new Date(),
        });
      } catch (error) {
        // La respuesta al cliente no se bloquea por un fallo al guardar el
        // registro; si quedó EN_PROCESO, un reintento lo resuelve por edad.
        console.error(
          "Idempotencia: no se pudo guardar el resultado:",
          error.message,
        );
      }

      return jsonOriginal(body);
    };

    return next();
  } catch (error) {
    if (esTablaAusente(error)) {
      tablaDisponible = false;
      console.warn(
        "Idempotencia deshabilitada: falta la tabla operaciones_sync. " +
          "Ejecutá `npm run db:sync-operaciones`.",
      );
      return next();
    }

    console.error("Idempotencia:", error);
    return next(error);
  }
};

export default idempotencyMiddleware;
