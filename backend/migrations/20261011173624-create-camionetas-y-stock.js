'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('camionetas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nombre: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      patente: { type: Sequelize.STRING(15), allowNull: true },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('stock_camionetas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      camionetaId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'camionetas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      productoId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Una sola fila por (camioneta, producto): evita saldos duplicados
    await queryInterface.addConstraint('stock_camionetas', {
      fields: ['camionetaId', 'productoId'],
      type: 'unique',
      name: 'uq_stock_camioneta_producto',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_camionetas');
    await queryInterface.dropTable('camionetas');
  },
};