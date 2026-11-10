'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'barrioId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'barrios', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('clientes', 'categoria', {
      type: Sequelize.ENUM('domicilio', 'restaurante'),
      allowNull: false,
      defaultValue: 'domicilio',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'barrioId');
    await queryInterface.removeColumn('clientes', 'categoria');
  },
};