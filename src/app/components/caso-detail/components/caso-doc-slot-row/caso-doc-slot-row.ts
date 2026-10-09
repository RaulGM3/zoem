import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import {
  LucideAngularModule, CheckCircle2, FileText, FilePen, Loader, Upload, Trash2, Eye, History, Lock,
} from 'lucide-angular';
import type { CasoDocSlot } from '../../../../interfaces';
import { AlmacenamientoCupoService } from '../../../../core/planes/almacenamiento-cupo.service';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';

/**
 * Fila de un documento requerido por la plantilla (slot) en la pestaña de
 * documentos del caso. Presentacional: solo avisa de la acción elegida.
 */
@Component({
  selector: 'app-caso-doc-slot-row',
  host: { class: 'block' },
  imports: [LucideAngularModule, ActionMenuComponent],
  templateUrl: './caso-doc-slot-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDocSlotRowComponent {
  readonly slot = input.required<CasoDocSlot>();
  readonly canEdit = input(true);
  readonly canDelete = input(true);
  readonly isAdmin = input(false);
  /** El slot tiene una subida o un borrado en curso. */
  readonly uploading = input(false);

  /** Abrir el generador: rellenar un slot con plantilla o ver el ya generado. */
  readonly generate = output<void>();
  readonly upload = output<File>();
  readonly preview = output<void>();
  readonly history = output<void>();
  readonly access = output<void>();
  readonly remove = output<void>();

  protected readonly bp = inject(BreakpointService);
  private readonly cupo = inject(AlmacenamientoCupoService);

  /** Clases de los botones de icono de escritorio (hover vía Tailwind, sin handlers inline). */
  protected readonly iconBtn =
    'p-1.5 rounded-lg transition-colors duration-150 text-[color:var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[color:var(--text-muted)]';

  /** Acciones del menú móvil (⋯) de un slot subido: mismas que los iconos de escritorio. */
  readonly acciones = computed<MenuAction[]>(() => {
    const s = this.slot();
    if (s.docTemplateId || s.status !== 'subido') return [];
    const out: MenuAction[] = [];
    if (s.downloadUrl || (s.clasificado && s.storagePath)) out.push({ id: 'preview', label: 'Previsualizar', icon: Eye });
    out.push({ id: 'history', label: 'Ver historial', icon: History });
    if (this.isAdmin()) out.push({ id: 'access', label: 'Gestionar acceso', icon: Lock });
    if (this.canDelete()) out.push({ id: 'remove', label: 'Quitar documento', icon: Trash2, danger: true, disabled: this.uploading() });
    return out;
  });

  /** Ejecuta una acción del menú móvil emitiendo el mismo output que el icono de escritorio. */
  ejecutar(id: string): void {
    switch (id) {
      case 'preview': this.preview.emit(); break;
      case 'history': this.history.emit(); break;
      case 'access': this.access.emit(); break;
      case 'remove': this.remove.emit(); break;
    }
  }

  readonly CheckCircle2Icon = CheckCircle2;
  readonly FileTextIcon = FileText;
  readonly FilePenIcon = FilePen;
  readonly LoaderIcon = Loader;
  readonly UploadIcon = Upload;
  readonly Trash2Icon = Trash2;
  readonly EyeIcon = Eye;
  readonly HistoryIcon = History;
  readonly LockIcon = Lock;

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  triggerUpload(): void {
    // Sin cupo ni se abre el selector: el servicio muestra el modal de mejora.
    if (!this.cupo.puedeSubir()) return;
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const [file] = this.cupo.admitir(Array.from(target.files ?? []).slice(0, 1));
    if (file) this.upload.emit(file);
    target.value = '';
  }
}
