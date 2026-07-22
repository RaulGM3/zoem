import {
  Component, OnDestroy, signal, computed, effect, untracked,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, map, of, switchMap } from 'rxjs';
import { CasosService, ActividadInput } from '../../core/services/casos.service';
import { ToastService } from '../../core/services/toast.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { ContactService } from '../../core/services/contact.service';
import { UsersService } from '../../core/services/users';
import { UserSyncService } from '../../core/services/user-sync.service';
import { CasoDocService } from '../../core/services/caso-doc.service';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { PermissionService } from '../../core/services/permission.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { cycleHitoEstado, stampEstadoChange } from '../../core/hitos/hito-estado';
import {
  Caso, CasoDocSlot, CasoDocFile,
  GestoriaSlot, Hito, HitoActividad,
  getContactDisplayName,
} from '../../interfaces';
import { CasoDetailHeaderComponent, CasoTab } from './components/caso-detail-header/caso-detail-header';
import { CasoInfoTabComponent, CasoInfoFormData } from './components/caso-info-tab/caso-info-tab';
import { CasoHitosTabComponent } from './components/caso-hitos-tab/caso-hitos-tab';
import { CasoGestoriaTabComponent } from './components/caso-gestoria-tab/caso-gestoria-tab';
import {
  CasoDocumentosTabComponent, DocUploadEvent,
  FreeUploadEvent, CreateFolderEvent, ReuploadEvent,
} from './components/caso-documentos-tab/caso-documentos-tab';
import { HitoFormDrawerComponent, HitoFormData } from './components/hito-form-drawer/hito-form-drawer';
import { MovimientoFormDrawerComponent, MovimientoFormData } from './components/movimiento-form-drawer/movimiento-form-drawer';

