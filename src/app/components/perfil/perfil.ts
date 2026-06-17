import { Component, signal, computed, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule, User, Building2, Briefcase, Save, CheckCircle2, Loader } from 'lucide-angular';
import { AuthService } from '../../auth/auth.service';
import { UserSyncService } from '../../core/services/user-sync.service';

type PerfilTab = 'personal' | 'despacho' | 'profesional';

@Component({
  selector: 'app-perfil',
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './perfil.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilComponent {
  readonly UserIcon = User;
  readonly Building2Icon = Building2;
  readonly BriefcaseIcon = Briefcase;
  readonly SaveIcon = Save;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly LoaderIcon = Loader;

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly userSync = inject(UserSyncService);

  activeTab = signal<PerfilTab>('personal');
  guardado = signal(false);
  guardando = signal(false);

  personalForm = this.fb.group({
    nombre: ['', Validators.required],
    email: [{ value: '', disabled: true }],
    telefono: [''],
    linkedin: [''],
    biografia: [''],
  });

  despachoForm = this.fb.group({
    nombre: ['', Validators.required],
    website: [''],
    direccion: [''],
    ciudad: [''],
    cp: [''],
    pais: [''],
  });

  profesionalForm = this.fb.group({
    colegio: [''],
    numeroColegiado: [''],
    especialidad: [''],
    anos: [0],
  });

  especialidades = [
    'Derecho Mercantil', 'Derecho Laboral', 'Derecho Fiscal',
    'Derecho Civil', 'Derecho Penal', 'Derecho Administrativo',
  ];

  readonly currentUser = this.userSync.currentUser;

  readonly initials = computed(() => {
    const name = this.currentUser()?.displayName ?? this.currentUser()?.email ?? '?';
    return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  });

  readonly completionPercent = computed(() => {
    const u = this.currentUser();
    if (!u) return 0;
    const fields = [
      u.displayName,
      u.telefono,
      u.linkedin,
      u.biografia,
      u.despacho?.nombre,
      u.despacho?.ciudad,
      u.profesional?.colegio,
      u.profesional?.especialidad,
    ];
    const filled = fields.filter((f) => !!f).length;
    return Math.round((filled / fields.length) * 100);
  });

  readonly memberSince = computed(() => {
    const ts = this.currentUser()?.createdAt as { toDate?: () => Date } | null;
    if (!ts?.toDate) return '—';
    return ts.toDate().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  });

  constructor() {
    effect(() => {
      const u = this.currentUser();
      if (!u) return;

      this.personalForm.patchValue({
        nombre: u.displayName ?? '',
        email: u.email,
        telefono: u.telefono ?? '',
        linkedin: u.linkedin ?? '',
        biografia: u.biografia ?? '',
      });

      this.despachoForm.patchValue({
        nombre: u.despacho?.nombre ?? '',
        website: u.despacho?.website ?? '',
        direccion: u.despacho?.direccion ?? '',
        ciudad: u.despacho?.ciudad ?? '',
        cp: u.despacho?.cp ?? '',
        pais: u.despacho?.pais ?? '',
      });

      this.profesionalForm.patchValue({
        colegio: u.profesional?.colegio ?? '',
        numeroColegiado: u.profesional?.numeroColegiado ?? '',
        especialidad: u.profesional?.especialidad ?? '',
        anos: u.profesional?.anos ?? 0,
      });
    });
  }

  async guardar(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid || this.guardando()) return;

    this.guardando.set(true);
    try {
      const p = this.personalForm.getRawValue();
      const d = this.despachoForm.getRawValue();
      const prof = this.profesionalForm.getRawValue();

      await this.userSync.updateUserProfile(
        uid,
        {
          displayName: p.nombre ?? '',
          telefono: p.telefono ?? '',
          linkedin: p.linkedin ?? '',
          biografia: p.biografia ?? '',
        },
        {
          nombre: d.nombre ?? '',
          website: d.website ?? '',
          direccion: d.direccion ?? '',
          ciudad: d.ciudad ?? '',
          cp: d.cp ?? '',
          pais: d.pais ?? '',
        },
        {
          colegio: prof.colegio ?? '',
          numeroColegiado: prof.numeroColegiado ?? '',
          especialidad: prof.especialidad ?? '',
          anos: prof.anos ?? 0,
        },
      );

      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } finally {
      this.guardando.set(false);
    }
  }
}
