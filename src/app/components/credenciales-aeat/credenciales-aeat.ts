import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { LucideAngularModule, ShieldCheck, ShieldAlert, ShieldX, Upload, Loader2 } from 'lucide-angular';
import { CompanyService } from '../../core/services/company.service';
import { ToastService } from '../../core/services/toast.service';

type EstadoCert = 'sin_configurar' | 'activo' | 'expirado';

@Component({
  selector: 'app-credenciales-aeat',
  imports: [LucideAngularModule, ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">

      <!-- Estado actual del certificado -->
      <div class="flex items-start gap-3 rounded-lg p-4"
        [style.background]="estadoCert() === 'activo' ? 'color-mix(in srgb,var(--success) 8%,transparent)' : estadoCert() === 'expirado' ? 'color-mix(in srgb,var(--warning) 8%,transparent)' : 'var(--surface-2)'"
        [style.border]="'1px solid ' + (estadoCert() === 'activo' ? 'color-mix(in srgb,var(--success) 20%,transparent)' : estadoCert() === 'expirado' ? 'color-mix(in srgb,var(--warning) 20%,transparent)' : 'var(--border)')">
        <lucide-icon [img]="iconEstado()" size="18" class="mt-0.5 shrink-0"
          [style.color]="estadoCert() === 'activo' ? 'var(--success)' : estadoCert() === 'expirado' ? 'var(--warning)' : 'var(--text-faint)'">
        </lucide-icon>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold" style="color:var(--text-strong)">
            {{ estadoCert() === 'activo' ? 'Certificado activo' : estadoCert() === 'expirado' ? 'Certificado expirado' : 'Sin certificado configurado' }}
          </p>
          <p class="text-xs mt-0.5" style="color:var(--text-muted)">{{ descripcionEstado() }}</p>

          @if (company()?.verifactu?.certTitular) {
            <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt style="color:var(--text-faint)">Titular</dt>
              <dd class="font-medium truncate" style="color:var(--text-body)">{{ company()!.verifactu!.certTitular }}</dd>
              <dt style="color:var(--text-faint)">NIF cert.</dt>
              <dd style="color:var(--text-body);font-family:var(--font-mono)">{{ company()!.verifactu!.certNif }}</dd>
              <dt style="color:var(--text-faint)">Expira</dt>
              <dd [style.color]="estadoCert() === 'expirado' ? 'var(--warning)' : 'var(--text-body)'">
                {{ company()!.verifactu!.certExpiry | date:'dd/MM/yyyy' }}
              </dd>
              @if (company()!.verifactu!.certStoredAt) {
                <dt style="color:var(--text-faint)">Subido</dt>
                <dd style="color:var(--text-faint)">{{ company()!.verifactu!.certStoredAt | date:'dd/MM/yyyy HH:mm' }}</dd>
              }
            </dl>
          }
        </div>
      </div>

      <!-- Formulario: subir nuevo certificado -->
      <form [formGroup]="form" (ngSubmit)="subir()" class="space-y-4">
        <p class="text-xs font-semibold uppercase tracking-wider" style="color:var(--text-faint);font-family:var(--font-mono)">
          {{ company()?.verifactu?.certTitular ? 'Reemplazar certificado' : 'Subir certificado' }}
        </p>

        <div>
          <label class="form-label">Archivo .pfx / .p12</label>
          <input
            type="file"
            accept=".pfx,.p12"
            (change)="onFileChange($event)"
            class="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium file:cursor-pointer"
            style="color:var(--text-muted);file:background:var(--surface-2);file:color:var(--text-body)"
          />
        </div>

        <div>
          <label class="form-label">Contraseña del certificado</label>
          <input
            type="password"
            formControlName="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="form-input"
          />
        </div>

        <button
          type="submit"
          [disabled]="!archivoBase64() || form.invalid || cargando()"
          class="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          style="background:var(--brand)"
        >
          @if (cargando()) {
            <lucide-icon [img]="Loader2Icon" size="15" class="animate-spin"></lucide-icon>
            Guardando…
          } @else {
            <lucide-icon [img]="UploadIcon" size="15"></lucide-icon>
            {{ company()?.verifactu?.certTitular ? 'Reemplazar certificado' : 'Guardar certificado' }}
          }
        </button>
      </form>
    </div>
  `,
})
export class CredencialesAeatComponent {
  protected readonly ShieldCheckIcon = ShieldCheck;
  protected readonly ShieldAlertIcon = ShieldAlert;
  protected readonly ShieldXIcon = ShieldX;
  protected readonly UploadIcon = Upload;
  protected readonly Loader2Icon = Loader2;

  private readonly fb = inject(FormBuilder);
  private readonly functions = inject(Functions);
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);

  readonly company = this.companyService.activeCompany;

  readonly cargando = signal(false);
  readonly archivoBase64 = signal<string | null>(null);

  readonly form = this.fb.group({
    password: ['', Validators.required],
  });

  readonly estadoCert = computed((): EstadoCert => {
    const v = this.company()?.verifactu;
    if (!v?.certExpiry) return 'sin_configurar';
    return new Date(v.certExpiry) > new Date() ? 'activo' : 'expirado';
  });

  readonly iconEstado = computed(() => {
    const e = this.estadoCert();
    if (e === 'activo') return this.ShieldCheckIcon;
    if (e === 'expirado') return this.ShieldAlertIcon;
    return this.ShieldXIcon;
  });

  readonly colorEstado = computed(() => {
    const e = this.estadoCert();
    if (e === 'activo') return 'text-green-400';
    if (e === 'expirado') return 'text-yellow-400';
    return 'text-neutral-400';
  });

  readonly descripcionEstado = computed(() => {
    const e = this.estadoCert();
    if (e === 'activo') return 'Certificado activo — las facturas se enviarán automáticamente a Verifactu';
    if (e === 'expirado') return 'Certificado expirado — actualízalo para seguir enviando facturas';
    return 'Sin certificado configurado — necesario para cumplir con Verifactu';
  });

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:application/x-pkcs12;base64,AAAA..." — extraemos solo la parte base64
      this.archivoBase64.set(result.split(',')[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  async subir(): Promise<void> {
    const pfxBase64 = this.archivoBase64();
    const password = this.form.value.password;
    const companyId = this.company()?.id;

    if (!pfxBase64 || !password || !companyId) return;

    this.cargando.set(true);

    try {
      const fn = httpsCallable<
        { companyId: string; pfxBase64: string; password: string },
        { certNif: string; certTitular: string; certExpiry: string }
      >(this.functions, 'storeAeatCredential');

      const result = await fn({ companyId, pfxBase64, password });
      const { certNif, certTitular, certExpiry } = result.data;

      await this.companyService.updateCompany(companyId, {
        verifactu: {
          enabled: true,
          sandbox: this.company()?.verifactu?.sandbox ?? false,
          certNif,
          certTitular,
          certExpiry,
          certStoredAt: new Date().toISOString(),
        },
      });

      this.form.reset();
      this.archivoBase64.set(null);
      this.toast.success('Certificado guardado correctamente. Las facturas se enviarán automáticamente a Verifactu.');
    } catch (err) {
      this.toast.fromError(err, { title: 'No se pudo guardar el certificado' });
    } finally {
      this.cargando.set(false);
    }
  }
}
