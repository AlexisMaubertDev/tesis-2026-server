import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

/**
 * Tarifa vigente de la playa: el importe del acarreo y el de cada estadía.
 * Sólo hay una vigente a la vez: al configurar una nueva, la anterior se
 * cierra con `vigente_hasta` (ver `crearTarifa`).
 */
const Tarifa = sequelize.define(
  "Tarifa",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    acarreo: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    estadia: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    vigente: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    vigente_desde: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    vigente_hasta: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tarifas",
    timestamps: false,
  },
);

export default Tarifa;
