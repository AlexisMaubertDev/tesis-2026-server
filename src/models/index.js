import Usuario from "./Usuario.model.js";
import Vehiculo from "./Vehiculo.model.js";
import Sucursal from "./Sucursal.model.js";

//Usuario pertenece a una sucursal
Usuario.belongsTo(Sucursal, { foreignKey: "id_sucursal" });
Sucursal.hasMany(Usuario, { foreignKey: "id_sucursal" });

export { Usuario, Vehiculo, Sucursal };
