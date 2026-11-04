import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

/**
 * Registro de operaciones de escritura idempotentes.
 *
 * El cliente offline guarda cada operación en su outbox con una
 * `Idempotency-Key` (UUID generado en el dispositivo). Si la respuesta se
 * pierde (timeout, red, deploy), el reintento manda la misma clave y el
 * servidor devuelve la respuesta original en vez de duplicar el acarreo, el
 * cobro o el movimiento de caja.
 *
 * `request_hash` es el SHA-256 de método + ruta + body: si la misma clave se
 * reutiliza con otro contenido, se rechaza con 409 en lugar de mezclar dos
 * operaciones distintas.
 */
const SyncOperation = sequelize.define(
  "SyncOperation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    id_usuario: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },

    // UUID (o cualquier identificador) que genera el cliente por operación.
    idempotency_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    metodo: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },

    ruta: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    request_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },

    // EN_PROCESO: la operación se está ejecutando.
    // COMPLETADA: ya hay una respuesta (éxito o error de negocio) para repetir.
    // FALLIDA: error 5xx; el mismo key puede reintentarse.
    estado: {
      type: DataTypes.ENUM("EN_PROCESO", "COMPLETADA", "FALLIDA"),
      allowNull: false,
      defaultValue: "EN_PROCESO",
    },

    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    respuesta: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // Id del recurso creado/modificado, para poder correlacionar la outbox
    // local con el registro del servidor sin parsear la respuesta.
    id_recurso: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    actualizado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "operaciones_sync",
    timestamps: false,
    indexes: [
      {
        name: "ux_operaciones_sync_usuario_key",
        unique: true,
        fields: ["id_usuario", "idempotency_key"],
      },
      {
        name: "ix_operaciones_sync_estado_fecha",
        fields: ["estado", "actualizado_en"],
      },
    ],
  },
);

export default SyncOperation;
