import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LucideAngularModule, ImagePlus } from 'lucide-angular';
import { CompanyLogoService } from '../../../core/services/company-logo.service';
import { CompanyService } from '../../../core/services/company.service';
import { ToastService } from '../../../core/services/toast.service';

type EstadoLogo = 'idle' | 'subiendo' | 'quitando';

/** Subida, reemplazo y baja del logo de la empresa (PNG/JPG, máx. 1 MB). */
@Component({
  selector: 'app-company-logo-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, LucideAngularModule],
  template: `
    <div class="space-y-3">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="flex h-16 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style="border:1px solid var(--border);background:var(--surface-2)">
          @if (logo(); as l) {
            <img [ngSrc]="l.url" width="160" height="64" [alt]="'Logo de ' + nombre()" class="h-16 w-40 object-contain" />
          } @else {
            <span class="flex items-center gap-1.5 text-xs" style="color:var(--text-muted)">
              <lucide-icon [img]="ImagePlusIcon" class="size-4" aria-hidden="true"></lucide-icon>
              Sin logo
            </span>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" (click)="archivo.click()" [disabled]="ocupado()"
            class="max-sm:tap-target rounded-xl px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40 bg-[var(--brand)] hover:bg-[var(--brand-hover)]">
            {{ logo() ? 'Reemplazar' : 'Subir logo' }}
          </button>

          @if (logo()) {
            @if (confirmandoQuitar()) {
              <span class="text-xs" style="color:var(--danger)">¿Quitar el logo?</span>
              <button type="button" (click)="quitar()" [disabled]="ocupado()"
                class="max-sm:tap-target rounded-xl px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                style="color:var(--danger);border:1px solid var(--danger)">
                Confirmar
              </button>
              <button type="button" (click)="confirmandoQuitar.set(false)"
                class="max-sm:tap-target rounded-xl px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
                style="color:var(--text-body)">
                Cancelar
              </button>
            } @else {
              <button type="button" (click)="confirmandoQuitar.set(true)" [disabled]="ocupado()"
                class="max-sm:tap-target rounded-xl px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-[var(--surface-2)]"
                style="color:var(--danger)">
                Quitar
              </button>
            }
          }
        </div>
      </div>

      <input #archivo id="company-logo-file" type="file" accept="image/png,image/jpeg" hidden
        aria-label="Archivo del logo de la empresa" (change)="seleccionar($event)" />

      <p class="text-xs" style="color:var(--text-muted)">PNG o JPG, máximo 1 MB. Aparece en las facturas en PDF.</p>

      <p aria-live="polite" class="text-xs" style="color:var(--text-muted)">{{ mensajeEstado() }}</p>

      @if (error(); as e) {
        <p role="alert" class="text-sm" style="color:var(--danger)">{{ e }}</p>
      }
    </div>
  `,
})
export class CompanyLogoUploaderComponent {
  private readonly logoService = inject(CompanyLogoService);
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);

  readonly ImagePlusIcon = ImagePlus;

  protected readonly logo = computed(() => this.companyService.activeCompany()?.logo ?? null);
  protected readonly nombre = computed(() => this.companyService.activeCompany()?.name ?? '');

  protected readonly estado = signal<EstadoLogo>('idle');
  protected readonly error = signal<string | null>(null);
  protected readonly confirmandoQuitar = signal(false);

  protected readonly ocupado = computed(() => this.estado() !== 'idle');
  protected readonly mensajeEstado = computed(() => {
    switch (this.estado()) {
      case 'subiendo': return 'Subiendo logo…';
      case 'quitando': return 'Quitando logo…';
      default: return '';
    }
  });

  protected async seleccionar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.ocupado()) return;
    this.error.set(null);
    this.estado.set('subiendo');
    try {
      const res = await this.toast.run(() => this.logoService.subir(file), {
        errorTitle: 'No se pudo subir el logo',
      });
      if (!res) return; // error de red/permisos ya notificado por el toast
      if (res.ok) this.toast.success('Logo actualizado');
      else this.error.set(res.error);
    } finally {
      this.estado.set('idle');
      input.value = '';
    }
  }

  protected async quitar(): Promise<void> {
    this.estado.set('quitando');
    try {
      await this.toast.run(() => this.logoService.quitar(), {
        successMessage: 'Logo eliminado',
        errorTitle: 'No se pudo quitar el logo',
      });
    } finally {
      this.estado.set('idle');
      this.confirmandoQuitar.set(false);
    }
  }
}
