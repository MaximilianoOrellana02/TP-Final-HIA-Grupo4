import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RepartoService } from '../core/services/reparto.service';
import SettingsModal from '../shared/settings-modal/settings-modal';
import ResumenRepartoModal from '../shared/resumen-reparto-modal/resumen-reparto-modal';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SettingsModal, ResumenRepartoModal],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export default class Shell implements OnInit {
  authService = inject(AuthService);
  repartoService = inject(RepartoService);
  private esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  mostrarConfiguracion = signal(false);

  ngOnInit() {
    if (!this.esNavegador) return;
    // Rol al día (las sesiones viejas no lo tienen) y reparto de hoy. Si falla, la app sigue igual.
    this.authService.refrescarUsuario().subscribe({ error: () => {} });
    this.repartoService.cargarRepartoHoy().subscribe({ error: () => {} });
  }

  abrirConfiguracion() {
    this.mostrarConfiguracion.set(true);
  }

  cerrarConfiguracion() {
    this.mostrarConfiguracion.set(false);
  }
}
