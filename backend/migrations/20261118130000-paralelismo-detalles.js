'use strict';

// Permite hasta cuatro trabajadores al recorrer detalles para el resumen.
// La consulta decide el limite con SET LOCAL; las demas conservan el suyo.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE historial_detalles SET (parallel_workers = 4)');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE historial_detalles RESET (parallel_workers)');
  },
};
