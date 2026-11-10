import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const habilitado = process.env.MP_HABILITADO === 'true'

let client: MercadoPagoConfig | null = null;
if (habilitado && process.env.MP_ACCESS_TOKEN) {
    client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
}

export function mercadoPagoHabilitado(): boolean {
    return client !== null;
}

export async function crearPreferencia(monto: number, descripcion: string, referenciaExterna: string) {
    if (!client) throw new Error('Mercado Pago no está habilitado');

    const preference = new Preference(client);
    const resultado = await preference.create({
        body: {
            items: [
                {
                    id: referenciaExterna,
                    title: descripcion,
                    quantity: 1,
                    unit_price: monto,
                    currency_id: 'ARS',
                },
            ],
            external_reference: referenciaExterna,
        },
    });

    return resultado;
}

export async function buscarPagoPorReferencia(referenciaExterna: string) {
    if (!client) throw new Error('Mercado Pago no está habilitado');

    const payment = new Payment(client);
    const resultado = await payment.search({
        options: { external_reference: referenciaExterna },
    });

    const pagos = resultado.results ?? [];
    const aprobado = pagos.find((p: any) => p.status === 'approved');

    return aprobado ? { pagado: true } : { pagado: false };
}