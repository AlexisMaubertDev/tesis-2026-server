import { Caja, Turno_Caja, Turno_Grua, Turno_Barrera, Turno_Barrera_Usuario, Usuario } from "../models/index.js";
import Sucursal from "../models/Sucursal.model.js";
import bcrypt from "bcrypt";
import { crearEntidad } from "../utils/crearEntidad.js";
import sequelize from "../config/db.js";
import { registrarAuditoria } from "../utils/auditoria.js";

export const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: {
        exclude: ["password", "id_sucursal", "id"],
      },
      include: [
        { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
        // Turno de caja abierto del usuario (si tiene), con su caja y sucursal:
        // lo usa el "Ver detalle" de la tabla de usuarios.
        {
          model: Turno_Caja,
          as: "turno_caja_activo",
          required: false,
          include: [
            {
              model: Caja,
              attributes: ["id", "numero_caja", "referencia"],
              include: [{ model: Sucursal, attributes: ["id", "nombre"] }],
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: usuarios,
      message: "Usuarios obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};
export const obtenerGrueros = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: {
        exclude: ["password", "id_sucursal", "intentos_restantes"],
      },
      include: [
        {
          model: Sucursal,
          attributes: ["nombre"],
        },
        {
          model: Turno_Grua,
          as: "turno_grua_chofer_activo",
          required: false,
        },
        {
          model: Turno_Grua,
          as: "turno_grua_enganchador_activo",
          required: false,
        },
      ],
      where: {
        rol: "GRUERO",
      },
      order: [["legajo", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: usuarios,
      message: "Usuarios obtenidos exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const crearUsuario = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      legajo,
      dni,
      numero_turno,
      trabaja_domingo,
      email,
      rol,
      password,
      Sucursal,
    } = req.body;

    if (
      !nombre ||
      !apellido ||
      !legajo ||
      !dni ||
      !numero_turno ||
      !rol ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
    }

    if (await Usuario.findOne({ where: { legajo } })) {
      return res.status(400).json({
        success: false,
        message: "El legajo ingresado ya corresponde a otro usuario",
      });
    }

    if (email && (await Usuario.findOne({ where: { email } }))) {
      return res.status(400).json({
        success: false,
        message: "El email ingresado ya corresponde a otro usuario",
      });
    }

    if (await Usuario.findOne({ where: { dni } })) {
      return res.status(400).json({
        success: false,
        message: "El DNI ingresado ya corresponde a otro usuario",
      });
    }

    //encripta la contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const usuario = await Usuario.create({
      nombre,
      apellido,
      legajo,
      numero_turno,
      dni,
      trabaja_domingo,
      email,
      rol,
      password: hashedPassword,
      id_sucursal: Sucursal.id,
    });

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "CREAR",
      entidad: "USUARIO",
      idEntidad: usuario.id,
      descripcion: `Creó el usuario ${usuario.nombre} ${usuario.apellido}`,
      despues: usuario,
    });

    return res.status(201).json({
      success: true,
      data: usuario,
      message: "Usuario creado exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const editarUsuario = async (req, res) => {
  try {
    const { legajo } = req.params;
    const {
      nombre,
      apellido,
      dni,
      numero_turno,
      trabaja_domingo,
      email,
      rol,
      password,
      Sucursal,
    } = req.body;

    const usuario = await Usuario.findOne({ where: { legajo } });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: "El legajo ingresado no corresponde a ningún usuario",
      });
    }

    if (
      dni &&
      dni !== usuario.dni &&
      (await Usuario.findOne({ where: { dni } }))
    ) {
      return res.status(400).json({
        success: false,
        message: "El DNI ingresado ya corresponde a otro usuario",
      });
    }

    if (
      email &&
      email !== usuario.email &&
      (await Usuario.findOne({ where: { email } }))
    ) {
      return res.status(400).json({
        success: false,
        message: "El email ingresado ya corresponde a otro usuario",
      });
    }

    // Sólo se actualizan los campos presentes en el body (edición parcial).
    const datos = {};
    if (nombre !== undefined) datos.nombre = nombre;
    if (apellido !== undefined) datos.apellido = apellido;
    if (dni !== undefined) datos.dni = dni;
    if (numero_turno !== undefined) datos.numero_turno = numero_turno;
    if (trabaja_domingo !== undefined) datos.trabaja_domingo = trabaja_domingo;
    if (email !== undefined) datos.email = email;
    if (rol !== undefined) datos.rol = rol;
    if (Sucursal && Sucursal.id) datos.id_sucursal = Sucursal.id;

    // La contraseña es opcional: si no viene, se conserva la actual.
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      datos.password = await bcrypt.hash(password, salt);
    }

    const antes = usuario.toJSON();

    await usuario.update(datos);

    await registrarAuditoria({
      req,
      usuario: req.user,
      accion: "EDITAR",
      entidad: "USUARIO",
      idEntidad: usuario.id,
      descripcion: `Editó el usuario ${usuario.nombre} ${usuario.apellido}`,
      antes,
      despues: usuario,
    });

    const usuarioActualizado = usuario.toJSON();
    delete usuarioActualizado.password;

    return res.status(200).json({
      success: true,
      data: usuarioActualizado,
      message: "Usuario actualizado exitosamente",
    });
  } catch (err) {
    console.log(err);

    if (
      err.name === "SequelizeValidationError" ||
      err.name === "SequelizeUniqueConstraintError"
    ) {
      return res.status(400).json({
        success: false,
        message: err.errors?.[0]?.message || "Datos inválidos",
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const eliminarUsuario = async (req, res) => {
  try {
    const { legajo } = req.params;
    const usuario = await Usuario.findOne({ where: { legajo } });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: "El legajo ingresado no corresponde a ningún usuario",
      });
    }

    await usuario.destroy();

    return res.status(200).json({
      success: true,
      message: "Usuario eliminado exitosamente",
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Error en el servidor" });
  }
};

export const obtenerPlayeros = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: {
        exclude: ["password", "id_sucursal", "intentos_restantes"],
      },
      where: { rol: "PLAYERO" },
      include: [
        { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
        {
          model: Turno_Barrera_Usuario,
          as: "turnos_barrera",
          required: false,
          include: [{ model: Turno_Barrera, required: false }],
        },
      ],
      order: [["legajo", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: usuarios,
      message: "Playeros obtenidos exitosamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};
