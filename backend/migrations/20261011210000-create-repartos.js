'use strict';

// Un reparto por usuario y día comercial: cuándo empezó, con qué camioneta y cuándo terminó.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('repartos', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      usuarioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      camionetaId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'camionetas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      iniciadoEn: { type: Sequelize.DATE(3), allowNull: false },
      finalizadoEn: { type: Sequelize.DATE(3), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('repartos', {
      fields: ['usuarioId', 'fecha'],
      type: 'unique',
      name: 'uq_reparto_usuario_fecha',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('repartos');
  },
};
