'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clientes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      apellido: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      direccion: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      telefono: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      localidad: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      saldoActual: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tipoCliente: {
        type: Sequelize.ENUM('particular', 'confianza'),
        allowNull: false,
        defaultValue: 'particular',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('clientes');
  },
};