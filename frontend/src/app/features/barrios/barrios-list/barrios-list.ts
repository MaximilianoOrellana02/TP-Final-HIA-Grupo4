import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BarrioService } from '../../../core/services/barrio.service';
import { Barrio, DIAS_SEMANA, DiaSemana } from '../../../core/models/barrio.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-barrios-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './barrios-list.html',
  styleUrl: './barrios-list.css',
})
export default class BarriosList implements OnInit {
  private barrioService = inject(BarrioService);
  private notificationService = inject(NotificationService);

  dias = DIAS_SEMANA;
  barrios = signal<Barrio[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  editandoId = signal<string | null>(null);
  nombreNuevo = '';
  diasSeleccionNuevo = signal<Set<DiaSemana>>(new Set());
  diasSeleccionEdicion = signal<Set<DiaSemana>>(new Set());
  agregando = signal(false);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.barrioService.listar().subscribe({
      next: (data) => {
        this.barrios.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los barrios');
        this.cargando.set(false);
      },
    });
  }

  toggleDiaNuevo(dia: DiaSemana) {
    const set = new Set(this.diasSeleccionNuevo());
    set.has(dia) ? set.delete(dia) : set.add(dia);
    this.diasSeleccionNuevo.set(set);
  }

  agregar() {
    if (!this.nombreNuevo.trim()) return;

    this.agregando.set(true);
    this.error.set(null);

    this.barrioService
      .crear(this.nombreNuevo.trim())
      .subscribe({
        next: (barrio) => {
          const dias = Array.from(this.diasSeleccionNuevo());
          if (dias.length > 0) {
            this.barrioService.actualizar(barrio.id, { diasVisita: dias }).subscribe({
              next: (actualizado) => this.agregarALista(actualizado),
              error: (err) => {
                this.agregarALista(barrio);
                this.error.set(err.error?.error ?? 'El barrio se creó pero no se pudieron guardar los días');
              },
            });
          } else {
            this.agregarALista(barrio);
          }
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'No se pudo crear el barrio');
          this.agregando.set(false);
        },
      });
  }

  private agregarALista(barrio: Barrio) {
    this.barrios.update((lista) => [...lista, barrio].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    this.nombreNuevo = '';
    this.diasSeleccionNuevo.set(new Set());
    this.agregando.set(false);
    this.notificationService.mostrar(`Barrio ${barrio.nombre} creado correctamente.`, 'success');
  }

  editar(barrio: Barrio) {
    this.editandoId.set(barrio.id);
    this.diasSeleccionEdicion.set(new Set(barrio.diasVisita));
  }

  toggleDiaEdicion(dia: DiaSemana) {
    const set = new Set(this.diasSeleccionEdicion());
    set.has(dia) ? set.delete(dia) : set.add(dia);
    this.diasSeleccionEdicion.set(set);
  }

  guardarEdicion(barrio: Barrio) {
    const dias = Array.from(this.diasSeleccionEdicion());
    this.barrioService.actualizar(barrio.id, { diasVisita: dias }).subscribe({
      next: (actualizado) => {
        this.barrios.update((lista) => lista.map((b) => (b.id === actualizado.id ? actualizado : b)));
        this.editandoId.set(null);
        this.notificationService.mostrar(`Barrio ${actualizado.nombre} actualizado.`, 'success');
      },
      error: (err) => this.error.set(err.error?.error ?? 'No se pudo guardar'),
    });
  }

  cancelarEdicion() {
    this.editandoId.set(null);
  }

  eliminar(barrio: Barrio) {
    this.notificationService.confirmar(
      'Eliminar barrio',
      `¿Querés eliminar "${barrio.nombre}"?`,
      () => this.confirmarEliminacion(barrio),
      'Eliminar',
      { advertencia: 'Solo se puede eliminar si no tiene clientes activos.' },
    );
  }

  private confirmarEliminacion(barrio: Barrio) {
    this.barrioService.eliminar(barrio.id).subscribe({
      next: () => {
        this.barrios.update((lista) => lista.filter((b) => b.id !== barrio.id));
        this.notificationService.mostrar(`Barrio ${barrio.nombre} eliminado.`, 'success');
      },
      error: (err) => this.error.set(err.error?.error ?? 'No se pudo eliminar el barrio'),
    });
  }

  etiquetaDias(dias: DiaSemana[]): string {
    if (dias.length === 0) return 'Sin días asignados';
    return dias.map((d) => this.dias.find((x) => x.valor === d)?.etiqueta.slice(0, 3)).join(', ');
  }
}
