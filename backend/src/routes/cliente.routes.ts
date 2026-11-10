import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware";
import { esUuid } from "../utils/cliente.validation";
import {
  actividadClientes,
  actualizarCliente,
  ajustarUbicacion,
  crearCliente,
  eliminarCliente,
  listarClientes,
  listarDeudaVieja,
  marcarVisita,
  obtenerCliente,
  obtenerSaldoEnvases,
  listarDesactivados,
  restaurarCliente,
} from "../controllers/cliente.controller";

const router = Router();
router.use(verificarToken);
router.param("id", (req, res, next, id) => {
  if (!esUuid(id))
    return res.status(400).json({ error: "Id de cliente invalido" });
  next();
});

router.post("/", crearCliente);
router.get("/", listarClientes);
router.get("/desactivados", listarDesactivados);
router.get("/deuda-vieja", listarDeudaVieja);
router.get("/actividad", actividadClientes);
router.get("/:id", obtenerCliente);
router.put("/:id", actualizarCliente);
router.delete("/:id", eliminarCliente);
router.get("/:id/envases", obtenerSaldoEnvases);
router.put("/:id/ubicacion", ajustarUbicacion);
router.put("/:id/visita", marcarVisita);
router.patch("/:id/restaurar", restaurarCliente);

export default router;

// Cliente corregido: validaciones, baja logica, ubicacion, visitas y errores HTTP; cubierto por pruebas.
