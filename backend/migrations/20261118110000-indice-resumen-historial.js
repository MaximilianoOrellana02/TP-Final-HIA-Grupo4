'use strict';

// El rango por fecha se consulta para sumar importes y cobros por metodo.
// INCLUDE permite leer esos valores del indice cuando el mapa de visibilidad lo permite.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS historiales_fecha_resumen_p5
      ON historiales (fecha) INCLUDE ("importeTotal", "montoPagado", "metodoPago")
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS historiales_fecha_resumen_p5');
  },
};
