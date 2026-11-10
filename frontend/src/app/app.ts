import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import Toast from "./shared/toast/toast";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { ThemeService } from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('soderia-frontend');
  constructor(private router: Router, private location: Location) { }
  private themeService = inject(ThemeService)
  private notificationService = inject(NotificationService);

  ngOnInit() {
    if (!Capacitor.isNativePlatform()) return;

    CapacitorApp.addListener('backButton', () => {
      const rutaActual = this.router.url;

      if (rutaActual == '/cliente' || rutaActual === '/login') {
        this.notificationService.confirmar(
          'Salir de la aplicación',
          '¿Querés cerrar la aplicación?',
          () => CapacitorApp.exitApp(),
          'Salir',
        );
        return;
      }

      this.location.back();
    })
  }
}
