import { Component, input, output, afterNextRender, effect, ElementRef, viewChild } from '@angular/core';
import * as L from 'leaflet';
import '../leaftlet-setup';


@Component({
  selector: 'app-mapa-cliente',
  imports: [],
  templateUrl: './mapa-cliente.html',
  styleUrl: './mapa-cliente.css',
})
export default class MapaCliente {
  latitud = input.required<number>();
  longitud = input.required<number>();
  editable = input<boolean>(false);

  posicionCambiada = output<{ latitud: number; longitud: number }>();

  private contenedor = viewChild.required<ElementRef<HTMLDivElement>>('mapaContenedor');
  private mapa?: L.Map;
  private marcador?: L.Marker;

  constructor() {
    effect(() => {
      const latitud = this.latitud();
      const longitud = this.longitud();

      if (!this.mapa || !this.marcador) return;
      this.marcador.setLatLng([latitud, longitud]);
      this.mapa.setView([latitud, longitud], Math.max(this.mapa.getZoom(), 17), {
        animate: true,
      });
    });

    afterNextRender(() => {
      this.mapa = L.map(this.contenedor().nativeElement, {
        zoomControl: false,
        attributionControl: false,
      }).setView([this.latitud(), this.longitud()], 17);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.mapa);

      this.marcador = L.marker([this.latitud(), this.longitud()]).addTo(this.mapa);

      setTimeout(() => {
        this.mapa?.invalidateSize();
      }, 100);

      this.mapa.on('click', (evento: L.LeafletMouseEvent) => {
        if (!this.editable()) return;

        const { lat, lng } = evento.latlng;
        this.marcador!.setLatLng([lat, lng]);
        this.posicionCambiada.emit({ latitud: lat, longitud: lng });
      });
    });
  }
}
