import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Vehiculo = sequelize.define(
  "Vehiculo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    patente: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // estado: {
    //   type: DataTypes.ENUM(
    //     "ACARREADO",
    //     "INGRESADO",
    //     "EGRESADO",
    //     "COBRADO",
    //     "SIN_CARGO",
    //   ),
    //   allowNull: false,
    // },
    marca: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    modelo: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
   
  },
  {
    tableName: "vehiculos",
    timestamps: false,
  },
);

export default Vehiculo;
