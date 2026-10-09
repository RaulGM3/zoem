import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import {
  LucideAngularModule, FileText, Download, Trash2, Eye, Check, X, History, RefreshCw, Lock,
} from 'lucide-angular';
import type { CasoDocFile } from '../../../../interfaces';
import { AlmacenamientoCupoService } from '../../../../core/planes/almacenamiento-cupo.service';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { ActionMenuComponent, type MenuAction } from '../../../../shared/components/action-menu/action-menu';

/**
 * Fila de un archivo libre en la pestaña de documentos del caso.
 * Presentacional: solo avisa de la acción elegida.
 */
@Component({
  selector: 'app-caso-doc-file-row',
  host: { class: 'block' },
  imports: [LucideAngularModule, ActionMenuComponent],
  templateUrl: './caso-doc-file-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDocFileRowComponent {
  readonly file = input.required<CasoDocFile>();
  readonly canEdit = input(true);
  readonly canDelete = input(true);
  readonly isAdmin = input(false);
  /** El padre decide qué fila está pidiendo confirmación: solo una a la vez. */
  readonly confirmingDelete = input(false);

  readonly preview = output<void>();
  /** Se ha pulsado el enlace de descarga directa (para dejar rastro en auditoría). */
  readonly downloaded = output<void>();
  readonly downloadClassified = output<void>();
  readonly reupload = output<File>();
  readonly history = output<void>();
  readonly access = output<void>();
  readonly deleteRequested = output<void>();
  readonly deleteConfirmed = output<void>();
  readonly deleteCancelled = output<void>();

  protected readonly bp = inject(BreakpointService);
  private readonly cupo = inject(AlmacenamientoCupoService);

  /** Clases de los botones de icono de escritorio (hover vía Tailwind, sin handlers inline). */
  protected readonly iconBtn =
    'p-1.5 rounded-lg transition-colors duration-150 text-[color:var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[color:var(--text-muted)]';

  /**
   * Acciones del menú móvil (⋯). La descarga directa de un archivo no clasificado
   * sigue siendo un enlace visible, así que no entra aquí.
   */
  readonly acciones = computed<MenuAction[]>(() => {
    const f = this.file();
    const out: MenuAction[] = [{ id: 'preview', label: 'Previsualizar', icon: Eye }];
    if (f.clasificado) out.push({ id: 'downloadClassified', label: 'Descargar', icon: Download });
    if (this.canEdit()) out.push({ id: 'reupload', label: 'Subir nueva versión', icon: RefreshCw });
    out.push({ id: 'history', label: 'Ver historial', icon: History });
    if (this.isAdmin()) out.push({ id: 'access', label: 'Gestionar acceso', icon: Lock });
    if (this.canDelete()) out.push({ id: 'delete', label: 'Eliminar archivo', icon: Trash2, danger: true });
    return out;
  });

  /** Ejecuta una acción del menú móvil: mismos outputs que los iconos de escritorio. */
  ejecutar(id: string): void {
    switch (id) {
      case 'preview': this.preview.emit(); break;
      case 'downloadClassified': this.downloadClassified.emit(); break;
      case 'reupload': this.triggerReupload(); break;
      case 'history': this.history.emit(); break;
      case 'access': this.access.emit(); break;
      case 'delete': this.deleteRequested.emit(); break;
    }
  }

  readonly FileTextIcon = FileText;
  readonly DownloadIcon = Download;
  readonly Trash2Icon = Trash2;
  readonly EyeIcon = Eye;
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly HistoryIcon = History;
  readonly RefreshCwIcon = RefreshCw;
  readonly LockIcon = Lock;

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  triggerReupload(): void {
    // Sin cupo ni se abre el selector: el servicio muestra el modal de mejora.
    if (!this.cupo.puedeSubir()) return;
    this.fileInput()?.nativeElement.click();
  }

  onReuploadSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const [newFile] = this.cupo.admitir(Array.from(target.files ?? []).slice(0, 1));
    if (newFile) this.reupload.emit(newFile);
    target.value = '';
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
