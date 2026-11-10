import '../leaftlet-setup';
import { Component, input, output, afterNextRender, ElementRef, viewChild, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Cliente } from '../../core/models/cliente.model';
import { armarLinkGoogleMapsDestino, calcularRutaOptima, PuntoRuta } from '../ruta-optima.util';
import { DecimalPipe } from '@angular/common';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { RepartoService } from '../../core/services/reparto.service';

@Component({
  selector: 'app-ruta-mapa-modal',
  imports: [DecimalPipe],
  templateUrl: './ruta-mapa-modal.html',
  styleUrl: './ruta-mapa-modal.css',
})
export default class RutaMapaModal implements OnDestroy {
  private router = inject(Router);
  repartoService = inject(RepartoService);

  clientes = input.required<Cliente[]>();
  cerrar = output<void>();

  private contenedor = viewChild.required<ElementRef<HTMLDivElement>>('mapaContenedor');
  private mapa?: L.Map;
  private capasRuta?: L.LayerGroup;
  private marcadores = new Map<string, L.Marker>();
  private geometriaRuta: [number, number][] = [];
  private solicitudRuta = 0;
  gpsDisponible = Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.isSecureContext);

  clientesOrdenados = signal<Cliente[]>([]);
  filtroRadioKm = signal<number | null>(null);
  mostrarTodasParadas = signal(false);
  calculandoRuta = signal(true);
  errorRuta = signal<string | null>(null);
  distanciaKm = signal(0);
  duracionMin = signal(0);
  ubicacionActual = signal<PuntoRuta | null>(null);
  minutosHastaParada = signal<number[]>([]);
  horaCalculoRuta = signal(0);

  localidadTitulo = computed(() =>
    this.clientes().map((cliente) => cliente.localidad?.trim()).find(Boolean) ?? 'San Salvador de Jujuy'
  );
  repartoActivo = computed(() => {
    const reparto = this.repartoService.repartoHoy();
    return !!reparto && !reparto.finalizadoEn;
  });
  clientesConUbicacion = computed(() =>
    this.clientes().filter((cliente) => cliente.latitud != null && cliente.longitud != null)
  );
  clientesParaRuta = computed(() => {
    const ubicacion = this.ubicacionActual();
    const radioKm = this.filtroRadioKm();
    const clientes = this.clientesConUbicacion();
    if (!ubicacion || radioKm === null) return clientes;
    const origen = L.latLng(ubicacion.latitud, ubicacion.longitud);
    return clientes
      .filter((cliente) => origen.distanceTo([cliente.latitud!, cliente.longitud!]) <= radioKm * 1000)
      .sort((a, b) => origen.distanceTo([a.latitud!, a.longitud!]) - origen.distanceTo([b.latitud!, b.longitud!]));
  });
  paradasVisibles = computed(() => {
    const ubicacion = this.ubicacionActual();
    return this.clientesOrdenados().map((cliente) => ({
      cliente,
      distanciaMetros: ubicacion && cliente.latitud != null && cliente.longitud != null
        ? L.latLng(ubicacion.latitud, ubicacion.longitud).distanceTo([cliente.latitud, cliente.longitud])
        : null,
    }));
  });
  paradasMostradas = computed(() => this.mostrarTodasParadas()
    ? this.paradasVisibles()
    : this.paradasVisibles().slice(0, 2));

  constructor() {
    afterNextRender(() => {
      this.mapa = L.map(this.contenedor().nativeElement, {
        zoomControl: true,
      });

      this.mapa.attributionControl.setPrefix(false);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.mapa);
      this.mapa.setView([-24.1858, -65.2995], 13);

      this.iniciarCalculoRuta();
    });
  }

  private async iniciarCalculoRuta() {
    const clientesConUbicacion = this.clientesConUbicacion();

    if (clientesConUbicacion.length === 0) {
      this.mostrarSinRuta(clientesConUbicacion);
      return;
    }

    const solicitud = ++this.solicitudRuta;
    this.calculandoRuta.set(true);
    this.errorRuta.set(null);
    let inicio: PuntoRuta;
    try {
      inicio = await this.obtenerUbicacionActual();
    } catch (error) {
      if (solicitud !== this.solicitudRuta) return;
      console.error('Error al obtener ubicación:', error);
      this.ubicacionActual.set(null);
      this.filtroRadioKm.set(null);
      this.errorRuta.set(this.gpsDisponible
        ? 'No se pudo obtener tu ubicación. Activá el GPS y dale permiso a la app.'
        : 'El filtro de cercanía necesita HTTPS. Podés abrir la próxima parada en Google Maps.');
      this.mostrarSinRuta(clientesConUbicacion);
      return;
    }
    if (solicitud !== this.solicitudRuta) return;
    this.ubicacionActual.set(inicio);
    await this.calcularRutaSeleccionada();
  }

  ngOnDestroy() {
    this.solicitudRuta++;
    this.mapa?.remove();
    this.mapa = undefined;
  }

  private async calcularRutaSeleccionada() {
    const solicitud = ++this.solicitudRuta;
    const inicio = this.ubicacionActual();
    const clientes = this.clientesParaRuta();
    this.calculandoRuta.set(true);
    this.errorRuta.set(null);
    this.mostrarTodasParadas.set(false);
    this.clientesOrdenados.set([]);
    this.distanciaKm.set(0);
    this.duracionMin.set(0);
    this.geometriaRuta = [];
    this.minutosHastaParada.set([]);
    this.renderizarMapa();

    if (!inicio || clientes.length === 0) {
      this.mostrarSinRuta(clientes);
      return;
    }

    const resultado = await calcularRutaOptima(inicio, clientes as (Cliente & PuntoRuta)[]).catch(() => null);
    if (solicitud !== this.solicitudRuta) return;
    if (!resultado) {
      this.errorRuta.set('No se pudo calcular la ruta. Mostrando las paradas cercanas.');
      this.mostrarSinRuta(clientes);
      return;
    }

    this.clientesOrdenados.set(resultado.ordenados as Cliente[]);
    this.distanciaKm.set(resultado.distanciaKm);
    this.duracionMin.set(resultado.duracionMin);
    this.geometriaRuta = resultado.geometria;
    this.horaCalculoRuta.set(Date.now());
    let minutos = 0;
    this.minutosHastaParada.set(resultado.duracionesTramosMin.length === resultado.ordenados.length
      ? resultado.duracionesTramosMin.map((tramo) => (minutos += tramo))
      : []);
    this.calculandoRuta.set(false);
    this.renderizarMapa();
  }

  private mostrarSinRuta(clientes: Cliente[]) {
    this.clientesOrdenados.set(clientes);
    this.distanciaKm.set(0);
    this.duracionMin.set(0);
    this.geometriaRuta = [];
    this.minutosHastaParada.set([]);
    this.calculandoRuta.set(false);
    this.renderizarMapa();
  }

  cambiarFiltro(radioKm: number | null) {
    if (radioKm !== null && !this.ubicacionActual()) return;
    if (radioKm === this.filtroRadioKm()) return;
    this.filtroRadioKm.set(radioKm);
    this.calcularRutaSeleccionada();
  }

  actualizarUbicacion() {
    if (this.calculandoRuta()) return;
    this.iniciarCalculoRuta();
  }

  alternarTodasParadas() {
    this.mostrarTodasParadas.update((abierto) => !abierto);
  }

  horaLlegada(indice: number): string | null {
    const minutos = this.minutosHastaParada()[indice];
    if (minutos === undefined) return null;
    return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })
      .format(new Date(this.horaCalculoRuta() + minutos * 60000));
  }

  distanciaEnTexto(metros: number | null): string {
    if (metros === null) return '';
    if (metros < 1000) return `${Math.round(metros)} m`;
    return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
  }

  private renderizarMapa() {
    if (!this.mapa) return;

    this.capasRuta?.remove();
    this.capasRuta = L.layerGroup().addTo(this.mapa);
    this.marcadores.clear();
    const limites = L.latLngBounds([]);
    const inicio = this.ubicacionActual();

    if (inicio) {
      const iconoInicio = L.divIcon({
        className: 'marcador-inicio',
        html: '<i class="bi bi-truck"></i>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([inicio.latitud, inicio.longitud], { icon: iconoInicio }).addTo(this.capasRuta);
      limites.extend([inicio.latitud, inicio.longitud]);
    }

    const paradas = this.paradasVisibles();
    paradas.forEach(({ cliente: c }, i) => {
      if (c.latitud == null || c.longitud == null) return;
      const esDestino = i === paradas.length - 1;
      const iconoNumerado = L.divIcon({
        className: esDestino ? 'marcador-destino' : 'marcador-numerado',
        html: esDestino ? '<i class="bi bi-x-lg"></i>' : `<span>${i + 1}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const popup = document.createElement('div');
      const titulo = document.createElement('strong');
      titulo.textContent = `${i + 1}. ${c.apellido}, ${c.nombre}`;
      popup.append(titulo, document.createElement('br'), document.createTextNode(c.direccion ?? ''));
      const marcador = L.marker([c.latitud, c.longitud], { icon: iconoNumerado })
        .addTo(this.capasRuta!)
        .bindPopup(popup);
      this.marcadores.set(c.id, marcador);
      limites.extend([c.latitud, c.longitud]);
    });

    if (this.geometriaRuta.length > 0) {
      L.polyline(this.geometriaRuta, { color: '#fff7ef', weight: 7, opacity: 0.95 }).addTo(this.capasRuta);
      L.polyline(this.geometriaRuta, { color: '#e75a25', weight: 4, opacity: 0.95 }).addTo(this.capasRuta);
      limites.extend(L.latLngBounds(this.geometriaRuta));
    }

    if (limites.isValid()) {
      this.mapa.fitBounds(limites.pad(0.15), { maxZoom: 16 });
    } else {
      this.mapa.setView([-24.1858, -65.2995], 13);
    }
  }

  irACliente(id: string) {
    this.router.navigate(['/clientes', id]);
    this.cerrar.emit();
  }

  seleccionarParada(id: string) {
    const marcador = this.marcadores.get(id);
    if (!marcador || !this.mapa) return;
    this.mapa.flyTo(marcador.getLatLng(), Math.max(this.mapa.getZoom(), 15), { duration: 0.35 });
    marcador.openPopup();
  }

  iniciarNavegacion() {
    const siguiente = this.paradasVisibles()[0]?.cliente;
    if (siguiente?.latitud == null || siguiente.longitud == null) return;
    window.open(armarLinkGoogleMapsDestino(siguiente as Cliente & PuntoRuta), '_blank', 'noopener');
  }

  compartirPorWhatsapp() {
    const lista = this.paradasVisibles().map((parada) => parada.cliente);

    const lineas = lista.map((c, i) => {
      const direccion = c.direccion ? `\n📍 ${c.direccion}` : '';
      const telefono = c.telefono ? `\n📞 ${c.telefono}` : '';
      const deuda = c.saldoActual > 0 ? `\n💰 Debe $${c.saldoActual}` : '';
      return `${i + 1}. ${c.apellido}, ${c.nombre}${direccion}${telefono}${deuda}`;
    });

    const fechaHoy = new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const texto = `🚚 Ruta de Hoy (${fechaHoy})\n\n${lineas.join('\n\n')}\n\nParadas compartidas: ${lista.length}`;

    const encoded = encodeURIComponent(texto);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank', 'noopener');
  }

  clientesSinUbicacion(): number {
    return this.clientes().filter((c) => c.latitud == null || c.longitud == null).length;
  }

  private async obtenerUbicacionActual(): Promise<PuntoRuta> {
    if (Capacitor.isNativePlatform()) {
      const posicion = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000, // máximo 15 segundos esperando señal GPS
      });
      return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation || !window.isSecureContext) {
        reject(new Error('Geolocalización no disponible en este contexto'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  reintentar() {
    this.errorRuta.set(null);
    this.calculandoRuta.set(true);
    this.iniciarCalculoRuta();
  }
}
