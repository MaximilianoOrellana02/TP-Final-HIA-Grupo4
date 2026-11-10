'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
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
      detalle: { type: Sequelize.STRING(255), allowNull: false },
      estado: { type: Sequelize.ENUM('pendiente', 'entregado'), allowNull: false, defaultValue: 'pendiente' },
      fecha: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('pedidos');
  },
};