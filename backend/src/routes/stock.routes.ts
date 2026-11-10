import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware";
import { crearMovimientoStock, listarMovimientosStock } from "../controllers/stock.controller";

const router = Router();

router.use(verificarToken);

router.post('/movimientos', crearMovimientoStock);
router.get('/movimientos', listarMovimientosStock);

export default router;

// Stock corregido:
// - Entrada validada antes de abrir la transaccion: productoId UUID, tipo entrada/salida, cantidad entera
//   positiva, motivo obligatorio en salidas y de hasta 255 caracteres. Todo lo invalido responde 400.
// - Salidas: el producto se bloquea (FOR UPDATE), no se permite stock negativo ni productos desactivados (409).
//   La respuesta incluye el stockActual resultante.
// - Listado: filtros validados (UUID, tipo, fechas ISO y desde <= hasta) con 400 en vez de 500.
// - Modelo: cantidad entera >= 1 y motivo acotado tambien protegen al historial, que ya no genera
//   movimientos de cantidad 0 cuando el cliente solo devuelve envases.
// - Migracion harden-stock: indices por fecha y (productoId, fecha) y default de fecha en la base.
