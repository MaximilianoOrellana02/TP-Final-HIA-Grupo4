'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('historial_detalles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      historialId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'historiales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // si se borra la cabecera, se borran sus detalles
      },
      productoId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidadEntregada: { type: Sequelize.INTEGER, allowNull: false },
      cantidadEnvaseDevuelto: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      precioUnitario: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      importe: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('historial_detalles');
  },
};