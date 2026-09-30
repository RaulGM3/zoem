import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { LucideAngularModule, CheckCircle2, FileText, FilePen, ChevronRight } from 'lucide-angular';
import type { CasoDocSlot } from '../../../../interfaces';

/** Panel lateral con el checklist de documentos requeridos por la plantilla del caso. */
@Component({
  selector: 'app-caso-docs-checklist',
  // El <aside> es sticky y participa en el flex del padre: el host no debe generar caja.
  host: { style: 'display: contents' },
  imports: [LucideAngularModule],
  templateUrl: './caso-docs-checklist.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDocsChecklistComponent {
  readonly slots = input.required<CasoDocSlot[]>();
  readonly busy = input(false);

  readonly slotSelected = output<CasoDocSlot>();

  readonly CheckCircle2Icon = CheckCircle2;
  readonly FileTextIcon = FileText;
  readonly FilePenIcon = FilePen;
  readonly ChevronRightIcon = ChevronRight;

  readonly pendingSlots = computed(() =>
    this.slots().filter(s => s.status !== 'subido' && s.status !== 'generado')
  );
}
