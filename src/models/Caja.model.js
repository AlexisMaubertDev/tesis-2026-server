import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Caja = sequelize.define(
  "Caja",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_sucursal: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    numero_caja: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    referencia: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    referencia_pago: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "cajas",
    timestamps: false,
  },
);

export default Caja;
