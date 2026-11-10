'use strict';

// Los usuarios existentes quedaron como 'admin' al agregar la columna; los nuevos son repartidores salvo que
// un admin indique otra cosa al registrarlos.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('usuarios', 'rol', {
      type: Sequelize.ENUM('admin', 'repartidor'),
      allowNull: false,
      defaultValue: 'repartidor',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('usuarios', 'rol', {
      type: Sequelize.ENUM('admin', 'repartidor'),
      allowNull: false,
      defaultValue: 'admin',
    });
  },
};
