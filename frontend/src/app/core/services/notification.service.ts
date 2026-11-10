import { Injectable, signal } from "@angular/core";

export interface DetalleNotificacion {
    etiqueta: string;
    valor: string;
    tono?: 'info' | 'warning';
}

interface OpcionesConfirmacion {
    advertencia?: string;
    detalles?: DetalleNotificacion[];
    etiquetaSuperior?: string;
}

export interface Notificacion {
    mensaje: string;
    tipo: 'error' | 'info' | 'success' | 'confirm';
    titulo?: string;
    etiquetaConfirmacion?: string;
    advertencia?: string;
    detalles?: DetalleNotificacion[];
    etiquetaSuperior?: string;
}

@Injectable({ providedIn: 'root' })

export class NotificationService {
    notificacion = signal<Notificacion | null>(null);
    private timeoutId?: ReturnType<typeof setTimeout>;
    private accionConfirmacion?: () => void;

    mostrar(mensaje: string, tipo: Notificacion['tipo'] = 'error') {
        clearTimeout(this.timeoutId);
        this.accionConfirmacion = undefined;
        this.notificacion.set({ mensaje, tipo });
        this.timeoutId = setTimeout(() => this.notificacion.set(null), 4000);
    }

    confirmar(
        titulo: string,
        mensaje: string,
        accion: () => void,
        etiquetaConfirmacion = 'Confirmar',
        opciones: OpcionesConfirmacion = {},
    ) {
        clearTimeout(this.timeoutId);
        this.accionConfirmacion = accion;
        this.notificacion.set({
            titulo,
            mensaje,
            tipo: 'confirm',
            etiquetaConfirmacion,
            ...opciones,
        });
    }

    aceptarConfirmacion() {
        const accion = this.accionConfirmacion;
        this.cerrar();
        accion?.();
    }

    cerrar() {
        clearTimeout(this.timeoutId);
        this.accionConfirmacion = undefined;
        this.notificacion.set(null);
    }
}
