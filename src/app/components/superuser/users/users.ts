import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  LucideAngularModule,
  Mail,
  Plus,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { collectionData, collection, Firestore } from '@angular/fire/firestore';
import { map } from 'rxjs';
import { InvitationService } from '../../../core/services/invitation.service';
import { SuperuserService } from '../../../services/superuser';
import { UserSyncService } from '../../../core/services/user-sync.service';
import { CompanyInvitation } from '../../../interfaces/invitation';
import { Company } from '../../../interfaces/company';
import { FIRM_ROLES, FirmRole } from '../../../interfaces/member';
import { VerteyUser } from '../../../interfaces/user';

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, LucideAngularModule, DatePipe],
  templateUrl: './users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  readonly UserCogIcon = UserCog;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly MailIcon = Mail;
  readonly CopyIcon = Copy;
  readonly ClockIcon = Clock;
  readonly CheckCircleIcon = CheckCircle;

  private readonly fb = inject(FormBuilder);
  private readonly firestore = inject(Firestore);
  private readonly invitationService = inject(InvitationService);
  private readonly superuserService = inject(SuperuserService);
  private readonly userSync = inject(UserSyncService);

  activeTab = signal<'users' | 'invitations'>('users');
  search = signal('');
  filterRole = signal('');
  filterCompany = signal('');
  showInviteForm = signal(false);
  inviteError = signal<string | null>(null);
  inviteSuccess = signal<string | null>(null);
  copied = signal(false);
  isSubmitting = signal(false);

  readonly companies = toSignal(this.superuserService.getCompanies(), {
    initialValue: [] as Company[],
  });

  readonly allUsers = toSignal(
    collectionData(collection(this.firestore, 'users'), { idField: 'id' }).pipe(
      map((docs) => docs as VerteyUser[]),
    ),
    { initialValue: [] as VerteyUser[] },
  );

  readonly allInvitations = toSignal(this.invitationService.getAllPendingInvitations(), {
    initialValue: [] as CompanyInvitation[],
  });

  readonly filteredUsers = computed(() => {
    const q = this.search().toLowerCase();
    const r = this.filterRole();
    const c = this.filterCompany();
    return this.allUsers().filter((u) => {
      const matchSearch =
        !q ||
        (u.displayName ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchRole = !r || (r === 'superuser' ? u.isSuperUser : u.role === r);
      const matchCompany = !c || u.companyId === c;
      return matchSearch && matchRole && matchCompany;
    });
  });

  readonly filteredInvitations = computed(() => {
    const q = this.search().toLowerCase();
    const c = this.filterCompany();
    return this.allInvitations().filter((inv) => {
      const matchSearch = !q || inv.email.toLowerCase().includes(q);
      const matchCompany = !c || inv.companyId === c;
      return matchSearch && matchCompany;
    });
  });

  readonly firmRoles = FIRM_ROLES;

  inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['Usuario' as FirmRole, Validators.required],
    companyId: ['', Validators.required],
  });

  ngOnInit(): void {}

  getCompanyName(companyId: string | undefined): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? companyId;
  }

  openInvite(): void {
    this.inviteForm.reset({ role: 'Usuario' as FirmRole, companyId: '' });
    this.inviteError.set(null);
    this.inviteSuccess.set(null);
    this.showInviteForm.set(true);
  }

  async sendInvite(): Promise<void> {
    if (this.inviteForm.invalid) return;
    this.isSubmitting.set(true);
    this.inviteError.set(null);
    try {
      const { email, role, companyId } = this.inviteForm.getRawValue() as {
        email: string;
        role: FirmRole;
        companyId: string;
      };
      const company = this.companies().find((c) => c.id === companyId);
      const companyName = company?.name ?? companyId;
      const createdBy = this.userSync.currentUser()?.email ?? '';
      const token = await this.invitationService.createInvitation(
        companyId,
        companyName,
        email,
        role,
        createdBy,
      );
      const link = `${window.location.origin}/invite/${token}`;
      this.inviteSuccess.set(link);
    } catch (e) {
      this.inviteError.set('Error al crear la invitación. Inténtalo de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async copyLink(link: string): Promise<void> {
    await navigator.clipboard.writeText(link);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async cancelInvitation(id: string): Promise<void> {
    await this.invitationService.cancelInvitation(id);
  }

  closeInviteForm(): void {
    this.showInviteForm.set(false);
    this.inviteSuccess.set(null);
    this.inviteError.set(null);
  }

  getRoleClass(role: string | undefined, isSuperUser?: boolean): string {
    if (isSuperUser) return 'bg-violet-500/20 text-violet-300';
    const map: Record<string, string> = {
      user:    'bg-slate-700 text-slate-300',
      admin:   'bg-blue-500/20 text-blue-300',
      Admin:   'bg-blue-500/20 text-blue-300',
      Gestor:  'bg-violet-500/20 text-violet-300',
      Usuario: 'bg-slate-700 text-slate-300',
      Viewer:  'bg-slate-600 text-slate-400',
    };
    return map[role ?? 'user'] ?? 'bg-slate-700 text-slate-300';
  }

  getRoleLabel(role: string | undefined, isSuperUser?: boolean): string {
    if (isSuperUser) return 'superuser';
    return role ?? 'user';
  }

  isExpired(inv: CompanyInvitation): boolean {
    return inv.expiresAt.seconds < Date.now() / 1000;
  }
}
