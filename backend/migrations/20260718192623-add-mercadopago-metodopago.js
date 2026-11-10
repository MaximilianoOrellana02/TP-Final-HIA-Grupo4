'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('historiales', 'metodoPago', {
      type: Sequelize.ENUM('efectivo', 'transferencia', 'mercadopago'),
      allowNull: false,
      defaultValue: 'efectivo',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('historiales', 'metodoPago', {
      type: Sequelize.ENUM('efectivo', 'transferencia'),
      allowNull: false,
      defaultValue: 'efectivo',
    });
  },
};