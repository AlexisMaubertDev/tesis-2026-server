import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Turno_Grua = sequelize.define(
  "Turno_Grua",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_grua: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "gruas",
        key: "id",
      },
    },
    id_chofer: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    id_enganchador: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    id_supervisor: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    turno: {
      type: DataTypes.ENUM("Mañana", "Tarde", "Noche"),
      allowNull: false,
    },
    nombre_agente: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    numero_agente: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    incidencias: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "turno_grua",
    timestamps: false,
  },
);

export default Turno_Grua;
