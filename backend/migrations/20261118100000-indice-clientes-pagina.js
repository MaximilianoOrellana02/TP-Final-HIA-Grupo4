'use strict';

// Sirve al listado paginado de clientes activos, ordenado por apellido, nombre e id.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS clientes_activos_apellido_nombre_id
      ON clientes (apellido, nombre, id)
      WHERE "deletedAt" IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS clientes_activos_apellido_nombre_id');
  },
};
