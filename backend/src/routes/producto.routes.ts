import { Router } from "express";
import { soloAdmin, verificarToken } from "../middlewares/auth.middleware";
import { esUuid } from '../utils/cliente.validation';
import { actualizarProducto, cambiarPrecio, crearProducto, desactivarProducto, listarProductos } from "../controllers/producto.controller";

const router = Router()

router.use(verificarToken)
router.param('id', (req, res, next, id) => {
    if (!esUuid(id)) return res.status(400).json({ error: 'Id de producto invalido' });
    next();
});

// Alta de productos y precios: solo admin. El resto (listar, editar, baja) queda para todos.
router.post('/', soloAdmin, crearProducto);
router.get('/', listarProductos);
router.put('/:id/precio', soloAdmin, cambiarPrecio);
router.delete('/:id', desactivarProducto);
router.put('/:id', actualizarProducto);

export default router;

// Producto corregido:
// - Entrada validada antes de tocar la base: nombre texto recortado de 1 a 100, precios numericos > 0 con 2 decimales,
//   tipoCliente particular/confianza, esRetornable/activo booleanos, stockMinimo entero >= 0, id UUID. Todo invalido da 400
//   (antes: nombres vacios o numericos y precios negativos se guardaban; precios no numericos daban 500).
// - Alta en una transaccion con sus dos precios (precioParticular y precioConfianza, columnas del producto).
//   Duplicados (sin distinguir mayusculas) responden 409 en vez de 500.
// - Listado: ?incluirInactivos=true muestra tambien los dados de baja.
// - Baja logica: 204, 409 si ya estaba desactivado; un producto desactivado no admite cambios de precio (409) y se
//   reactiva con PUT /:id { activo: true } (antes no habia forma de recuperarlo ni de reusar su nombre).
// - Precios: se cambian solo por PUT /:id/precio { tipoCliente, precio } bloqueando el producto. Las entregas usan
//   el precio actual del producto segun el tipo de cliente. Los precios se exponen como numero.
