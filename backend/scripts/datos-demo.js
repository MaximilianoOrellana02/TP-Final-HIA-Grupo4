'use strict';
// Carga datos de prueba en una base vacia: un admin, un repartidor, barrios, productos con precios y stock,
// y clientes. Las contrasenas se generan y se muestran por consola.
// Uso: npm run db:demo
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const sequelize = require('../dist/config/database').default;
require('../dist/models/associations');
const Usuario = require('../dist/models/Usuario').default;
const Barrio = require('../dist/models/Barrio').default;
const Producto = require('../dist/models/Producto').default;
const MovimientoStock = require('../dist/models/MovimientoStock').default;
const Cliente = require('../dist/models/Cliente').default;

function generarPassword(longitud = 14) {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from(crypto.randomBytes(longitud), (b) => alfabeto[b % alfabeto.length]).join('');
}

const USUARIOS = [
    { username: 'admin', nombreCompleto: 'Administrador', email: 'admin@example.com', rol: 'admin' },
    { username: 'repartidor', nombreCompleto: 'Repartidor Demo', email: 'repartidor@example.com', rol: 'repartidor' },
];

const BARRIOS = [
    { nombre: 'Centro', diasVisita: ['lunes', 'jueves', 'domingo'] },
    { nombre: 'Alto Comedero', diasVisita: ['martes', 'viernes'] },
    { nombre: 'Los Perales', diasVisita: ['miercoles', 'sabado'] },
];

// precios: [particular, confianza]
const PRODUCTOS = [
    { nombre: 'Bidón 20 L', esRetornable: true, stock: 80, stockMinimo: 15, precios: [2500, 2200] },
    { nombre: 'Bidón 12 L', esRetornable: true, stock: 50, stockMinimo: 10, precios: [1800, 1600] },
    { nombre: 'Sifón de soda 1,5 L', esRetornable: true, stock: 120, stockMinimo: 20, precios: [900, 800] },
    { nombre: 'Pack agua 6 x 2 L', esRetornable: false, stock: 30, stockMinimo: 5, precios: [3600, 3300] },
];

const CLIENTES = [
    { nombre: 'María', apellido: 'Gómez', barrio: 'Centro', direccion: 'Belgrano 450', telefono: '3884123456', tipoCliente: 'confianza', latitud: -24.1858, longitud: -65.2995 },
    { nombre: 'Jorge', apellido: 'Quispe', barrio: 'Centro', direccion: 'Necochea 210', telefono: '3884234567', latitud: -24.1872, longitud: -65.3021 },
    { nombre: 'Restaurante', apellido: 'El Fortín', barrio: 'Centro', direccion: 'Lavalle 380', telefono: '3884345678', categoria: 'restaurante', tipoCliente: 'confianza', latitud: -24.1841, longitud: -65.3008 },
    { nombre: 'Lucía', apellido: 'Mamaní', barrio: 'Alto Comedero', direccion: 'Av. Forestal 1250', telefono: '3884456789', latitud: -24.2265, longitud: -65.2662 },
    { nombre: 'Carlos', apellido: 'Vilte', barrio: 'Alto Comedero', direccion: 'Calle 12 n° 340', telefono: null, latitud: -24.2301, longitud: -65.2618 },
    { nombre: 'Ana', apellido: 'Cruz', barrio: 'Los Perales', direccion: 'Av. Bolivia 2100', telefono: '3884567890', tipoCliente: 'confianza', latitud: -24.1755, longitud: -65.3215 },
];

(async () => {
    if ((await Usuario.count()) > 0 || (await Producto.count()) > 0) {
        console.error('La base ya tiene usuarios o productos: este script solo carga datos en una base vacia.');
        console.error('Para empezar de cero: npm run db:reset -- --confirmar && npm run db:migrate');
        process.exit(1);
    }

    const credenciales = [];
    await sequelize.transaction(async (transaction) => {
        const usuarios = {};
        for (const datos of USUARIOS) {
            const password = generarPassword();
            usuarios[datos.rol] = await Usuario.create({ ...datos, passwordHash: await bcrypt.hash(password, 12) }, { transaction });
            credenciales.push({ ...datos, password });
        }

        const barrios = {};
        for (const datos of BARRIOS) barrios[datos.nombre] = await Barrio.create(datos, { transaction });

        for (const { precios, stock, ...datos } of PRODUCTOS) {
            // El stock inicial entra como movimiento para que quede registrado de donde salio.
            const producto = await Producto.create({
                ...datos, stockActual: stock, precioParticular: precios[0], precioConfianza: precios[1],
            }, { transaction });
            await MovimientoStock.create({
                productoId: producto.id, usuarioId: usuarios.admin.id, tipo: 'entrada', cantidad: stock, motivo: 'Stock inicial',
            }, { transaction });
        }

        for (const { barrio, ...datos } of CLIENTES) {
            await Cliente.create({ ...datos, barrioId: barrios[barrio].id }, { transaction });
        }
    });

    console.log('Datos de prueba cargados:');
    console.log(`  ${BARRIOS.length} barrios, ${PRODUCTOS.length} productos con precio y stock, ${CLIENTES.length} clientes`);
    console.log('Usuarios (guarda estas contrasenas, no se vuelven a mostrar):');
    for (const c of credenciales) console.log(`  ${c.rol.padEnd(10)} usuario: ${c.username.padEnd(11)} contrasena: ${c.password}`);
    await sequelize.close();
})().catch(async (error) => {
    console.error('Error al cargar los datos de prueba:', error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
});
