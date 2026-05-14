import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AlertCircle, Building2, CheckCircle, LucideAngularModule, Shield, UserCheck } from 'lucide-angular';
import { InvitationService } from '../../core/services/invitation.service';
import { AuthService } from '../../auth/auth.service';
import { CompanyInvitation } from '../../interfaces/invitation';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'wrong-user' | 'accepting' | 'accepted' | 'error';

@Component({
  selector: 'app-invite',
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './invite.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteComponent implements OnInit {
  readonly token = input.required<string>();

  readonly AlertCircleIcon = AlertCircle;
  readonly CheckCircleIcon = CheckCircle;
  readonly Building2Icon = Building2;
  readonly ShieldIcon = Shield;
  readonly UserCheckIcon = UserCheck;

  private readonly invitationService = inject(InvitationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  state = signal<PageState>('loading');
  invitation = signal<CompanyInvitation | null>(null);
  errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const inv = await this.invitationService.getInvitationByToken(this.token());
    if (!inv) {
      this.state.set('invalid');
      return;
    }
    if (inv.status === 'accepted') {
      this.state.set('invalid');
      this.errorMessage.set('Esta invitación ya ha sido aceptada.');
      return;
    }
    const now = Date.now() / 1000;
    if (inv.expiresAt.seconds < now) {
      this.invitation.set(inv);
      this.state.set('expired');
      return;
    }
    this.invitation.set(inv);
    this.state.set('valid');
  }

  get currentUserEmail(): string | null {
    return this.auth.user()?.email ?? null;
  }

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }

  get emailMatches(): boolean {
    const inv = this.invitation();
    if (!inv || !this.currentUserEmail) return false;
    return inv.email === this.currentUserEmail.toLowerCase().trim();
  }

  goToLogin(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: `/invite/${this.token()}` },
    });
  }

  async accept(): Promise<void> {
    const userEmail = this.currentUserEmail;
    if (!userEmail) return;
    this.state.set('accepting');
    try {
      await this.invitationService.acceptInvitation(this.token(), userEmail);
      this.state.set('accepted');
      setTimeout(() => this.router.navigate(['/']), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al aceptar la invitación.';
      this.errorMessage.set(msg);
      this.state.set('error');
    }
  }
}
