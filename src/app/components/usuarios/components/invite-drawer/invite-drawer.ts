import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { LucideAngularModule, X, Mail, Shield, Send, Copy, Check } from 'lucide-angular';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { inject } from '@angular/core';
import { FIRM_ROLES } from '../../../../interfaces/member';
import type { InvitationRole } from '../../../../interfaces/invitation';
import { CustomRolesService } from '../../../../core/services/custom-roles.service';

export interface InviteFormData {
  email: string;
  /** Rol BASE (lo que validan las security rules). */
  role: InvitationRole;
  /** Rol custom asignado en la invitación (opcional). */
  customRole?: { id: string; nombre: string };
}

@Component({
  selector: 'app-invite-drawer',
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './invite-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly customRolesService = inject(CustomRolesService);

  readonly customRoles = this.customRolesService.roles;

  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly inviteLink = input<string | null>(null);

  readonly submitted = output<InviteFormData>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly MailIcon = Mail;
  readonly ShieldIcon = Shield;
  readonly SendIcon = Send;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;

  readonly roles = FIRM_ROLES;
  readonly copied = signal(false);
  /** Rol elegido: un FirmRole base o `custom:{id}`. */
  readonly roleKey = signal<string>('Usuario');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['Usuario' as InvitationRole, Validators.required],
  });

  readonly isValid = computed(() => this.form.valid);

  onRoleKeyChange(key: string): void {
    this.roleKey.set(key);
    if (key.startsWith('custom:')) {
      const custom = this.customRolesService.byId(key.slice('custom:'.length));
      this.form.controls.role.setValue(custom?.baseRole ?? 'Usuario');
    } else {
      this.form.controls.role.setValue(key as InvitationRole);
    }
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { email, role } = this.form.getRawValue();
    const key = this.roleKey();
    const custom = key.startsWith('custom:')
      ? this.customRolesService.byId(key.slice('custom:'.length))
      : null;
    this.submitted.emit({
      email,
      role,
      ...(custom ? { customRole: { id: custom.id, nombre: custom.nombre } } : {}),
    });
  }

  async copyLink(): Promise<void> {
    const link = this.inviteLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  close(): void {
    this.form.reset({ email: '', role: 'Usuario' });
    this.roleKey.set('Usuario');
    this.closed.emit();
  }
}
