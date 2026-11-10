'use strict';

const TABLA = 'pedidos';
// estado no es columna de FK, asi que este indice no reemplaza a los automaticos de clienteId/usuarioId.
const INDICE = { name: 'pedidos_estado_fecha', fields: ['estado', 'fecha'] };

async function nombresDeIndices(queryInterface) {
  return new Set((await queryInterface.showIndex(TABLA)).map(i => i.name));
}

// Sequelize.NOW no se traduce a DDL, asi que la columna quedo NOT NULL sin default en la base.
// Se respeta el tipo actual (DATETIME o DATETIME(n)) para elegir la precision de CURRENT_TIMESTAMP.
async function definirDefaultFecha(queryInterface, conDefault) {
  const columnas = await queryInterface.describeTable(TABLA);
  const tipo = columnas.fecha.type;
  const precision = /\((\d)\)/.exec(tipo);
  const actual = conDefault ? ` DEFAULT CURRENT_TIMESTAMP${precision ? `(${precision[1]})` : ''}` : '';
  await queryInterface.sequelize.query(`ALTER TABLE ${TABLA} MODIFY fecha ${tipo} NOT NULL${actual}`);
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [pedidos] = await queryInterface.sequelize.query(`SELECT id, detalle FROM ${TABLA} WHERE detalle IS NOT NULL FOR UPDATE`, { transaction });
      for (const pedido of pedidos) {
        const detalle = String(pedido.detalle).trim() || null;
        if (detalle === pedido.detalle) continue;
        await queryInterface.sequelize.query(`UPDATE ${TABLA} SET detalle = :detalle, updatedAt = NOW() WHERE id = :id`, {
          replacements: { detalle, id: pedido.id }, transaction,
        });
      }
    });
    if (!(await nombresDeIndices(queryInterface)).has(INDICE.name)) await queryInterface.addIndex(TABLA, INDICE.fields, { name: INDICE.name });
    await definirDefaultFecha(queryInterface, true);
  },
  async down(queryInterface) {
    if ((await nombresDeIndices(queryInterface)).has(INDICE.name)) await queryInterface.removeIndex(TABLA, INDICE.name);
    await definirDefaultFecha(queryInterface, false);
  },
};
