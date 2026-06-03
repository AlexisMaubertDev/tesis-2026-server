import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Usuario = sequelize.define(
  "Usuario",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        len: [3, 30],
      },
    },
    apellido: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        len: [3, 30],
      },
    },
    legajo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    dni: {
      type: DataTypes.STRING(8),
      validate: {
        isNumeric: true,
        len: [7, 8],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    rol: {
      type: DataTypes.ENUM(
        "PLAYERO",
        "CAJERO",
        "GRUERO",
        "SUPERVISOR",
        "SISTEMAS",
      ),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    intentos_restantes: {
      type: DataTypes.INTEGER,
      min: 0,
      max: 3,
      defaultValue: 3,
    },
    numero_turno: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 3,
      },
    },
    trabaja_domingo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    bloqueado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    id_sucursal: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "sucursales",
        key: "id",
      },
    },
  },
  {
    tableName: "usuarios",
    timestamps: true,
    createdAt: false,
    updatedAt: false,
    paranoid: true,
  },
);

export default Usuario;
