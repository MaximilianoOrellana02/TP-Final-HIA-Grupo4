'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('historiales');
    if (!columns.ajusteSaldo) {
      await queryInterface.addColumn('historiales', 'ajusteSaldo', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },
  async down(queryInterface) {
    const columns = await queryInterface.describeTable('historiales');
    if (columns.ajusteSaldo) await queryInterface.removeColumn('historiales', 'ajusteSaldo');
  },
};
