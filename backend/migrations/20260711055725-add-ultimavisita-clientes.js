'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'ultimaVisitaFecha', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'ultimaVisitaFecha');
  },
};