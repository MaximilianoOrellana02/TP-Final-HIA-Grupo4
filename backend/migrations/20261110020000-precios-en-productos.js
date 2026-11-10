'use strict';

// Simplificación: cada producto guarda directamente su precio actual para cada tipo de cliente.
// Se copia el último precio cargado de precios_producto y se elimina esa tabla (se pierde el historial de precios).
const COLUMNAS = [
  ['precioParticular', 'particular'],
  ['precioConfianza', 'confianza'],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [columna] of COLUMNAS) {
      await queryInterface.addColumn('productos', columna, {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0,
      });
    }
    // Mismo criterio de "precio vigente" que usaba la API: el más nuevo por fechaDesde, createdAt e id.
    for (const [columna, tipo] of COLUMNAS) {
      await queryInterface.sequelize.query(
        `UPDATE productos p SET ${columna} = COALESCE((
           SELECT pp.precio FROM precios_producto pp
           WHERE pp.productoId = p.id AND pp.tipoCliente = :tipo
           ORDER BY pp.fechaDesde DESC, pp.createdAt DESC, pp.id DESC LIMIT 1
         ), 0)`,
        { replacements: { tipo } },
      );
    }
    await queryInterface.dropTable('precios_producto');
  },

  // Vuelve a crear precios_producto con un precio por tipo (el actual de cada producto) y quita las columnas.
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('precios_producto', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      productoId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'productos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      tipoCliente: { type: Sequelize.ENUM('particular', 'confianza'), allowNull: false },
      precio: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      fechaDesde: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)') },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('precios_producto', ['productoId', 'tipoCliente', 'fechaDesde'], {
      name: 'precios_producto_producto_tipo_fecha',
    });
    for (const [columna, tipo] of COLUMNAS) {
      await queryInterface.sequelize.query(
        `INSERT INTO precios_producto (id, productoId, tipoCliente, precio, createdAt, updatedAt)
         SELECT UUID(), id, :tipo, ${columna}, NOW(), NOW() FROM productos WHERE ${columna} > 0`,
        { replacements: { tipo } },
      );
      await queryInterface.removeColumn('productos', columna);
    }
  },
};
