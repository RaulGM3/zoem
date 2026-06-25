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

export interface InviteFormData {
  email: string;
  role: InvitationRole;
}

@Component({
  selector: 'app-invite-drawer',
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './invite-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteDrawerComponent {
  private readonly fb = inject(FormBuilder);

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

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['Usuario' as InvitationRole, Validators.required],
  });

  readonly isValid = computed(() => this.form.valid);

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { email, role } = this.form.getRawValue();
    this.submitted.emit({ email, role });
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
    this.closed.emit();
  }
}
