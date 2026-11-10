'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('movimientos_stock', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      productoId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      usuarioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipo: { type: Sequelize.ENUM('entrada', 'salida'), allowNull: false },
      cantidad: { type: Sequelize.INTEGER, allowNull: false },
      motivo: { type: Sequelize.STRING(255), allowNull: true },
      fecha: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('movimientos_stock');
  },
};