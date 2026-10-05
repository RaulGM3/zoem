import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../auth/auth.service';
import {
  DEFAULT_PREFS,
  type NotificationPrefs,
  NotificationPrefsService,
} from '../../../core/services/notification-prefs.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ToastService } from '../../../core/services/toast.service';

interface PrefOption {
  key: keyof NotificationPrefs;
  label: string;
  hint: string;
}

/** Sección "Notificaciones" del perfil: switches accesibles + activación de push web. */
@Component({
  selector: 'app-notificaciones-prefs',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" class="space-y-1 p-5" (ngSubmit)="guardar()">
      <p class="pb-2 text-sm" style="color:var(--text-muted)">
        Elige qué avisos quieres recibir. Los desactivados no aparecerán en tu centro de notificaciones.
      </p>
      @for (opt of opciones; track opt.key) {
        <div class="flex items-center justify-between gap-4 py-3" style="border-bottom:1px solid var(--border)">
          <label class="min-w-0 flex-1 cursor-pointer" [for]="'pref-' + opt.key">
            <span class="block text-sm font-medium" style="color:var(--text-strong)">{{ opt.label }}</span>
            <span class="block text-xs" style="color:var(--text-muted)">{{ opt.hint }}</span>
          </label>
          <span class="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              role="switch"
              class="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
              [id]="'pref-' + opt.key"
              [formControlName]="opt.key" />
            <span
              aria-hidden="true"
              class="block h-6 w-11 rounded-full transition-colors duration-150 peer-checked:bg-[var(--brand)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brand)]"
              style="background:var(--border-strong, #94a3b8)"></span>
            <span
              aria-hidden="true"
              class="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-5"></span>
          </span>
        </div>
      }

      <div class="flex flex-wrap items-center gap-3 pt-4">
        <button
          type="submit"
          data-test="save"
          [disabled]="guardando()"
          class="tap-target rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          style="background:var(--brand)">
          {{ guardando() ? 'Guardando…' : 'Guardar preferencias' }}
        </button>
      </div>
    </form>

    @if (push.webSupported()) {
      <div class="space-y-2 p-5" style="border-top:1px solid var(--border)">
        <h3 class="text-sm font-semibold" style="color:var(--text-strong)">Este navegador</h3>
        @if (push.webEnabled()) {
          <p data-test="web-enabled" class="text-sm" style="color:var(--text-body)">
            Las notificaciones push están activas en este navegador.
          </p>
        } @else {
          <p class="text-xs" style="color:var(--text-muted)">
            Recibe avisos aunque no tengas Vertey abierto. Tu navegador te pedirá permiso.
          </p>
          <button
            type="button"
            data-test="enable-web"
            [disabled]="activando()"
            class="tap-target rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            style="border:1px solid var(--brand);color:var(--brand)"
            (click)="activarWeb()">
            Activar notificaciones en este navegador
          </button>
        }
      </div>
    }
  `,
})
export class NotificacionesPrefsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly prefs = inject(NotificationPrefsService);
  private readonly toast = inject(ToastService);
  protected readonly push = inject(PushNotificationService);

  protected readonly guardando = signal(false);
  protected readonly activando = signal(false);

  protected readonly opciones: PrefOption[] = [
    { key: 'llamadas', label: 'Llamadas nuevas', hint: 'Cuando entra una llamada gestionada por Recepción IA.' },
    { key: 'casos', label: 'Casos asignados', hint: 'Cuando te asignan o cambian un caso.' },
    { key: 'contactos', label: 'Contactos asignados', hint: 'Cuando te asignan un contacto.' },
    { key: 'eventos', label: 'Eventos', hint: 'Cuando te invitan a un evento del calendario.' },
    { key: 'hitos', label: 'Hitos asignados', hint: 'Cuando te asignan un hito de un caso.' },
    { key: 'push', label: 'Recibir notificaciones push', hint: 'Avisos en tu móvil o navegador, además de los de la app.' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    llamadas: DEFAULT_PREFS.llamadas,
    casos: DEFAULT_PREFS.casos,
    contactos: DEFAULT_PREFS.contactos,
    eventos: DEFAULT_PREFS.eventos,
    hitos: DEFAULT_PREFS.hitos,
    push: DEFAULT_PREFS.push,
  });

  constructor() {
    effect(() => {
      const uid = this.auth.user()?.uid;
      if (!uid) return;
      this.prefs
        .load(uid)
        .then((p) => this.form.reset(p))
        .catch((err) => console.error('[prefs] no se pudieron cargar:', err));
    });
  }

  protected async guardar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid || this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.toast.run(() => this.prefs.save(uid, this.form.getRawValue()), {
        successMessage: 'Preferencias de notificación guardadas',
        errorTitle: 'No se pudieron guardar las preferencias',
      });
    } finally {
      this.guardando.set(false);
    }
  }

  protected async activarWeb(): Promise<void> {
    if (this.activando()) return;
    this.activando.set(true);
    try {
      const ok = await this.push.enableWeb();
      if (ok) {
        this.toast.success('Notificaciones activadas en este navegador');
      } else {
        this.toast.info('No se activaron las notificaciones. Revisa el permiso del navegador para este sitio.');
      }
    } finally {
      this.activando.set(false);
    }
  }
}
