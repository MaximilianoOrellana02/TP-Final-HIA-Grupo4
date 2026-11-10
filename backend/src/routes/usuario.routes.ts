import { Router } from "express";

import {
    registrar,
    login,
    cambiarPassword,
    solicitarRecuperacion,
    restablecerPassword,
    usuarioActual
} from '../controllers/usuario.controller'
import { soloAdmin, verificarToken } from "../middlewares/auth.middleware";
import { limitarIntentos } from '../middlewares/usuario-rate-limit.middleware';

export function crearUsuarioRouter() {
    const router = Router();
    // Solo un admin da de alta usuarios: si no, un repartidor podria crearse una cuenta admin.
    router.post('/registro', limitarIntentos(20), verificarToken, soloAdmin, registrar);
    router.post('/login', limitarIntentos(15), login);
    router.get('/me', verificarToken, usuarioActual);
    router.put('/password', limitarIntentos(10), verificarToken, cambiarPassword);
    router.post('/recuperar', limitarIntentos(5), solicitarRecuperacion);
    router.post('/restablecer', limitarIntentos(10), restablecerPassword);
    return router;
}

export default crearUsuarioRouter();

//Fixed