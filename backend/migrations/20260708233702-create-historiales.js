'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('historiales', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      clienteId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
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
      fecha: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      saldoAnterior: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      importeTotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      montoPagado: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      saldoFinal: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      observacion: { type: Sequelize.STRING(255), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('historiales');
  },
};