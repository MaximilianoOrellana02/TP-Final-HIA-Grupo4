import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware";
import { esUuid } from '../utils/cliente.validation';
import { crearEntrega, historialPorCliente, listarHistorial, resumenHistorial, resumenHoy } from "../controllers/historial.controller";

const router = Router();

router.use(verificarToken);
router.param('clienteId', (req, res, next, id) => {
    if (!esUuid(id)) return res.status(400).json({ error: 'Id de cliente invalido' });
    next();
});

router.post('/', crearEntrega);
router.get('/resumen-hoy', resumenHoy)
router.get('/cliente/:clienteId', historialPorCliente)
router.get('/', listarHistorial)
router.get('/resumen', resumenHistorial);

export default router

// Historial corregido:
// - Entrega validada antes de la transaccion: clienteId UUID, detalles como lista de lineas con productoId UUID,
//   cantidades enteras >= 0 (al menos una unidad por linea, sin productos repetidos), precio manual y montoPagado
//   numericos >= 0 con 2 decimales, metodoPago del enum y observacion recortada de hasta 255. Todo invalido da 400
//   (antes: cantidades y precios negativos se guardaban, decimales/textos/metodos desconocidos daban 500).
// - Stock: los productos se bloquean en orden fijo; producto desactivado o stock insuficiente responden 409
//   (antes una entrega dejaba el stock negativo, saltando la regla del modulo Stock). Producto inexistente da 404.
// - Envases: solo los productos retornables generan saldo de envases; devolver envases de uno no retornable da 400.
// - Importes redondeados a 2 decimales y expuestos como numero en toda la API (antes llegaban como texto).
// - Consultas: filtros desde/hasta/page/limit validados (400 en vez de 500); YYYY-MM-DD se interpreta como dia
//   comercial completo de Argentina; limit tope 100 (500 por cliente, total en X-Total-Historial).
//   /cliente/:clienteId exige UUID (400) y responde 404 si el cliente no existe; los dados de baja siguen visibles.
// - resumen y resumen-hoy comparten el calculo; resumen-hoy usa el dia comercial de Argentina en vez de la
//   medianoche del servidor e informa la fecha y el desglose por producto.
// - Migracion harden-historial: indices por fecha y (clienteId, fecha), default de fecha, observaciones
//   recortadas y rechazo de cantidades o importes negativos previos.
