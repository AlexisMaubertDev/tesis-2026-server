import Usuario from "./Usuario.model.js";
import Vehiculo from "./Vehiculo.model.js";

//Playero que ingresa el vehiculo
Usuario.hasMany(Vehiculo, {
  foreignKey: "playero_ingreso_id",
});
Vehiculo.belongsTo(Usuario, {
  foreignKey: "playero_ingreso_id",
});

//Playero que egresa el vehiculo
Usuario.hasMany(Vehiculo, {
  foreignKey: "playero_egreso_id",
});
Vehiculo.belongsTo(Usuario, {
  foreignKey: "playero_egreso_id",
});

export { Usuario, Vehiculo };
