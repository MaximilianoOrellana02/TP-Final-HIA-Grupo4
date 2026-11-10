'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('productos', 'stockActual', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('productos', 'stockMinimo', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('productos', 'stockActual');
    await queryInterface.removeColumn('productos', 'stockMinimo');
  },
};