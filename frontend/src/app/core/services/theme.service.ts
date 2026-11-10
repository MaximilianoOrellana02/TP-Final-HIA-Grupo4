import { isPlatformBrowser } from "@angular/common";
import { effect, inject, Injectable, PLATFORM_ID, signal } from "@angular/core";

type Tema = 'light' | 'dark';


@Injectable({
    providedIn: 'root'
})

export class ThemeService {
    private platformId = inject(PLATFORM_ID);
    private esNavegador = isPlatformBrowser(this.platformId);

    tema = signal<Tema>('light');

    constructor() {
        if (this.esNavegador) {
            const guardado = localStorage.getItem('tema') as Tema | null;
            this.tema.set(guardado ?? 'light')
        }

        effect(() => {
            const valor = this.tema();
            if (this.esNavegador) {
                document.documentElement.setAttribute('data-theme', valor);
                localStorage.setItem('tema', valor)
            }
        })
    }

    toggle() {
        this.tema.update((t) => (t === 'light' ? 'dark' : 'light'));
    }
}