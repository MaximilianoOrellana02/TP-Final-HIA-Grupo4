'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('historiales', 'metodoPago', {
      type: Sequelize.ENUM('efectivo', 'transferencia'),
      allowNull: false,
      defaultValue: 'efectivo',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('historiales', 'metodoPago');
  },
};