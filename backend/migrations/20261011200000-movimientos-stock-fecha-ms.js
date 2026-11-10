'use strict';

// Con precision de segundos, dos movimientos del mismo segundo (una carga de camioneta genera dos)
// empataban y el listado "mas nuevo primero" quedaba en orden arbitrario. Igual que historiales y productos.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE movimientos_stock MODIFY fecha DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE movimientos_stock MODIFY fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  },
};
