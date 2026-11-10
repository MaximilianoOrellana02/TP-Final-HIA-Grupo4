'use strict';

// Indicaciones para el repartidor: una nota libre ("Timbre blanco lateral, perro en el patio")
// y una referencia corta del lugar ("Portón negro").
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'notaRepartidor', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('clientes', 'referencia', {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'referencia');
    await queryInterface.removeColumn('clientes', 'notaRepartidor');
  },
};
