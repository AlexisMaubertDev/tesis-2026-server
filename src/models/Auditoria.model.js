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

    // Las acciones tienen que estar todas listadas acá: en Postgres un ENUM es
    // estricto y rechaza cualquier valor que no exista en el tipo. En MySQL,
    // con el modo no estricto, un valor desconocido se guardaba como cadena
    // vacía sin dar error, así que el problema recién se notó al migrar.
    accion: {
      type: DataTypes.ENUM(
        "CREAR",
        "EDITAR",
        "ACTUALIZAR",
        "ELIMINAR",
        "LOGIN",
        "LOGOUT",
        "INICIAR_TURNO",
        "FINALIZAR_TURNO",
        "ASIGNAR",
        "DESASIGNAR",
        "CAMBIAR_ESTADO",
        "REGISTRAR_COBRO",
        "INGRESAR_A_PLAYA",
        "EGRESAR_DE_PLAYA",
        "SALIDA_SIN_CARGO",
        "ASIGNAR_TURNO_BARRERA",
        "FINALIZAR_TURNO_BARRERA",
        "FINALIZAR_TODOS_TURNOS_BARRERA",
        "AGREGAR_INCIDENCIA_ACARREO",
        "AGREGAR_INCIDENCIA_BARRERA",
        "AGREGAR_INCIDENCIA_TURNO_CAJA",
        "BLOQUEAR_USUARIO",
        "DESBLOQUEAR_USUARIO",
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
