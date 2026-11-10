'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('precios_producto', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      productoId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'productos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipoCliente: {
        type: Sequelize.ENUM('particular', 'confianza'),
        allowNull: false,
      },
      precio: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      fechaDesde: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('precios_producto');
  },
};