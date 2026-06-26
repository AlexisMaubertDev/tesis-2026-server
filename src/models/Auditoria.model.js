import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Auditoria = sequelize.define(
  "Auditoria",
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

    entidad: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    id_entidad: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    accion: {
      type: DataTypes.ENUM(
        "CREAR",
        "EDITAR",
        "ELIMINAR",
        "LOGIN",
        "LOGOUT",
        "INICIAR_TURNO",
        "FINALIZAR_TURNO",
        "ASIGNAR",
        "DESASIGNAR",
        "OTRO",
      ),
      allowNull: false,
    },

    descripcion: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },

    datos_anteriores: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    datos_nuevos: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    ip: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    user_agent: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },

    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "auditorias",
    timestamps: false,
  },
);

export default Auditoria;
