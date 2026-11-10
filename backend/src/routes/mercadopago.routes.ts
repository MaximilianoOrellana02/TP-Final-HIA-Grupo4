import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.middleware';
import { crearPreferenciaController, estadoPagoController, estadoHabilitado } from '../controllers/mercadopago.controller';

const router = Router();

router.use(verificarToken);

router.get('/habilitado', estadoHabilitado);
router.post('/preferencia', crearPreferenciaController);
router.get('/estado/:referencia', estadoPagoController);

export default router;