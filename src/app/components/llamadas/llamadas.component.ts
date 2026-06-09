import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideAngularModule, Phone, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, PhoneOff } from 'lucide-angular';
import { LlamadasService } from '../../core/services/llamadas.service';
import type { LlamadaResumen } from '../../interfaces/llamada.interface';

@Component({
  selector: 'app-llamadas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DatePipe],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <lucide-icon [img]="PhoneIcon" class="text-indigo-600" [size]="24" />
        <h1 class="text-2xl font-semibold text-gray-900">Llamadas</h1>
        @if (service.loading()) {
          <span class="ml-auto text-sm text-gray-400">Cargando...</span>
        }
      </div>

      <!-- Empty state -->
      @if (!service.loading() && service.llamadas().length === 0) {
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <lucide-icon [img]="PhoneOffIcon" class="text-gray-300 mb-4" [size]="48" />
          <p class="text-gray-500 text-lg font-medium">Sin llamadas registradas</p>
          <p class="text-gray-400 text-sm mt-1">
            Las llamadas aparecerán aquí tras configurar el webhook de ElevenLabs.
          </p>
        </div>
      }

      <!-- Lista -->
      @if (service.llamadas().length > 0) {
        <div class="space-y-3">
          @for (llamada of service.llamadas(); track llamada.conversationId) {
            <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <!-- Fila principal -->
              <button
                type="button"
                class="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                (click)="toggleExpand(llamada.conversationId)"
                [attr.aria-expanded]="expandedId() === llamada.conversationId"
              >
                <!-- Estado badge -->
                <span
                  class="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  [class]="estadoClase(llamada.estado)"
                >
                  <lucide-icon
                    [img]="llamada.exitosa ? CheckIcon : XIcon"
                    [size]="12"
                  />
                  {{ estadoLabel(llamada.estado) }}
                </span>

                <!-- Resumen -->
                <p class="flex-1 text-sm text-gray-700 truncate">
                  {{ llamada.resumen || 'Sin resumen disponible' }}
                </p>

                <!-- Duración -->
                <span class="shrink-0 flex items-center gap-1 text-xs text-gray-400">
                  <lucide-icon [img]="ClockIcon" [size]="12" />
                  {{ formatDuration(llamada.duracionSegundos) }}
                </span>

                <!-- Fecha -->
                <span class="shrink-0 text-xs text-gray-400 w-32 text-right">
                  {{ llamada.creadoEn?.toDate() | date: 'dd/MM/yyyy HH:mm' }}
                </span>

                <!-- Expand icon -->
                <lucide-icon
                  [img]="expandedId() === llamada.conversationId ? ChevronUpIcon : ChevronDownIcon"
                  [size]="16"
                  class="shrink-0 text-gray-400"
                />
              </button>

              <!-- Detalle expandido -->
              @if (expandedId() === llamada.conversationId) {
                <div class="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                  <!-- Resumen completo -->
                  @if (llamada.resumen) {
                    <div>
                      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Resumen</p>
                      <p class="text-sm text-gray-700">{{ llamada.resumen }}</p>
                    </div>
                  }

                  <!-- Transcripción -->
                  @if (llamada.transcripcion?.length) {
                    <div>
                      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transcripción</p>
                      <div class="space-y-2">
                        @for (turno of llamada.transcripcion; track $index) {
                          <div
                            class="flex gap-3"
                            [class]="turno.rol === 'agente' ? 'justify-start' : 'justify-end'"
                          >
                            <div
                              class="max-w-[75%] rounded-xl px-3 py-2 text-sm"
                              [class]="turno.rol === 'agente'
                                ? 'bg-indigo-50 text-indigo-900'
                                : 'bg-white border border-gray-200 text-gray-800'"
                            >
                              <span class="block text-xs font-medium mb-0.5 opacity-60">
                                {{ turno.rol === 'agente' ? 'Agente IA' : 'Usuario' }}
                                @if (turno.segundosEnLlamada !== undefined) {
                                  · {{ formatDuration(turno.segundosEnLlamada) }}
                                }
                              </span>
                              {{ turno.mensaje }}
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Meta -->
                  <p class="text-xs text-gray-400">ID: {{ llamada.conversationId }}</p>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class LlamadasComponent implements OnInit {
  readonly service = inject(LlamadasService);
  readonly expandedId = signal<string | null>(null);

  readonly PhoneIcon = Phone;
  readonly PhoneOffIcon = PhoneOff;
  readonly ClockIcon = Clock;
  readonly CheckIcon = CheckCircle;
  readonly XIcon = XCircle;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronUpIcon = ChevronUp;

  ngOnInit(): void {
    this.service.loadLlamadas();
  }

  toggleExpand(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  estadoClase(estado: LlamadaResumen['estado']): string {
    const map: Record<LlamadaResumen['estado'], string> = {
      completada: 'bg-green-100 text-green-700',
      fallida: 'bg-red-100 text-red-700',
      interrumpida: 'bg-yellow-100 text-yellow-700',
    };
    return map[estado];
  }

  estadoLabel(estado: LlamadaResumen['estado']): string {
    const map: Record<LlamadaResumen['estado'], string> = {
      completada: 'Completada',
      fallida: 'Fallida',
      interrumpida: 'Interrumpida',
    };
    return map[estado];
  }
}
