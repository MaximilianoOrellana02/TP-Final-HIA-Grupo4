import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    const esServidorSeguro = location.protocol === 'https:';
    const esDesarrolloLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

    if ('serviceWorker' in navigator && esServidorSeguro && !esDesarrolloLocal) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
          .catch((err) => console.error('No se pudo registrar el service worker', err));
      });
    }
  })
  .catch((err) => console.error(err));
