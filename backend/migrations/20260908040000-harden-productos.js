'use strict';

const PRECIOS = 'precios_producto';
const INDICE = { name: 'precios_producto_producto_tipo_fecha', fields: ['productoId', 'tipoCliente', 'fechaDesde'] };

async function nombresDeIndices(queryInterface) {
  return new Set((await queryInterface.showIndex(PRECIOS)).map(i => i.name));
}

// Al crear el indice compuesto, InnoDB descarta el indice automatico de la FK productoId porque el nuevo la cubre.
// Antes de borrar el compuesto hay que dejar otro indice que empiece por productoId, o MySQL rechaza el DROP.
async function asegurarIndiceFk(queryInterface) {
  const indices = await queryInterface.showIndex(PRECIOS);
  const cubre = indices.some(i => i.name !== INDICE.name && i.fields[0] && i.fields[0].attribute === 'productoId');
  if (!cubre) await queryInterface.addIndex(PRECIOS, ['productoId'], { name: 'productoId' });
}

// Sequelize.NOW no genera default en la base y DATETIME sin fraccion redondea al segundo: dos cambios de precio
// en el mismo segundo quedaban empatados y el precio "vigente" era ambiguo. Se pasa a milisegundos con default.
async function definirFechaDesde(queryInterface, milisegundos) {
  const tipo = milisegundos ? 'DATETIME(3)' : 'DATETIME';
  const porDefecto = milisegundos ? ' DEFAULT CURRENT_TIMESTAMP(3)' : '';
  await queryInterface.sequelize.query(`ALTER TABLE ${PRECIOS} MODIFY fechaDesde ${tipo} NOT NULL${porDefecto}`);
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [productos] = await queryInterface.sequelize.query('SELECT id, nombre FROM productos FOR UPDATE', { transaction });
      const invalidos = productos.filter(p => typeof p.nombre !== 'string' || !p.nombre.trim() || p.nombre.trim().length > 100).map(p => p.id);
      if (invalidos.length) throw new Error('Corregir nombres vacios o demasiado largos en productos antes de migrar: ' + invalidos.join(', '));
      const [precios] = await queryInterface.sequelize.query(`SELECT id FROM ${PRECIOS} WHERE precio <= 0`, { transaction });
      if (precios.length) throw new Error('Corregir precios no positivos en precios_producto antes de migrar: ' + precios.map(p => p.id).join(', '));
      // El indice UNIQUE de MySQL detecta colisiones con la misma collation de la tabla.
      for (const producto of productos) {
        if (producto.nombre === producto.nombre.trim()) continue;
        try {
          await queryInterface.sequelize.query('UPDATE productos SET nombre = :nombre, updatedAt = NOW() WHERE id = :id', {
            replacements: { nombre: producto.nombre.trim(), id: producto.id }, transaction,
          });
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            error.message = `El producto ${producto.id} ("${producto.nombre}") colisiona con otro al recortar espacios; unificarlos antes de migrar`;
          }
          throw error;
        }
      }
    });
    if (!(await nombresDeIndices(queryInterface)).has(INDICE.name)) await queryInterface.addIndex(PRECIOS, INDICE.fields, { name: INDICE.name });
    await definirFechaDesde(queryInterface, true);
  },
  async down(queryInterface) {
    if ((await nombresDeIndices(queryInterface)).has(INDICE.name)) {
      await asegurarIndiceFk(queryInterface);
      await queryInterface.removeIndex(PRECIOS, INDICE.name);
    }
    await definirFechaDesde(queryInterface, false);
  },
};