@Component({
  selector: 'app-caso-detail',
  imports: [
    RouterLink,
    CasoDetailHeaderComponent,
    CasoInfoTabComponent,
    CasoHitosTabComponent,
    CasoGestoriaTabComponent,
    CasoDocumentosTabComponent,
    HitoFormDrawerComponent,
    MovimientoFormDrawerComponent,
  ],
  templateUrl: './caso-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly casosService = inject(CasosService);
  private readonly toast = inject(ToastService);
  readonly gestoriaService = inject(GestoriaService);
  readonly contactService = inject(ContactService);
  readonly usersService = inject(UsersService);
  private readonly userSync = inject(UserSyncService);
  readonly casoDocService = inject(CasoDocService);
  private readonly uploadQueue = inject(UploadQueueService);
  readonly permissionService = inject(PermissionService);
  readonly cuentasService = inject(CuentasService);
  readonly cuentas = this.cuentasService.cuentas;
  readonly miembrosMap = computed(() =>
    new Map(this.usersService.members().map(m => [m.userId, m.nombre]))
  );

  readonly caso = signal<Caso | null>(null);
  readonly loading = signal(true);

  // `casoId` deriva de `route.paramMap` (no de `route.snapshot`, capturado una
  // sola vez): el RouteReuseStrategy por defecto de Angular reutiliza esta misma
  // instancia de componente al navegar entre /casos/A → /casos/B (misma
  // routeConfig), sin volver a ejecutar el constructor. Si `casoId` fuera un
  // campo fijo, todo lo derivado (hitos, actividad, mutaciones) seguiría
  // apuntando al caso anterior tras navegar a uno nuevo.
  readonly casoId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id')!)),
    { initialValue: this.route.snapshot.paramMap.get('id')! }
  );
  private readonly casoId$ = toObservable(this.casoId);
  private readonly isAdmin$ = toObservable(this.permissionService.isAdmin);

  // Los hitos y su feed de actividad son streams real-time (no estado a mano).
  // La vista reacciona en vivo a cualquier cambio, propio o de otro usuario, y
  // se re-suscriben automáticamente cuando cambia `casoId` (switchMap).
  readonly hitos = toSignal(
    this.casoId$.pipe(switchMap(id => this.casosService.hitosStream(id))),
    { initialValue: [] as Hito[] }
  );
  // El feed de actividad solo se pide al servidor si el usuario es admin: para
  // el resto ni siquiera se suscribe (antes solo se ocultaba el botón en el
  // template, pero el feed completo ya viajaba al cliente para cualquier rol).
  readonly actividad = toSignal(
    combineLatest([this.casoId$, this.isAdmin$]).pipe(
      switchMap(([id, isAdmin]) => isAdmin ? this.casosService.actividadStream(id) : of([] as HitoActividad[]))
    ),
    { initialValue: [] as HitoActividad[] }
  );

  /** Permiso de edición de Casos (info, hitos, gestoría, documentos). */
  readonly canEditCasos = computed(() => this.permissionService.can('Casos', 'editar'));
  /** Permiso de eliminación de Casos (hitos, movimientos, documentos, carpetas). */
  readonly canDeleteCasos = computed(() => this.permissionService.can('Casos', 'eliminar'));

  // El tab activo es derivado de la URL (?tab=...), no de estado local.
  // La URL es la fuente de verdad: deep linking + back button gratis.
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly activeTab = computed<CasoTab>(() => {
    const tab = this.queryParams().get('tab');
    return tab === 'hitos' || tab === 'gestoria' || tab === 'documentos' ? tab : 'info';
  });

  setTab(tab: CasoTab): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'info' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  // Info
  readonly editingInfo = signal(false);
  readonly savingInfo = signal(false);

  // Contacts
  // contactSearch = valor inmediato (bindeado al input para que escribir sea instantáneo).
  // debouncedSearch = lo que realmente dispara el filtrado, 250ms después del último keystroke.
  readonly contactSearch = signal('');
  private readonly debouncedSearch = toSignal(
    toObservable(this.contactSearch).pipe(debounceTime(250)),
    { initialValue: '' }
  );
  readonly contactSearchResults = computed(() => {
    const q = this.debouncedSearch().toLowerCase().trim();
    if (!q || q.length < 2) return [];
    const linked = this.caso()?.contactoIds ?? [];
    return this.contactService.contacts()
      .filter(c => !linked.includes(c.id) && getContactDisplayName(c).toLowerCase().includes(q))
      .slice(0, 5);
  });
  // Hay búsqueda activa (>=2 chars, ya debounceada) pero ningún contacto matcheó.
  readonly noContactResults = computed(() =>
    this.debouncedSearch().trim().length >= 2 && this.contactSearchResults().length === 0
  );
  readonly linkedContacts = computed(() => {
    const ids = this.caso()?.contactoIds ?? [];
    return this.contactService.contacts().filter(c => ids.includes(c.id));
  });

  // Hitos
  readonly showHitoForm = signal(false);
  readonly editingHito = signal<Hito | null>(null);
  readonly savingHito = signal(false);

  // Documentos
  readonly uploadingSlotId = signal<string | null>(null);
  // busy = carpetas/archivos libres (upload libre, crear/borrar carpeta, borrar file).
  readonly docsBusy = signal(false);

  readonly docsProgress = computed(() => {
    const slots = this.casoDocService.slots();
    if (slots.length === 0) return null;
    const subidos = slots.filter(s => s.status === 'subido' || s.status === 'generado').length;
    return { subidos, total: slots.length };
  });

  // Datos del caso para pre-rellenar las variables de las plantillas de documento.
  // Claves "token" que se buscan por coincidencia laxa contra clave/etiqueta de cada variable.
  readonly casoDocContext = computed<Record<string, string>>(() => {
    const c = this.caso();
    const contactos = this.linkedContacts();
    const cliente = (contactos[0] ? getContactDisplayName(contactos[0]) : '') ?? '';
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      titulo: c?.titulo ?? '',
      asunto: c?.titulo ?? '',
      caso: c?.titulo ?? '',
      tipo: c?.tipo ?? '',
      descripcion: c?.descripcion ?? '',
      cliente,
      contacto: cliente,
      nombre: cliente,
      fecha: hoy,
      hoy,
      vencimiento: c?.vencimiento ?? '',
    };
  });

  // Gestoría
  readonly showMovForm = signal(false);
  readonly registeringSlot = signal<GestoriaSlot | null>(null);
  readonly savingMov = signal(false);

  // Header badge counts
  readonly gestoriaPending = computed(() => this.gestoriaService.slots().filter(s => s.status === 'pendiente').length);
  readonly docsPending = computed(() => this.casoDocService.slots().filter(s => s.status === 'pendiente').length);

  constructor() {
    // Recarga todo el estado del caso cada vez que `casoId` cambia (incluida la
    // primera vez): cubre tanto la carga inicial como la navegación entre casos
    // con la instancia de componente reutilizada.
    effect(() => {
      const id = this.casoId();
      untracked(() => void this.loadCaso(id));
    });

    // Si el usuario cambia de tab con una edición de info a medias, se descarta
    // el borrador: al volver a "info" el formulario se re-siembra desde el
    // `caso()` actual (ver efecto del formulario en CasoInfoTabComponent), y
    // dejar `editingInfo` en true resucitaría un formulario "editando" vacío o
    // con datos obsoletos.
    effect(() => {
      if (this.activeTab() !== 'info') {
        untracked(() => this.editingInfo.set(false));
      }
    });
  }

  ngOnDestroy(): void {
    this.cuentasService.stopCuentas();
  }

  private async loadCaso(id: string): Promise<void> {
    this.loading.set(true);
    this.caso.set(null);
    this.editingInfo.set(false);
    this.cuentasService.stopCuentas();
    this.cuentasService.loadCuentas();
    await Promise.all([
      this.contactService.loadContacts(),
      this.usersService.loadMembers(),
      this.gestoriaService.loadMovimientos(id),
      this.gestoriaService.loadSlots(id),
      this.casoDocService.load(id),
    ]);
    const caso = await this.casosService.getCaso(id);
    this.caso.set(caso);
    this.loading.set(false);
  }

  // ── Info ───────────────────────────────────────────────

  startEditInfo(): void {
    if (!this.canEditCasos()) return;
    this.editingInfo.set(true);
    this.setTab('info');
  }

  async onSaveInfo(data: CasoInfoFormData): Promise<void> {
    if (!this.canEditCasos()) return;
    const id = this.caso()?.id;
    if (!id) return;
    this.savingInfo.set(true);
    try {
      await this.toast.run(
        async () => {
          await this.casosService.updateCaso(id, data);
          this.caso.set(await this.casosService.getCaso(id));
        },
        {
          successMessage: 'Caso actualizado',
          errorTitle: 'No se pudo actualizar el caso',
          onSuccess: () => this.editingInfo.set(false),
        }
      );
    } finally {
      this.savingInfo.set(false);
    }
  }

  // ── Contacts ───────────────────────────────────────────

  async addContact(contactId: string): Promise<void> {
    if (!this.canEditCasos()) return;
    const c = this.caso();
    if (!c) return;
    const newIds = [...(c.contactoIds ?? []), contactId];
    await this.toast.run(() => this.casosService.updateCaso(c.id, { contactoIds: newIds }), {
      errorTitle: 'No se pudo añadir el contacto',
      onSuccess: () => {
        this.caso.set({ ...c, contactoIds: newIds });
        this.contactSearch.set('');
      },
    });
  }

  async removeContact(contactId: string): Promise<void> {
    if (!this.canEditCasos()) return;
    const c = this.caso();
    if (!c) return;
    const newIds = c.contactoIds.filter(id => id !== contactId);
    await this.toast.run(() => this.casosService.updateCaso(c.id, { contactoIds: newIds }), {
      errorTitle: 'No se pudo quitar el contacto',
      onSuccess: () => this.caso.set({ ...c, contactoIds: newIds }),
    });
  }

  // ── Hitos ──────────────────────────────────────────────

  openNewHitoForm(): void {
    if (!this.canEditCasos()) return;
    this.editingHito.set(null);
    this.showHitoForm.set(true);
  }

  startEditHito(hito: Hito): void {
    if (!this.canEditCasos()) return;
    this.editingHito.set(hito);
    this.showHitoForm.set(true);
  }

  async onSaveHito(data: HitoFormData): Promise<void> {
    if (!this.canEditCasos()) return;
    const c = this.caso();
    if (!c) return;
    this.savingHito.set(true);
    try {
      const editing = this.editingHito();
      const autorId = this.userSync.currentUser()?.id;
      const estadoChanged = !editing || editing.estado !== data.estado;
      const hitoData = {
        titulo: data.titulo,
        estado: data.estado,
        ...(data.descripcion ? { descripcion: data.descripcion } : {}),
        ...(data.fechaEstimada ? { fechaEstimada: data.fechaEstimada } : {}),
        ...(data.asignadoA ? { asignadoA: data.asignadoA } : {}),
        ...(data.asignadosA ? { asignadosA: data.asignadosA } : {}),
        ...(estadoChanged ? stampEstadoChange(autorId) : {}),
      };

      const actividad: ActividadInput = estadoChanged
        ? { hitoTitulo: data.titulo, tipo: 'estado', autorId, estadoAnterior: editing?.estado, estadoNuevo: data.estado }
        : { hitoTitulo: data.titulo, tipo: 'editado', autorId };
      await this.toast.run(
        async () => {
          if (editing) {
            await this.casosService.updateHito(c.id, editing.id, hitoData, actividad);
          } else {
            // addHito ya registra el evento 'creado' internamente.
            await this.casosService.addHito(c.id, c.titulo, { ...hitoData, orden: this.hitos().length }, autorId);
          }
        },
        {
          successMessage: editing ? 'Hito actualizado' : 'Hito creado',
          errorTitle: 'No se pudo guardar el hito',
          onSuccess: () => this.showHitoForm.set(false),
        }
      );
    } finally {
      this.savingHito.set(false);
    }
  }

  /**
   * Convierte las horas declaradas (no facturadas) de un hito en honorarios de
   * gestoría, agrupando por miembro y aplicando su tarifa. Refresca el caso para
   * reflejar el nuevo total de honorarios en el resumen financiero.
   */
  async facturarHorasHito(hito: Hito): Promise<void> {
    const c = this.caso();
    if (!c) return;
    await this.toast.run(
      async () => {
        await this.casosService.facturarHorasHito(c.id, hito, this.usersService.members());
        await Promise.all([
          this.gestoriaService.loadMovimientos(c.id),
          (async () => this.caso.set(await this.casosService.getCaso(c.id)))(),
        ]);
      },
      { successMessage: 'Horas facturadas', errorTitle: 'No se pudieron facturar las horas' }
    );
  }

  async deleteHito(hitoId: string): Promise<void> {
    if (!this.canDeleteCasos()) return;
    const c = this.caso();
    if (!c) return;
    const hito = this.hitos().find(h => h.id === hitoId);
    await this.toast.run(
      () => this.casosService.deleteHito(c.id, hitoId, {
        hitoTitulo: hito?.titulo ?? 'hito',
        autorId: this.userSync.currentUser()?.id,
      }),
      { successMessage: 'Hito eliminado', errorTitle: 'No se pudo eliminar el hito' }
    );
  }

  async toggleHitoEstado(hito: Hito): Promise<void> {
    if (!this.canEditCasos()) return;
    const c = this.caso();
    if (!c) return;
    const autorId = this.userSync.currentUser()?.id;
    const nuevoEstado = cycleHitoEstado(hito.estado);
    const patch = {
      estado: nuevoEstado,
      ...stampEstadoChange(autorId),
    };
    await this.toast.run(
      () => this.casosService.updateHito(c.id, hito.id, patch, {
        hitoTitulo: hito.titulo,
        tipo: 'estado',
        autorId,
        estadoAnterior: hito.estado,
        estadoNuevo: nuevoEstado,
      }),
      { errorTitle: 'No se pudo cambiar el estado del hito' }
    );
  }

  // ── Gestoría ───────────────────────────────────────────

  openMovForm(): void {
    if (!this.canEditCasos()) return;
    this.registeringSlot.set(null);
    this.showMovForm.set(true);
  }

  openRegistrarSlot(slot: GestoriaSlot): void {
    if (!this.canEditCasos()) return;
    this.registeringSlot.set(slot);
    this.showMovForm.set(true);
  }

  async onSaveMov(data: MovimientoFormData): Promise<void> {
    if (!this.canEditCasos()) return;
    const c = this.caso();
    if (!c) return;
    this.savingMov.set(true);
    try {
      const movData = {
        tipo: data.tipo,
        concepto: data.concepto,
        importe: data.importe,
        esEntrada: data.esEntrada,
        fecha: data.fecha,
        notas: data.notas,
        cuentaId: data.cuentaId,
        tipoIva: data.tipoIva,
        ivaExento: data.ivaExento,
        baseImponible: data.baseImponible,
        cuotaIva: data.cuotaIva,
      };
      const slot = this.registeringSlot();
      await this.toast.run(
        async () => {
          if (slot) {
            await this.gestoriaService.registerSlot(c.id, slot, movData);
          } else {
            await this.gestoriaService.addMovimiento(c.id, movData);
          }
          this.caso.set(await this.casosService.getCaso(c.id));
        },
        {
          successMessage: 'Movimiento registrado',
          errorTitle: 'No se pudo registrar el movimiento',
          onSuccess: () => {
            this.registeringSlot.set(null);
            this.showMovForm.set(false);
          },
        }
      );
    } finally {
      this.savingMov.set(false);
    }
  }

  async deleteMovimiento(movId: string): Promise<void> {
    if (!this.canDeleteCasos()) return;
    const c = this.caso();
    if (!c) return;
    await this.toast.run(
      async () => {
        await this.gestoriaService.deleteMovimiento(c.id, movId);
        this.caso.set(await this.casosService.getCaso(c.id));
      },
      { successMessage: 'Movimiento eliminado', errorTitle: 'No se pudo eliminar el movimiento' }
    );
  }

  async unregisterSlot(slot: GestoriaSlot): Promise<void> {
    // unregisterSlot borra permanentemente el movimiento vinculado (deleteDoc):
    // exige el mismo permiso que cualquier otro borrado, no solo "editar".
    if (!this.canDeleteCasos()) return;
    const c = this.caso();
    if (!c) return;
    await this.toast.run(() => this.gestoriaService.unregisterSlot(c.id, slot), {
      errorTitle: 'No se pudo eliminar el movimiento del slot',
    });
  }

  async reorderSlots(orderedSlots: GestoriaSlot[]): Promise<void> {
    if (!this.canEditCasos()) return;
    const c = this.caso();
    if (!c) return;
    await this.toast.run(() => this.gestoriaService.reorderSlots(c.id, orderedSlots), {
      errorTitle: 'No se pudo reordenar',
    });
  }

  closeMovForm(): void {
    this.registeringSlot.set(null);
    this.showMovForm.set(false);
  }

  // ── Documentos ─────────────────────────────────────────

  onUploadSlot(event: DocUploadEvent): void {
    if (!this.canEditCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId || this.uploadingSlotId() === event.slot.id) return;
    this.uploadingSlotId.set(event.slot.id);
    this.uploadQueue.enqueue(
      () => this.casoDocService.uploadSlot(casoId, event.slot, event.file),
      event.file.name,
      {
        successMessage: 'Documento subido',
        errorTitle: 'No se pudo subir el documento',
        onFinally: () => this.uploadingSlotId.set(null),
      },
    );
  }

  async onRemoveSlot(slot: CasoDocSlot): Promise<void> {
    if (!this.canDeleteCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    this.uploadingSlotId.set(slot.id);
    try {
      await this.toast.run(() => this.casoDocService.removeUpload(casoId, slot), {
        errorTitle: 'No se pudo quitar el documento',
      });
    } finally {
      this.uploadingSlotId.set(null);
    }
  }

  async onGenerateDoc(event: { slot: CasoDocSlot; html: string; values: Record<string, string> }): Promise<void> {
    if (!this.canEditCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    await this.toast.run(
      () => this.casoDocService.saveGeneratedDoc(casoId, event.slot, event.html, event.values),
      { successMessage: 'Documento generado', errorTitle: 'No se pudo generar el documento' }
    );
  }

  onUploadFile(event: FreeUploadEvent): void {
    if (!this.canEditCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    this.uploadQueue.enqueue(
      () => this.casoDocService.uploadFile(casoId, event.folderId, event.file, {
        clasificado: event.clasificado,
      }),
      event.file.name,
      {
        successMessage: 'Archivo subido',
        errorTitle: 'No se pudo subir el archivo',
      },
    );
  }

  onReuploadFile(event: ReuploadEvent): void {
    if (!this.canEditCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    this.uploadQueue.enqueue(
      () => this.casoDocService.reuploadFile(casoId, event.file, event.newFile),
      event.newFile.name,
      {
        successMessage: 'Nueva versión subida',
        errorTitle: 'No se pudo subir la nueva versión',
      },
    );
  }

  async onDeleteFile(file: CasoDocFile): Promise<void> {
    if (!this.canDeleteCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    this.docsBusy.set(true);
    try {
      await this.toast.run(() => this.casoDocService.deleteFile(casoId, file), {
        successMessage: 'Archivo eliminado',
        errorTitle: 'No se pudo eliminar el archivo',
      });
    } finally {
      this.docsBusy.set(false);
    }
  }

  async onCreateFolder(event: CreateFolderEvent): Promise<void> {
    if (!this.canEditCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    this.docsBusy.set(true);
    try {
      await this.toast.run(() => this.casoDocService.createFolder(casoId, event.parentId, event.name), {
        errorTitle: 'No se pudo crear la carpeta',
      });
    } finally {
      this.docsBusy.set(false);
    }
  }

  async onDeleteFolder(folderId: string): Promise<void> {
    if (!this.canDeleteCasos()) return;
    const casoId = this.caso()?.id;
    if (!casoId) return;
    this.docsBusy.set(true);
    try {
      await this.toast.run(() => this.casoDocService.deleteFolder(casoId, folderId), {
        successMessage: 'Carpeta eliminada',
        errorTitle: 'No se pudo eliminar la carpeta',
      });
    } finally {
      this.docsBusy.set(false);
    }
  }
}
