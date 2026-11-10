export interface Reparto {
    id: string;
    usuarioId: string;
    fecha: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
}

export interface ResumenReparto {
    fecha: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
    entregas: number;
    totalVendido: number;
    cobrado: number;
    cobradoPorMetodo: { efectivo: number; transferencia: number; mercadopago: number };
    fiado: number;
    productos: { nombre: string; cantidad: number; devueltos: number }[];
}
