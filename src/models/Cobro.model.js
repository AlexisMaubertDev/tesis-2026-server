import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Cobro = sequelize.define(
  "Cobro",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_turno_caja: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "turno_caja",
        key: "id",
      },
    },
    id_acarreo: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "acarreos",
        key: "id",
      },
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    efectivo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    mp: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    estadias: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    numero_factura: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "cobros",
    timestamps: false,
  },
);

export default Cobro;
