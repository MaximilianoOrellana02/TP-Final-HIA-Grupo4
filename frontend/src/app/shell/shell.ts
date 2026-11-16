import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RepartoService } from '../core/services/reparto.service';
import { ClienteService } from '../core/services/cliente.service';
import { NotificationService } from '../core/services/notification.service';
import ResumenRepartoModal from '../shared/resumen-reparto-modal/resumen-reparto-modal';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ResumenRepartoModal],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export default class Shell implements OnInit {
  authService = inject(AuthService);
  repartoService = inject(RepartoService);
  private esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private clienteService = inject(ClienteService);
  private notificaciones = inject(NotificationService);
  verificandoCambio = signal(false);

  ngOnInit() {
    if (!this.esNavegador) return;
    // Rol al día (las sesiones viejas no lo tienen) y reparto de hoy. Si falla, la app sigue igual.
    this.authService.refrescarUsuario().subscribe({ error: () => {} });
    this.repartoService.cargarRepartoHoy().subscribe({ error: () => {} });
  }

  verificarCambio() {
    if (this.verificandoCambio()) return;
    this.verificandoCambio.set(true);
    this.clienteService.listarPaginado(1).subscribe({
      next: (resultado) => {
        this.verificandoCambio.set(false);
        if (Array.isArray(resultado.items) && resultado.page === 1 && typeof resultado.total === 'number') {
          this.notificaciones.mostrar('Cambio aplicado: la API de clientes responde con paginación.', 'success');
        } else {
          this.notificaciones.mostrar('La API todavía no devuelve el formato paginado esperado.');
        }
      },
      error: () => {
        this.verificandoCambio.set(false);
        this.notificaciones.mostrar('No se pudo verificar la paginación. Revisá el backend o la conexión.');
      },
    });
  }
}
