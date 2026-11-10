import { Router } from "express";
import { verificarToken } from "../middlewares/auth.middleware";
import { comenzarReparto, reabrirReparto, repartoDeHoy, terminarReparto } from "../controllers/reparto.controller";

const router = Router();

router.use(verificarToken);

// Siempre el reparto del usuario logueado en el día comercial de hoy.
router.get("/hoy", repartoDeHoy);
router.post("/hoy/comenzar", comenzarReparto);
router.post("/hoy/terminar", terminarReparto);
router.post("/hoy/reabrir", reabrirReparto);

export default router;
