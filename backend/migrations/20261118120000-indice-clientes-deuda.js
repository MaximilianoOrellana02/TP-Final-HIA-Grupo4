'use strict';

// Solo clientes activos con deuda: lo usan la pantalla y el informe de deuda vieja.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS clientes_deuda_activos_p5
      ON clientes (id) INCLUDE (nombre, apellido, "saldoActual")
      WHERE "deletedAt" IS NULL AND "saldoActual" > 0
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS clientes_deuda_activos_p5');
  },
};
