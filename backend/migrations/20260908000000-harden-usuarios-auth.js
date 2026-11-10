'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [invalid] = await queryInterface.sequelize.query("SELECT COUNT(*) AS total FROM usuarios WHERE email IS NULL OR TRIM(email) = ''");
    const [duplicates] = await queryInterface.sequelize.query('SELECT COUNT(*) AS total FROM (SELECT LOWER(TRIM(email)) FROM usuarios GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1) AS duplicates');
    if (Number(invalid[0].total) || Number(duplicates[0].total)) {
      throw new Error('Corregir emails vacios o duplicados en usuarios antes de migrar');
    }
    // MySQL confirma DDL implicitamente: permitir reintentar una migracion interrumpida.
    const columns = await queryInterface.describeTable('usuarios');
    if (!columns.sessionVersion) await queryInterface.addColumn('usuarios', 'sessionVersion', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 });
    if (!columns.resetTokenHash) await queryInterface.addColumn('usuarios', 'resetTokenHash', { type: Sequelize.STRING(64), allowNull: true });
    if (!columns.resetTokenExpiresAt) await queryInterface.addColumn('usuarios', 'resetTokenExpiresAt', { type: Sequelize.DATE, allowNull: true });
    const indexes = await queryInterface.showIndex('usuarios');
    if (!indexes.some(index => index.unique && index.fields.length === 1 && index.fields[0].attribute === 'email')) {
      await queryInterface.addIndex('usuarios', ['email'], { name: 'usuarios_email_unique', unique: true });
    }
    await queryInterface.sequelize.query('UPDATE usuarios SET email = LOWER(TRIM(email))');
    await queryInterface.changeColumn('usuarios', 'email', { type: Sequelize.STRING(150), allowNull: false });
    if (!indexes.some(index => index.name === 'usuarios_reset_token_hash')) {
      await queryInterface.addIndex('usuarios', ['resetTokenHash'], { name: 'usuarios_reset_token_hash', unique: true });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('usuarios', 'usuarios_reset_token_hash');
    await queryInterface.removeIndex('usuarios', 'usuarios_email_unique');
    await queryInterface.changeColumn('usuarios', 'email', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.removeColumn('usuarios', 'resetTokenExpiresAt');
    await queryInterface.removeColumn('usuarios', 'resetTokenHash');
    await queryInterface.removeColumn('usuarios', 'sessionVersion');
  },
};
