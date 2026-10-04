import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import {
  Bell,
  Briefcase,
  Calendar,
  Flag,
  LucideAngularModule,
  type LucideIconData,
  Phone,
  Users,
} from 'lucide-angular';
import {
  type Notificacion,
  type NotificacionTipo,
  NotificacionesService,
} from '../../../core/services/notificaciones.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { OverlayShellComponent } from '../overlay-shell/overlay-shell';
import { tiempoRelativo } from './tiempo-relativo';

const ICONOS: Record<NotificacionTipo, LucideIconData> = {
  llamadas: Phone,
  casos: Briefcase,
  contactos: Users,
  eventos: Calendar,
  hitos: Flag,
};

/** Campana del header con badge de no leídas + panel (dropdown en escritorio, drawer en móvil). */
@Component({
  selector: 'app-notificaciones-panel',
  imports: [LucideAngularModule, NgTemplateOutlet, OverlayShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-flex',
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    <button
      #bell
      type="button"
      data-test="bell"
      class="tap-target relative inline-flex items-center justify-center rounded-xl p-2 transition-colors duration-150 hover:bg-[var(--surface-2)]"
      style="color:var(--text-muted)"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel()"
      (click)="toggle()">
      <lucide-icon [img]="BellIcon" size="20" aria-hidden="true"></lucide-icon>
      @if (badge(); as b) {
        <span
          data-test="badge"
          aria-hidden="true"
          class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
          style="background:var(--danger, #dc2626)">{{ b }}</span>
      }
    </button>

    @if (open()) {
      @if (bp.isMobile()) {
        <app-overlay-shell [open]="true" title="Notificaciones" variant="drawer" (closed)="close(true)">
          <ng-container [ngTemplateOutlet]="contenido" />
        </app-overlay-shell>
      } @else {
        <div
          #dialog
          role="dialog"
          aria-label="Notificaciones"
          tabindex="-1"
          class="absolute right-0 top-full z-50 mt-2 flex max-h-[28rem] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl shadow-2xl outline-none"
          style="background:var(--surface);border:1px solid var(--border)"
          (keydown.escape)="close(true)">
          <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--border)">
            <h2 class="text-sm font-semibold" style="color:var(--text-strong)">Notificaciones</h2>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <ng-container [ngTemplateOutlet]="contenido" />
          </div>
        </div>
      }
    }

    <ng-template #contenido>
      @if (canPrompt()) {
        <div class="flex items-center justify-between gap-3 px-4 py-3" style="background:var(--surface-2)">
          <p class="text-xs" style="color:var(--text-body)">Recibe avisos aunque no tengas Vertey abierto.</p>
          <button
            type="button"
            data-test="enable-push"
            class="tap-target shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style="background:var(--brand)"
            (click)="activarPush()">
            Activar notificaciones
          </button>
        </div>
      }
      @if (hayNoLeidas()) {
        <div class="flex justify-end px-4 pt-3">
          <button
            type="button"
            data-test="mark-all"
            class="tap-target text-xs font-semibold underline-offset-2 hover:underline"
            style="color:var(--brand)"
            (click)="marcarTodas()">
            Marcar todas como leídas
          </button>
        </div>
      }
      @if (items().length === 0) {
        <p data-test="empty" class="px-4 py-10 text-center text-sm" style="color:var(--text-muted)">
          No tienes notificaciones
        </p>
      } @else {
        <ul class="py-1">
          @for (n of items(); track n.id) {
            <li>
              <button
                type="button"
                data-test="item"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface-2)]"
                (click)="abrir(n)">
                <span
                  class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style="background:color-mix(in srgb,var(--brand) 12%,transparent);color:var(--brand)">
                  <lucide-icon [img]="n.icon" size="16" aria-hidden="true"></lucide-icon>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm" [class.font-semibold]="!n.leida"
                    style="color:var(--text-strong)">{{ n.titulo }}</span>
                  <span class="line-clamp-2 block text-xs" style="color:var(--text-muted)">{{ n.cuerpo }}</span>
                  <span class="mt-1 block text-[11px]" style="color:var(--text-muted)">{{ n.tiempo }}</span>
                </span>
                @if (!n.leida) {
                  <span class="mt-2 flex shrink-0 items-center">
                    <span data-test="unread-dot" aria-hidden="true" class="h-2 w-2 rounded-full"
                      style="background:var(--brand)"></span>
                    <span class="sr-only">Sin leer</span>
                  </span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </ng-template>
  `,
})
export class NotificacionesPanelComponent {
  protected readonly BellIcon = Bell;
  protected readonly bp = inject(BreakpointService);
  private readonly service = inject(NotificacionesService);
  private readonly push = inject(PushNotificationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly bell = viewChild<ElementRef<HTMLButtonElement>>('bell');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  protected readonly open = signal(false);
  /** Reloj para el tiempo relativo: se refresca al abrir, nunca desde el template. */
  private readonly now = signal(Date.now());

  protected readonly canPrompt = this.push.canPromptWeb;
  protected readonly hayNoLeidas = computed(() => this.service.noLeidas() > 0);

  protected readonly badge = computed(() => {
    const n = this.service.noLeidas();
    if (n <= 0) return '';
    return n > 9 ? '9+' : String(n);
  });

  protected readonly ariaLabel = computed(() => {
    const n = this.service.noLeidas();
    return n > 0 ? `Notificaciones, ${n} sin leer` : 'Notificaciones';
  });

  protected readonly items = computed(() => {
    const now = new Date(this.now());
    return this.service.notificaciones().map((n) => ({
      ...n,
      icon: ICONOS[n.tipo] ?? Bell,
      tiempo: tiempoRelativo(n.createdAt, now),
    }));
  });

  protected toggle(): void {
    if (this.open()) {
      this.close(true);
      return;
    }
    this.now.set(Date.now());
    this.open.set(true);
    afterNextRender(() => this.dialog()?.nativeElement.focus(), { injector: this.injector });
  }

  protected close(restoreFocus: boolean): void {
    this.open.set(false);
    if (restoreFocus) this.bell()?.nativeElement.focus();
  }

  protected onDocumentClick(event: Event): void {
    if (!this.open() || this.bp.isMobile()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  protected abrir(n: Notificacion): void {
    this.close(false);
    if (!n.leida) {
      this.service.marcarLeida(n.id).catch((err) => console.error('[notificaciones] marcarLeida:', err));
    }
    if (n.route) void this.router.navigateByUrl(n.route);
  }

  protected marcarTodas(): void {
    this.service.marcarTodasLeidas().catch((err) => console.error('[notificaciones] marcarTodasLeidas:', err));
  }

  protected activarPush(): void {
    void this.push.enableWeb();
  }
}
