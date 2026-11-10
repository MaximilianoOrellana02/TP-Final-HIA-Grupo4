import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { crearPreferencia, buscarPagoPorReferencia, mercadoPagoHabilitado } from '../services/mercadopago.service';

export async function crearPreferenciaController(req: AuthRequest, res: Response) {
    try {
        if (!mercadoPagoHabilitado()) {
            return res.status(400).json({ error: 'Mercado Pago no está habilitado' });
        }

        const { monto, descripcion, referenciaExterna } = req.body;
        if (!monto || !descripcion || !referenciaExterna) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }

        const resultado = await crearPreferencia(monto, descripcion, referenciaExterna);

        return res.json({
            initPoint: resultado.init_point,
            sandboxInitPoint: resultado.sandbox_init_point,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al crear la preferencia de pago' });
    }
}

export async function estadoPagoController(req: AuthRequest, res: Response) {
    try {
        const { referencia } = req.params;
        const resultado = await buscarPagoPorReferencia(referencia as string);
        return res.json(resultado);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al consultar el estado del pago' });
    }
}

export function estadoHabilitado(req: AuthRequest, res: Response) {
    return res.json({ habilitado: mercadoPagoHabilitado() });
}