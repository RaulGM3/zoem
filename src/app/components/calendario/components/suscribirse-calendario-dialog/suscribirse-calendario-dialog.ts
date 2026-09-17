import {
  Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit,
} from '@angular/core';
import { LucideAngularModule, X, Copy, Check, ExternalLink, RotateCw, Trash2, Loader, AlertTriangle } from 'lucide-angular';
import { CalendarFeedService, type CalendarFeedUrls } from '../../../../core/services/calendar-feed.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorService } from '../../../../core/services/error.service';
import { FocusTrapDirective } from '../../../../shared/directives/focus-trap.directive';

/**
 * Diálogo de suscripción al feed ICS de solo lectura del calendario
 * (Fase 1). Genera un token al abrirse, muestra la URL para copiar o
 * abrir directamente en Google Calendar, y permite regenerar (invalida
 * la anterior) o revocar el acceso.
 */
@Component({
  selector: 'app-suscribirse-calendario-dialog',
  imports: [LucideAngularModule, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50 flex items-center justify-center p-4',
    style: 'background:rgba(15,23,41,0.45)',
    '(click)': 'closed.emit()',
  },
  template: `
    <div
      class="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
      style="background:var(--surface);border:1px solid var(--border)"
      (click)="$event.stopPropagation()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suscribirse-dialog-title"
      appFocusTrap
      (escapeKey)="closed.emit()"
    >
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid var(--border)">
        <h2 id="suscribirse-dialog-title" class="text-base font-semibold" style="color:var(--text-strong);font-family:var(--font-display)">
          Suscribirse al calendario
        </h2>
        <button
          type="button"
          (click)="closed.emit()"
          class="rounded-xl p-1.5 transition-colors duration-150"
          style="color:var(--text-muted)"
          aria-label="Cerrar"
        >
          <lucide-icon [img]="XIcon" size="18"></lucide-icon>
        </button>
      </div>

      <div class="px-5 py-4 space-y-4">
        <p class="text-sm" style="color:var(--text-muted)">
          Añade este calendario de solo lectura a Google Calendar, Outlook o Apple Calendar
          con cualquier cuenta de correo. Se actualiza solo — no necesitas volver a importarlo.
        </p>

        @if (loading()) {
          <div class="flex items-center justify-center gap-2 py-8 text-sm" style="color:var(--text-muted)">
            <lucide-icon [img]="LoaderIcon" size="16" class="animate-spin"></lucide-icon>
            Generando enlace…
          </div>
        } @else if (error()) {
          <div class="flex items-start gap-2 rounded-lg px-3 py-2.5" style="background:color-mix(in srgb, var(--danger) 10%, transparent);border:1px solid color-mix(in srgb, var(--danger) 30%, transparent)">
            <lucide-icon [img]="AlertTriangleIcon" size="16" style="color:var(--danger)" class="shrink-0 mt-0.5"></lucide-icon>
            <div class="flex-1 min-w-0">
              <p class="text-sm" style="color:var(--text-strong)">{{ error() }}</p>
              <button
                type="button"
                (click)="generate()"
                class="mt-2 text-xs font-semibold"
                style="color:var(--brand)"
              >
                Reintentar
              </button>
            </div>
          </div>
        } @else if (urls()) {
          <div class="space-y-2">
            <label for="feed-url-input" class="text-xs font-medium" style="color:var(--text-strong)">
              Enlace del calendario
            </label>
            <div class="flex items-stretch gap-2">
              <input
                id="feed-url-input"
                type="text"
                readonly
                [value]="urls()!.feedUrl"
                (click)="$any($event.target).select()"
                class="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs font-mono"
                style="background:var(--surface-2);border:1px solid var(--border);color:var(--text-strong)"
                aria-label="URL del feed de calendario"
              />
              <button
                type="button"
                (click)="copy()"
                class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shrink-0"
                style="background:var(--brand)"
              >
                <lucide-icon [img]="copied() ? CheckIcon : CopyIcon" size="14"></lucide-icon>
                {{ copied() ? 'Copiado' : 'Copiar' }}
              </button>
            </div>
            <div aria-live="polite" class="sr-only">
              {{ copied() ? 'Enlace copiado al portapapeles' : '' }}
            </div>

            <a
              data-testid="google-calendar-link"
              [href]="googleCalendarHref()"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs font-medium"
              style="color:var(--brand)"
            >
              <lucide-icon [img]="ExternalLinkIcon" size="13"></lucide-icon>
              Abrir en Google Calendar
            </a>
          </div>

          @if (confirmingRegenerate()) {
            <div class="flex items-start gap-2 rounded-lg px-3 py-2.5" style="background:color-mix(in srgb, var(--danger) 10%, transparent);border:1px solid color-mix(in srgb, var(--danger) 30%, transparent)">
              <lucide-icon [img]="AlertTriangleIcon" size="16" style="color:var(--danger)" class="shrink-0 mt-0.5"></lucide-icon>
              <div class="flex-1 min-w-0">
                <p class="text-xs" style="color:var(--text-strong)">
                  El enlace actual dejará de funcionar en los calendarios donde ya lo hayas añadido. ¿Continuar?
                </p>
                <div class="mt-2 flex gap-2">
                  <button type="button" (click)="confirmRegenerate()" class="text-xs font-semibold" style="color:var(--danger)">
                    Sí, regenerar
                  </button>
                  <button type="button" (click)="confirmingRegenerate.set(false)" class="text-xs font-semibold" style="color:var(--text-muted)">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          }
        } @else if (revoked()) {
          <p class="text-sm py-4 text-center" style="color:var(--text-muted)">
            El enlace ha sido revocado. Genera uno nuevo si quieres volver a suscribirte.
          </p>
          <div class="flex justify-center">
            <button
              type="button"
              (click)="generate()"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style="background:var(--brand)"
            >
              Generar enlace
            </button>
          </div>
        }
      </div>

      @if (urls() && !confirmingRegenerate()) {
        <div class="flex items-center justify-end gap-2 px-5 py-3" style="border-top:1px solid var(--border)">
          <button
            type="button"
            (click)="requestRegenerate()"
            [disabled]="regenerating()"
            class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style="color:var(--text-strong);border:1px solid var(--border)"
          >
            <lucide-icon [img]="RotateCwIcon" size="14" [class]="regenerating() ? 'animate-spin' : ''"></lucide-icon>
            Regenerar
          </button>
          <button
            type="button"
            (click)="revoke()"
            [disabled]="revoking()"
            class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style="color:var(--danger);border:1px solid color-mix(in srgb, var(--danger) 30%, transparent)"
          >
            <lucide-icon [img]="Trash2Icon" size="14"></lucide-icon>
            Revocar
          </button>
        </div>
      }
    </div>
  `,
})
export class SuscribirseCalendarioDialogComponent implements OnInit {
  private readonly calendarFeedService = inject(CalendarFeedService);
  private readonly toast = inject(ToastService);
  private readonly errorService = inject(ErrorService);

