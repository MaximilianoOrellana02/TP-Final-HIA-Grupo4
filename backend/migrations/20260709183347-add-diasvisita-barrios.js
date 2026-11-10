'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('barrios', 'diasVisita', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('barrios', 'diasVisita');
  },
};