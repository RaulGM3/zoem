import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CasosService } from '../../core/services/casos.service';
import { PlantillasService } from '../../core/services/plantillas.service';
import { ContactService } from '../../core/services/contact.service';
import { SearchService } from '../../core/services/search.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import type { Caso, CasoEstado, CasoTipo, CasoPrioridad, CreateCasoData, Contact } from '../../interfaces';
import { getContactDisplayName } from '../../interfaces';

type DrawerInitialData = { titulo?: string; descripcion?: string; tipo?: CasoTipo; prioridad?: CasoPrioridad; estado?: CasoEstado };
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
  private readonly route = inject(ActivatedRoute);
  private readonly casosService = inject(CasosService);
  private readonly plantillasService = inject(PlantillasService);
  private readonly contactService = inject(ContactService);
  private readonly searchSvc = inject(SearchService);
  readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);

  /** Búsqueda centralizada en el header — scopeada a "casos". */
  readonly search = this.searchSvc.termFor('casos');
  readonly filterEstado = signal('');
  readonly filterTipo = signal('');
  readonly showDrawer = signal(false);
  readonly saving = signal(false);
  readonly drawerInitialContact = signal<Contact | null>(null);
  readonly drawerInitialData = signal<DrawerInitialData | null>(null);

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

  /**
   * Subtítulo de cada fila (casoId → texto). Lista todos los clientes del caso
   * separados por coma; si el caso no tiene contactos, cae a la descripción.
   * Devuelve el texto COMPLETO: el truncado visual lo decide la tabla.
   * El join contra contactos vive en el contenedor: la tabla solo pinta.
   */
  readonly subtitulos = computed<Record<string, string>>(() => {
    const nombrePorId = new Map(
      this.contactService.contacts().map(c => [c.id, getContactDisplayName(c)]),
    );
    const map: Record<string, string> = {};
    for (const caso of this.casosService.casos()) {
      const clientes = (caso.contactoIds ?? [])
        .map(id => nombrePorId.get(id))
        .filter((n): n is string => !!n);
      map[caso.id] = clientes.length ? clientes.join(', ') : (caso.descripcion ?? '');
    }
    return map;
  });

  readonly total = computed(() => this.casosService.casos().length);
  readonly enProceso = computed(() => this.casosService.casos().filter(c => c.estado === 'en_proceso').length);
  readonly pendientes = computed(() => this.casosService.casos().filter(c => c.estado === 'pendiente').length);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.casosService.loadCasos(),
      this.plantillasService.loadPlantillas(),
      this.contactService.loadContacts(),
    ]);

    const p = this.route.snapshot.queryParamMap;
    if (p.get('newCaso') === '1') {
      const contactId = p.get('contactId');
      if (contactId) {
        const contact = this.contactService.contacts().find(c => c.id === contactId) ?? null;
        this.drawerInitialContact.set(contact);
      }
      const navState = history.state as DrawerInitialData | null;
      if (navState?.titulo || navState?.descripcion || navState?.tipo || navState?.prioridad || navState?.estado) {
        this.drawerInitialData.set(navState);
      }
      this.showDrawer.set(true);
    }
  }

  async saveNuevoCaso(data: CreateCasoData): Promise<void> {
    this.saving.set(true);
    try {
      const id = await this.toast.run(() => this.casosService.createCaso(data), {
        errorTitle: 'No se pudo crear el caso',
      });
      if (id === undefined) return; // falló: el toast ya avisó, el drawer queda abierto
      this.showDrawer.set(false);
      this.drawerInitialContact.set(null);
      this.drawerInitialData.set(null);

      const contactId = data.contactoIds?.[0];
      if (contactId) {
        const contact = this.contactService.contacts().find(c => c.id === contactId);
        if (contact?.status === 'potencial') {
          await this.toast.run(() => this.contactService.updateContact(contactId, { status: 'activo' }));
        }
      }

      this.router.navigate(['/casos', id]);
    } finally {
      this.saving.set(false);
    }
  }

  navigateTo(caso: Caso): void {
    this.router.navigate(['/casos', caso.id]);
  }

  goToContactos(): void {
    this.showDrawer.set(false);
    this.router.navigate(['/contactos']);
  }

  async onDeleteCaso(caso: Caso): Promise<void> {
    await this.toast.run(() => this.casosService.deleteCaso(caso.id), {
      successMessage: 'Caso eliminado',
      errorTitle: 'No se pudo eliminar el caso',
    });
  }
}
