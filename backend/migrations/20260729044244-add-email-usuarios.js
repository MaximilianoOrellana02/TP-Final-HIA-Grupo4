'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuarios', 'email', {
      type: Sequelize.STRING(150),
      allowNull: true, // arranca opcional para no romper usuarios existentes sin email
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('usuarios', 'email');
  },
};