import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware";
import { esUuid } from '../utils/cliente.validation';
import { actualizarBarrio, crearBarrio, eliminarBarrio, listarBarrios } from "../controllers/barrio.controller";

const router = Router()

router.use(verificarToken);
router.param('id', (req, res, next, id) => {
    if (!esUuid(id)) return res.status(400).json({ error: 'Id de barrio invalido' });
    next();
});

router.get('/', listarBarrios);
router.post('/', crearBarrio);
router.delete('/:id', eliminarBarrio);
router.put('/:id', actualizarBarrio);

export default router

// Barrio corregido:
// - Borrado: los clientes activos bloquean (409); los archivados se desvinculan en la misma transaccion,
//   asi ningun barrio queda imposible de eliminar. La FK pasa a RESTRICT: correr la migracion antes de desplegar.
// - Duplicados: chequeo sin distinguir mayusculas en la app, sin depender de la collation de MySQL.
// - Modelo: el setter de nombre solo recorta; la validacion vive en validate() y build() ya no lanza.
// - Dias de visita ordenados por semana; los errores de validacion devuelven el mensaje concreto.
// - Migracion: tolera JSON como texto (MariaDB), nombra el barrio en colisiones y actualiza updatedAt.
