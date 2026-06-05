import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CasosService } from '../../core/services/casos.service';
import { PlantillasService } from '../../core/services/plantillas.service';
import type { Caso, CasoEstado, CasoTipo, CreateCasoData } from '../../interfaces';
import { CasosHeaderComponent } from './components/casos-header/casos-header';
import { CasosStatsComponent } from './components/casos-stats/casos-stats';
import { CasosFilterBarComponent } from './components/casos-filter-bar/casos-filter-bar';
import { CasosTableComponent } from './components/casos-table/casos-table';
import { NuevoCasoDrawerComponent } from './components/nuevo-caso-drawer/nuevo-caso-drawer';

@Component({
  selector: 'app-casos',
  imports: [
    CasosHeaderComponent,
    CasosStatsComponent,
    CasosFilterBarComponent,
    CasosTableComponent,
    NuevoCasoDrawerComponent,
  ],
  templateUrl: './casos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly casosService = inject(CasosService);
  private readonly plantillasService = inject(PlantillasService);

  readonly search = signal('');
  readonly filterEstado = signal('');
  readonly filterTipo = signal('');
  readonly showDrawer = signal(false);
  readonly saving = signal(false);

  readonly estados: readonly CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
  readonly tipos: readonly CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];

  readonly loading = this.casosService.loading;
  readonly plantillas = this.plantillasService.plantillas;

  readonly filteredCasos = computed(() => {
    const q = this.search().toLowerCase();
    const e = this.filterEstado();
    const t = this.filterTipo();
    return this.casosService.casos().filter(c => {
      const matchSearch = !q || c.titulo.toLowerCase().includes(q) || (c.descripcion ?? '').toLowerCase().includes(q);
      const matchEstado = !e || c.estado === e;
      const matchTipo = !t || c.tipo === t;
      return matchSearch && matchEstado && matchTipo;
    });
  });

  readonly total = computed(() => this.casosService.casos().length);
  readonly enProceso = computed(() => this.casosService.casos().filter(c => c.estado === 'en_proceso').length);
  readonly pendientes = computed(() => this.casosService.casos().filter(c => c.estado === 'pendiente').length);
  readonly urgentes = computed(() => this.casosService.casos().filter(c => c.estado === 'urgente').length);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.casosService.loadCasos(),
      this.plantillasService.loadPlantillas(),
    ]);
  }

  async saveNuevoCaso(data: CreateCasoData): Promise<void> {
    this.saving.set(true);
    try {
      const id = await this.casosService.createCaso(data);
      this.showDrawer.set(false);
      this.router.navigate(['/casos', id]);
    } finally {
      this.saving.set(false);
    }
  }

  navigateTo(caso: Caso): void {
    this.router.navigate(['/casos', caso.id]);
  }

  async onDeleteCaso(caso: Caso): Promise<void> {
    await this.casosService.deleteCaso(caso.id);
  }
}
