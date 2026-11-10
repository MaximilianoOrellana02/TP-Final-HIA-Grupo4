'use strict';

const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// mysql2 devuelve las columnas JSON parseadas; MariaDB (JSON = LONGTEXT) las devuelve como texto.
function leerDias(valor) {
  if (typeof valor !== 'string') return valor;
  try { return JSON.parse(valor); } catch { return valor; }
}

function esBarrioValido(nombre, dias) {
  return typeof nombre === 'string' && nombre.trim() && nombre.trim().length <= 100 &&
    Array.isArray(dias) && dias.length <= 7 &&
    dias.every(dia => diasValidos.includes(dia)) && new Set(dias).size === dias.length;
}

async function cambiarRelacion(queryInterface, restrict) {
  const [keys] = await queryInterface.sequelize.query("SELECT CONSTRAINT_NAME AS nombre FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'barrioId' AND REFERENCED_TABLE_NAME = 'barrios'");
  if (keys.length !== 1) throw new Error('No se encontro una unica relacion clientes.barrioId');
  const actual = queryInterface.queryGenerator.quoteIdentifier(keys[0].nombre);
  const nombre = restrict ? 'clientes_barrio_restrict' : 'clientes_barrio_set_null';
  const accion = restrict ? 'RESTRICT' : 'SET NULL';
  const [rules] = await queryInterface.sequelize.query('SELECT DELETE_RULE AS borrado, UPDATE_RULE AS actualizado FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = :tabla AND CONSTRAINT_NAME = :nombre', {
    replacements: { tabla: 'clientes', nombre: keys[0].nombre },
  });
  if (rules[0]?.borrado === accion && rules[0]?.actualizado === 'CASCADE') return;
  // Un solo ALTER evita dejar la relacion sin proteccion entre dos operaciones DDL.
  await queryInterface.sequelize.query(`ALTER TABLE clientes DROP FOREIGN KEY ${actual}, ADD CONSTRAINT ${nombre} FOREIGN KEY (barrioId) REFERENCES barrios(id) ON UPDATE CASCADE ON DELETE ${accion}`);
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [barrios] = await queryInterface.sequelize.query('SELECT id, nombre, diasVisita FROM barrios FOR UPDATE', { transaction });
      const invalidos = barrios.filter(b => !esBarrioValido(b.nombre, leerDias(b.diasVisita))).map(b => b.id);
      if (invalidos.length) throw new Error('Corregir nombres o dias invalidos en barrios antes de migrar: ' + invalidos.join(', '));
      // El indice UNIQUE de MySQL detecta colisiones con la misma collation de la tabla.
      for (const barrio of barrios) {
        if (barrio.nombre === barrio.nombre.trim()) continue;
        try {
          await queryInterface.sequelize.query('UPDATE barrios SET nombre = :nombre, updatedAt = NOW() WHERE id = :id', {
            replacements: { nombre: barrio.nombre.trim(), id: barrio.id }, transaction,
          });
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            error.message = `El barrio ${barrio.id} ("${barrio.nombre}") colisiona con otro al recortar espacios; unificarlos antes de migrar`;
          }
          throw error;
        }
      }
    });
    await cambiarRelacion(queryInterface, true);
  },
  async down(queryInterface) {
    await cambiarRelacion(queryInterface, false);
  },
};
