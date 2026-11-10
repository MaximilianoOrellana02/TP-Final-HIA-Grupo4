'use strict';

const TABLA = 'historiales';
const INDICES = [
  { name: 'historiales_fecha', fields: ['fecha'] },
  { name: 'historiales_cliente_fecha', fields: ['clienteId', 'fecha'] },
];

async function nombresDeIndices(queryInterface) {
  return new Set((await queryInterface.showIndex(TABLA)).map(i => i.name));
}

// Al crear (clienteId, fecha), InnoDB descarta el indice automatico de la FK clienteId porque el nuevo la cubre.
// Antes de borrar el compuesto hay que dejar otro indice que empiece por clienteId, o MySQL rechaza el DROP.
async function asegurarIndiceFk(queryInterface) {
  const indices = await queryInterface.showIndex(TABLA);
  const cubre = indices.some(i => !INDICES.some(x => x.name === i.name) && i.fields[0] && i.fields[0].attribute === 'clienteId');
  if (!cubre) await queryInterface.addIndex(TABLA, ['clienteId'], { name: 'clienteId' });
}

// Sequelize.NOW no se traduce a DDL (la columna quedo sin default) y DATETIME sin fraccion redondea al segundo:
// dos entregas en el mismo segundo empataban al ordenar. Se pasa a milisegundos con default en la base.
async function definirFecha(queryInterface, milisegundos) {
  const tipo = milisegundos ? 'DATETIME(3)' : 'DATETIME';
  const porDefecto = milisegundos ? ' DEFAULT CURRENT_TIMESTAMP(3)' : '';
  await queryInterface.sequelize.query(`ALTER TABLE ${TABLA} MODIFY fecha ${tipo} NOT NULL${porDefecto}`);
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [cabeceras] = await queryInterface.sequelize.query(`SELECT id FROM ${TABLA} WHERE importeTotal < 0 OR montoPagado < 0`, { transaction });
      if (cabeceras.length) throw new Error('Corregir importes o pagos negativos en historiales antes de migrar: ' + cabeceras.map(h => h.id).join(', '));
      const [detalles] = await queryInterface.sequelize.query('SELECT id FROM historial_detalles WHERE cantidadEntregada < 0 OR cantidadEnvaseDevuelto < 0 OR precioUnitario < 0 OR importe < 0', { transaction });
      if (detalles.length) throw new Error('Corregir cantidades o importes negativos en historial_detalles antes de migrar: ' + detalles.map(d => d.id).join(', '));
      const [observaciones] = await queryInterface.sequelize.query(`SELECT id, observacion FROM ${TABLA} WHERE observacion IS NOT NULL FOR UPDATE`, { transaction });
      for (const historial of observaciones) {
        const observacion = String(historial.observacion).trim() || null;
        if (observacion === historial.observacion) continue;
        await queryInterface.sequelize.query(`UPDATE ${TABLA} SET observacion = :observacion, updatedAt = NOW() WHERE id = :id`, {
          replacements: { observacion, id: historial.id }, transaction,
        });
      }
    });
    const existentes = await nombresDeIndices(queryInterface);
    for (const indice of INDICES) {
      if (!existentes.has(indice.name)) await queryInterface.addIndex(TABLA, indice.fields, { name: indice.name });
    }
    await definirFecha(queryInterface,true);
  },
  async down(queryInterface) {
    const existentes = await nombresDeIndices(queryInterface);
    if (existentes.has('historiales_cliente_fecha')) await asegurarIndiceFk(queryInterface);
    for (const indice of INDICES) {
      if (existentes.has(indice.name)) await queryInterface.removeIndex(TABLA, indice.name);
    }
    await definirFecha(queryInterface,false);
  },
};
