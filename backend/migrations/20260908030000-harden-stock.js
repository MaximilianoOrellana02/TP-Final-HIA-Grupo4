'use strict';

const TABLA = 'movimientos_stock';
const INDICES = [
  { name: 'movimientos_stock_producto_fecha', fields: ['productoId', 'fecha'] },
  { name: 'movimientos_stock_fecha', fields: ['fecha'] },
];

async function nombresDeIndices(queryInterface) {
  const indices = await queryInterface.showIndex(TABLA);
  return new Set(indices.map(i => i.name));
}

// Al crear (productoId, fecha), InnoDB descarta el indice automatico de la FK productoId porque el nuevo la cubre.
// Antes de borrar el compuesto hay que dejar otro indice que empiece por productoId, o MySQL rechaza el DROP.
async function asegurarIndiceFk(queryInterface) {
  const indices = await queryInterface.showIndex(TABLA);
  const cubre = indices.some(i => !INDICES.some(x => x.name === i.name) && i.fields[0] && i.fields[0].attribute === 'productoId');
  if (!cubre) await queryInterface.addIndex(TABLA, ['productoId'], { name: 'productoId' });
}

// Sequelize no traduce Sequelize.NOW a DDL, asi que la columna quedo NOT NULL sin default en la base.
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
    const existentes = await nombresDeIndices(queryInterface);
    for (const indice of INDICES) {
      if (!existentes.has(indice.name)) await queryInterface.addIndex(TABLA, indice.fields, { name: indice.name });
    }
    await definirDefaultFecha(queryInterface, true);
  },
  async down(queryInterface) {
    const existentes = await nombresDeIndices(queryInterface);
    if (existentes.has('movimientos_stock_producto_fecha')) await asegurarIndiceFk(queryInterface);
    for (const indice of INDICES) {
      if (existentes.has(indice.name)) await queryInterface.removeIndex(TABLA, indice.name);
    }
    await definirDefaultFecha(queryInterface, false);
  },
};
