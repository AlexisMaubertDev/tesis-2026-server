import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Turno_Caja = sequelize.define(
  "Turno_Caja",
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
    id_caja: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "cajas",
        key: "id",
      },
    },
    turno: {
      type: DataTypes.ENUM("Mañana", "Tarde", "Noche"),
      allowNull: false,
    },
    apertura: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    cierre: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    total_autos: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_estadias: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_acarreos: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_efectivo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_mp: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    incidencias: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "turno_caja",
    timestamps: false,
  },
);

export default Turno_Caja;
