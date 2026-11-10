'use strict';

// Esquema inicial de la base (PostgreSQL): las 9 tablas de la sodería.
// Reemplaza a las migraciones históricas de MySQL; refleja el modelo ya simplificado.

const ENUMS = [
  'enum_usuarios_rol',
  'enum_clientes_tipoCliente',
  'enum_clientes_categoria',
  'enum_historiales_metodoPago',
  'enum_movimientos_stock_tipo',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const id = { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true };
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    };
    const fk = (tabla, onDelete, allowNull = false) => ({
      type: Sequelize.UUID,
      allowNull,
      references: { model: tabla, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });
    const importe = (extra = {}) => ({ type: Sequelize.DECIMAL(10, 2), allowNull: false, ...extra });
    const ahora = Sequelize.literal('CURRENT_TIMESTAMP');

    await queryInterface.createTable('usuarios', {
      id,
      username: { type: Sequelize.STRING(50), allowNull: false },
      passwordHash: { type: Sequelize.STRING(255), allowNull: false },
      nombreCompleto: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: false },
      // Se incrementa al cambiar la contraseña para invalidar los tokens anteriores.
      sessionVersion: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      resetTokenHash: { type: Sequelize.STRING(64), allowNull: true },
      resetTokenExpiresAt: { type: Sequelize.DATE, allowNull: true },
      rol: { type: Sequelize.ENUM('admin', 'repartidor'), allowNull: false, defaultValue: 'repartidor' },
      ...timestamps,
    });
    // Username único sin distinguir mayúsculas ("Admin" y "admin" son el mismo usuario).
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX usuarios_username_lower_unique ON usuarios (LOWER(username))');
    // El email se guarda siempre en minúsculas.
    await queryInterface.addIndex('usuarios', ['email'], { name: 'usuarios_email_unique', unique: true });
    await queryInterface.addIndex('usuarios', ['resetTokenHash'], { name: 'usuarios_reset_token_hash', unique: true });

    await queryInterface.createTable('barrios', {
      id,
      nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      // Lista de días de la semana en que se visita el barrio, por ejemplo ["lunes", "jueves"].
      diasVisita: { type: Sequelize.JSON, allowNull: false },
      ...timestamps,
    });

    await queryInterface.createTable('clientes', {
      id,
      nombre: { type: Sequelize.STRING(100), allowNull: false },
      apellido: { type: Sequelize.STRING(100), allowNull: false },
      direccion: { type: Sequelize.STRING(200), allowNull: true },
      telefono: { type: Sequelize.STRING(30), allowNull: true },
      localidad: { type: Sequelize.STRING(100), allowNull: true },
      referencia: { type: Sequelize.STRING(100), allowNull: true },
      notaRepartidor: { type: Sequelize.STRING(255), allowNull: true },
      saldoActual: importe({ defaultValue: 0 }),
      tipoCliente: { type: Sequelize.ENUM('particular', 'confianza'), allowNull: false, defaultValue: 'particular' },
      categoria: { type: Sequelize.ENUM('domicilio', 'restaurante'), allowNull: false, defaultValue: 'domicilio' },
      barrioId: fk('barrios', 'RESTRICT', true),
      latitud: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitud: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      ultimaVisitaFecha: { type: Sequelize.DATEONLY, allowNull: true },
      // Baja lógica: un cliente dado de baja conserva su historial.
      deletedAt: { type: Sequelize.DATE, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('clientes', ['barrioId'], { name: 'clientes_barrio' });

    await queryInterface.createTable('productos', {
      id,
      nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      esRetornable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      stockActual: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      stockMinimo: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      precioParticular: importe({ defaultValue: 0 }),
      precioConfianza: importe({ defaultValue: 0 }),
      ...timestamps,
    });

    // Cada entrega o cobro a un cliente.
    await queryInterface.createTable('historiales', {
      id,
      clienteId: fk('clientes', 'RESTRICT'),
      usuarioId: fk('usuarios', 'RESTRICT'),
      fecha: { type: Sequelize.DATE(3), allowNull: false, defaultValue: ahora },
      saldoAnterior: importe(),
      importeTotal: importe(),
      montoPagado: importe({ defaultValue: 0 }),
      saldoFinal: importe(),
      observacion: { type: Sequelize.STRING(255), allowNull: true },
      metodoPago: {
        type: Sequelize.ENUM('efectivo', 'transferencia', 'mercadopago'), allowNull: false, defaultValue: 'efectivo',
      },
      // Si se corrigió la deuda anterior al registrar la entrega: { saldoEsperado, saldoNuevo, motivo }.
      ajusteSaldo: { type: Sequelize.JSON, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('historiales', ['clienteId', 'fecha'], { name: 'historiales_cliente_fecha' });
    await queryInterface.addIndex('historiales', ['fecha'], { name: 'historiales_fecha' });
    await queryInterface.addIndex('historiales', ['usuarioId'], { name: 'historiales_usuario' });

    // Productos de cada entrega (sin timestamps: se crean junto con su historial).
    await queryInterface.createTable('historial_detalles', {
      id,
      historialId: fk('historiales', 'CASCADE'),
      productoId: fk('productos', 'RESTRICT'),
      cantidadEntregada: { type: Sequelize.INTEGER, allowNull: false },
      cantidadEnvaseDevuelto: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      precioUnitario: importe(),
      importe: importe(),
    });
    await queryInterface.addIndex('historial_detalles', ['historialId'], { name: 'historial_detalles_historial' });
    await queryInterface.addIndex('historial_detalles', ['productoId'], { name: 'historial_detalles_producto' });

    // Envases retornables que cada cliente tiene en su poder, por producto.
    await queryInterface.createTable('saldos_envase', {
      id,
      clienteId: fk('clientes', 'RESTRICT'),
      productoId: fk('productos', 'RESTRICT'),
      cantidad: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addIndex('saldos_envase', ['clienteId', 'productoId'], {
      name: 'saldos_envase_cliente_producto_unique', unique: true,
    });
    await queryInterface.addIndex('saldos_envase', ['productoId'], { name: 'saldos_envase_producto' });

    // Entradas y salidas de stock del depósito.
    await queryInterface.createTable('movimientos_stock', {
      id,
      productoId: fk('productos', 'RESTRICT'),
      usuarioId: fk('usuarios', 'RESTRICT'),
      tipo: { type: Sequelize.ENUM('entrada', 'salida'), allowNull: false },
      cantidad: { type: Sequelize.INTEGER, allowNull: false },
      motivo: { type: Sequelize.STRING(255), allowNull: true },
      fecha: { type: Sequelize.DATE(3), allowNull: false, defaultValue: ahora },
      ...timestamps,
    });
    await queryInterface.addIndex('movimientos_stock', ['productoId', 'fecha'], { name: 'movimientos_stock_producto_fecha' });
    await queryInterface.addIndex('movimientos_stock', ['fecha'], { name: 'movimientos_stock_fecha' });
    await queryInterface.addIndex('movimientos_stock', ['usuarioId'], { name: 'movimientos_stock_usuario' });

    // Reparto del día de cada usuario: cuándo empezó y cuándo terminó.
    await queryInterface.createTable('repartos', {
      id,
      usuarioId: fk('usuarios', 'CASCADE'),
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      iniciadoEn: { type: Sequelize.DATE(3), allowNull: false },
      finalizadoEn: { type: Sequelize.DATE(3), allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('repartos', ['usuarioId', 'fecha'], { name: 'uq_reparto_usuario_fecha', unique: true });
  },

  async down(queryInterface) {
    for (const tabla of [
      'repartos', 'movimientos_stock', 'saldos_envase', 'historial_detalles', 'historiales',
      'productos', 'clientes', 'barrios', 'usuarios',
    ]) {
      await queryInterface.dropTable(tabla);
    }
    for (const tipo of ENUMS) await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${tipo}"`);
  },
};
