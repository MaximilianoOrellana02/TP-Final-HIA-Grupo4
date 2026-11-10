'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('barrios', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('barrios');
  },
};