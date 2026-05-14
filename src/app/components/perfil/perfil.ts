import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { inject } from '@angular/core';
import {
  LucideAngularModule, User, Building2, Briefcase, Save, CheckCircle2,
} from 'lucide-angular';

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

  private fb = inject(FormBuilder);

  activeTab = signal<PerfilTab>('personal');
  guardado = signal(false);

  completionPercent = 72;

  personalForm = this.fb.group({
    nombre: ['Carlos Mendoza', Validators.required],
    email: [{ value: 'carlos@zoem.es', disabled: true }],
    telefono: ['+34 612 345 678'],
    linkedin: ['linkedin.com/in/carlosmendoza'],
    biografia: ['Abogado mercantil con 12 años de experiencia. Especialista en fusiones y adquisiciones y derecho societario.'],
  });

  despachoForm = this.fb.group({
    nombre: ['Mendoza & Asociados S.L.P.', Validators.required],
    website: ['www.mendozaasociados.es'],
    direccion: ['Calle Serrano 45, 3º'],
    ciudad: ['Madrid'],
    cp: ['28001'],
    pais: ['España'],
  });

  profesionalForm = this.fb.group({
    colegio: ['Ilustre Colegio de Abogados de Madrid'],
    numeroColegiado: ['28-12345'],
    especialidad: ['Derecho Mercantil'],
    anos: [12],
  });

  especialidades = [
    'Derecho Mercantil', 'Derecho Laboral', 'Derecho Fiscal',
    'Derecho Civil', 'Derecho Penal', 'Derecho Administrativo',
  ];

  guardar() {
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 3000);
  }
}
