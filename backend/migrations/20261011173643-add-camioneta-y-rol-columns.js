'use strict';

// [tabla, columna, nombre de la FK, qué pasa al borrar la camioneta]
const COLUMNAS_FK = [
  ['movimientos_stock', 'camionetaId', 'fk_movimientos_stock_camioneta', 'RESTRICT'],
  ['historiales', 'camionetaId', 'fk_historiales_camioneta', 'RESTRICT'],
  ['usuarios', 'camionetaActivaId', 'fk_usuarios_camioneta_activa', 'SET NULL'],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [tabla, columna, nombreFk, onDelete] of COLUMNAS_FK) {
      await queryInterface.addColumn(tabla, columna, { type: Sequelize.UUID, allowNull: true });
      await queryInterface.addConstraint(tabla, {
        fields: [columna],
        type: 'foreign key',
        name: nombreFk,
        references: { table: 'camionetas', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete,
      });
    }

    // Fecha en que el repartidor eligió su camioneta (para pedirle que elija de nuevo cada día)
    await queryInterface.addColumn('usuarios', 'camionetaActivaFecha', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    // 'rol' puede existir de un intento anterior: solo la agregamos si falta
    const usuarios = await queryInterface.describeTable('usuarios');
    if (!usuarios.rol) {
      await queryInterface.addColumn('usuarios', 'rol', {
        type: Sequelize.ENUM('admin', 'repartidor'),
        allowNull: false,
        defaultValue: 'admin',
      });
    }
  },

  async down(queryInterface) {
    for (const [tabla, columna, nombreFk] of COLUMNAS_FK) {
      await queryInterface.removeConstraint(tabla, nombreFk);
      await queryInterface.removeColumn(tabla, columna);
    }
    await queryInterface.removeColumn('usuarios', 'camionetaActivaFecha');
    await queryInterface.removeColumn('usuarios', 'rol');
  },
};