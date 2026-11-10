'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('clientes');
    if (!columns.deletedAt) await queryInterface.addColumn('clientes', 'deletedAt', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query('SELECT COUNT(*) AS total FROM clientes WHERE deletedAt IS NOT NULL');
    if (Number(rows[0].total)) throw new Error('No se puede revertir: existen clientes dados de baja');
    await queryInterface.removeColumn('clientes', 'deletedAt');
  },
};
