'use strict';

// Simplificación: se eliminan las camionetas y su stock. Todo el stock queda en el depósito (productos.stockActual).
// [tabla, columna que apunta a camionetas]
const COLUMNAS = [
  ['historiales', 'camionetaId'],
  ['movimientos_stock', 'camionetaId'],
  ['repartos', 'camionetaId'],
  ['usuarios', 'camionetaActivaId'],
];

// Los nombres de las FK no son todos fijos (la de repartos la generó MySQL), así que se buscan en el catálogo.
async function nombreFk(queryInterface, tabla, columna, transaction) {
  const [filas] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME AS nombre FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla AND COLUMN_NAME = :columna
       AND REFERENCED_TABLE_NAME = 'camionetas'`,
    { replacements: { tabla, columna }, transaction },
  );
  return filas[0]?.nombre ?? null;
}

module.exports = {
  async up(queryInterface) {
    for (const [tabla, columna] of COLUMNAS) {
      const fk = await nombreFk(queryInterface, tabla, columna);
      if (fk) await queryInterface.removeConstraint(tabla, fk);
      await queryInterface.removeColumn(tabla, columna);
    }
    await queryInterface.removeColumn('usuarios', 'camionetaActivaFecha');
    await queryInterface.dropTable('stock_camionetas');
    await queryInterface.dropTable('camionetas');
  },

  // Vuelve a crear las tablas y columnas vacías (los datos de camionetas no se recuperan).
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('camionetas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nombre: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      patente: { type: Sequelize.STRING(15), allowNull: true },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable('stock_camionetas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      camionetaId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'camionetas', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      productoId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'productos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      cantidad: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('stock_camionetas', {
      fields: ['camionetaId', 'productoId'], type: 'unique', name: 'uq_stock_camioneta_producto',
    });

    const fks = [
      ['historiales', 'camionetaId', 'fk_historiales_camioneta', 'RESTRICT'],
      ['movimientos_stock', 'camionetaId', 'fk_movimientos_stock_camioneta', 'RESTRICT'],
      ['repartos', 'camionetaId', 'fk_repartos_camioneta', 'SET NULL'],
      ['usuarios', 'camionetaActivaId', 'fk_usuarios_camioneta_activa', 'SET NULL'],
    ];
    for (const [tabla, columna, nombre, onDelete] of fks) {
      await queryInterface.addColumn(tabla, columna, { type: Sequelize.UUID, allowNull: true });
      await queryInterface.addConstraint(tabla, {
        fields: [columna], type: 'foreign key', name: nombre,
        references: { table: 'camionetas', field: 'id' }, onUpdate: 'CASCADE', onDelete,
      });
    }
    await queryInterface.addColumn('usuarios', 'camionetaActivaFecha', { type: Sequelize.DATEONLY, allowNull: true });
  },
};
