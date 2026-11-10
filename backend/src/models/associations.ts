import Producto from "./Producto";
import Cliente from "./Cliente";
import Usuario from "./Usuario";
import SaldoEnvase from "./SaldoEnvase";
import Historial from "./Historial";
import HistorialDetalle from "./HistorialDetalle";
import Barrio from "./Barrio";
import MovimientoStock from "./MovimientoStock";
import Reparto from "./Reparto";

// Cliente <-> SaldoEnvase <-> Producto
Cliente.hasMany(SaldoEnvase, { foreignKey: "clienteId", as: "saldosEnvase" });
SaldoEnvase.belongsTo(Cliente, { foreignKey: "clienteId", as: "cliente" });
Producto.hasMany(SaldoEnvase, { foreignKey: "productoId", as: "saldosEnvase" });
SaldoEnvase.belongsTo(Producto, { foreignKey: "productoId", as: "producto" });

// Cliente <-> Historial <-> Usuario
Cliente.hasMany(Historial, { foreignKey: "clienteId", as: "historiales" });
Historial.belongsTo(Cliente, { foreignKey: "clienteId", as: "cliente" });
Usuario.hasMany(Historial, { foreignKey: "usuarioId", as: "historiales" });
Historial.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

// Historial <-> HistorialDetalle <-> Producto
Historial.hasMany(HistorialDetalle, {
  foreignKey: "historialId",
  as: "detalles",
});
HistorialDetalle.belongsTo(Historial, {
  foreignKey: "historialId",
  as: "historial",
});
Producto.hasMany(HistorialDetalle, {
  foreignKey: "productoId",
  as: "detallesHistorial",
});
HistorialDetalle.belongsTo(Producto, {
  foreignKey: "productoId",
  as: "producto",
});

Producto.hasMany(MovimientoStock, {
  foreignKey: "productoId",
  as: "movimientosStock",
});
MovimientoStock.belongsTo(Producto, {
  foreignKey: "productoId",
  as: "producto",
});
Usuario.hasMany(MovimientoStock, {
  foreignKey: "usuarioId",
  as: "movimientosStock",
});
MovimientoStock.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

// Cliente <-> Barrio
Barrio.hasMany(Cliente, {
  foreignKey: "barrioId",
  as: "clientes",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});
Cliente.belongsTo(Barrio, {
  foreignKey: "barrioId",
  as: "barrio",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

// Reparto del día <-> Usuario
Usuario.hasMany(Reparto, { foreignKey: "usuarioId", as: "repartos" });
Reparto.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

