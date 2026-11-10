'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'latitud', {
      type: Sequelize.DECIMAL(10, 7),
      allowNull: true,
    });
    await queryInterface.addColumn('clientes', 'longitud', {
      type: Sequelize.DECIMAL(10, 7),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'latitud');
    await queryInterface.removeColumn('clientes', 'longitud');
  },
};