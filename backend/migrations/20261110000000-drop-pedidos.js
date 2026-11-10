'use strict';

// Simplificación: se elimina el módulo de pedidos. Las entregas (historiales) no dependen de esta tabla.
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('pedidos');
  },
  // Vuelve a crear la tabla vacía, con la misma estructura que tenía tras las migraciones anteriores.
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('pedidos', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      clienteId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'clientes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      usuarioId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'usuarios', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      detalle: { type: Sequelize.STRING(255), allowNull: true },
      estado: { type: Sequelize.ENUM('pendiente', 'entregado'), allowNull: false, defaultValue: 'pendiente' },
      fecha: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('pedidos', ['estado', 'fecha'], { name: 'pedidos_estado_fecha' });
  },
};
