import sequelize from "../src/config/db.js";
import { Acarreo, Vehiculo, Sucursal, Turno_Barrera, Barrera, Usuario, Turno_Grua, Grua } from "../src/models/index.js";
import { randomUUID } from "crypto";

async function main() {
  try {
    await sequelize.authenticate();
    console.log("DB OK");

    const sucursales = await Sucursal.findAll({ limit: 5 });
    const sucursal = sucursales[0];
    if (!sucursal) throw new Error("No hay sucursales");

    const placas = ["TEST001", "TEST002"];
    const vehiculos = [];
    for (const p of placas) {
      let v = await Vehiculo.findOne({ where: { patente: p } });
      if (!v) {
        v = await Vehiculo.create({
          patente: p,
          marca: "TEST",
          modelo: "PRUEBA",
          color: "BLANCO",
          id_sucursal: sucursal.id,
        });
        console.log("Creado vehículo", p);
      }
      vehiculos.push(v);
    }

    let turnoGrua = await Turno_Grua.findOne({ where: { activo: true } });
    if (!turnoGrua) {
      let grua = await Grua.findOne({ where: { id_sucursal: sucursal.id } });
      if (!grua) {
        grua = await Grua.create({ numero: 999, patente: "TESTGR", modelo: "TEST", id_sucursal: sucursal.id });
      }
      let usuario = await Usuario.findOne({ where: { rol: "GRUERO" } });
      if (!usuario) usuario = await Usuario.findOne({ limit: 1 });
      turnoGrua = await Turno_Grua.create({
        id_grua: grua.id,
        id_chofer: usuario?.id || null,
        id_enganchador: usuario?.id || null,
        id_supervisor: null,
        turno: "MAÑANA",
        fecha_inicio: new Date(),
        activo: true,
      });
      console.log("Creado turno grúa de prueba");
    }

    let turnoBarrera = await Turno_Barrera.findOne({ where: { activo: true } });
    if (!turnoBarrera) {
      let barrera = await Barrera.findOne({ where: { id_sucursal: sucursal.id } });
      if (!barrera) {
        barrera = await Barrera.create({ ubicacion: "TEST-BARRERA", id_sucursal: sucursal.id });
      }
      let usuario = await Usuario.findOne({ where: { rol: "PLAYERO" } });
      if (!usuario) usuario = await Usuario.findOne({ limit: 1 });
      turnoBarrera = await Turno_Barrera.create({
        id_barrera: barrera.id,
        id_usuario: usuario?.id || null,
        turno: "MAÑANA",
        fecha_inicio: new Date(),
        activo: true,
      });
      console.log("Creado turno barrera de prueba");
    }

    const ahora = new Date();
    for (let i = 0; i < vehiculos.length; i++) {
      const v = vehiculos[i];
      const fecha = new Date(ahora.getTime() - (i + 1) * 30 * 60 * 1000);
      const acarreo = await Acarreo.create({
        id: randomUUID(),
        id_vehiculo: v.id,
        id_turno_grua: turnoGrua.id,
        id_turno_barrera: turnoBarrera.id,
        fecha_acarreo: fecha,
        direccion: `Calle Prueba ${i + 100}`,
        motivo: "PRUEBA - COBRO PDF",
        estado: "INGRESADO",
        id_cobro: null,
        fue_denuncia: false,
        tuvo_siniestro: false,
      });
      console.log("Creado acarreo INGRESADO:", acarreo.id, "patente", v.patente);
    }

    console.log("LISTO");
    process.exit(0);
  } catch (e) {
    console.error("ERR", e);
    process.exit(1);
  }
}

main();