  readonly companyId = input.required<string>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly ExternalLinkIcon = ExternalLink;
  readonly RotateCwIcon = RotateCw;
  readonly Trash2Icon = Trash2;
  readonly LoaderIcon = Loader;
  readonly AlertTriangleIcon = AlertTriangle;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly urls = signal<CalendarFeedUrls | null>(null);
  readonly copied = signal(false);
  readonly confirmingRegenerate = signal(false);
  readonly regenerating = signal(false);
  readonly revoking = signal(false);
  readonly revoked = signal(false);

  googleCalendarHref(): string {
    const webcal = this.urls()?.webcalUrl ?? '';
    return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  }

  ngOnInit(): void {
    void this.generate();
  }

  async generate(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const urls = await this.calendarFeedService.createToken(this.companyId());
      this.urls.set(urls);
      this.revoked.set(false);
    } catch (err) {
      void this.errorService.log(err, { serviceName: 'CalendarFeedService', methodName: 'createToken' });
      this.error.set('No se pudo generar el enlace de suscripción. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  requestRegenerate(): void {
    this.confirmingRegenerate.set(true);
  }

  async confirmRegenerate(): Promise<void> {
    this.confirmingRegenerate.set(false);
    this.regenerating.set(true);
    try {
      await this.generate();
    } finally {
      this.regenerating.set(false);
    }
  }

  async revoke(): Promise<void> {
    this.revoking.set(true);
    try {
      await this.calendarFeedService.revokeToken(this.companyId());
      this.urls.set(null);
      this.revoked.set(true);
      this.toast.success('Enlace de calendario revocado');
    } catch (err) {
      void this.errorService.log(err, { serviceName: 'CalendarFeedService', methodName: 'revokeToken' });
      this.toast.fromError(err, { title: 'No se pudo revocar el enlace' });
    } finally {
      this.revoking.set(false);
    }
  }

  async copy(): Promise<void> {
    const url = this.urls()?.feedUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      this.copyFallback(url);
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  private copyFallback(url: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
