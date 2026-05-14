import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  ArrowLeft,
  Building2,
  LucideAngularModule,
  Shield,
  Users,
} from 'lucide-angular';
import { CompanyService } from '../../../core/services/company.service';

@Component({
  selector: 'app-superuser-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './superuser-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperuserLayoutComponent implements OnInit {
  readonly ShieldIcon = Shield;
  readonly Building2Icon = Building2;
  readonly UsersIcon = Users;
  readonly ArrowLeftIcon = ArrowLeft;

  private readonly companyService = inject(CompanyService);

  readonly companies = this.companyService.allCompanies;
  readonly activeCompany = this.companyService.activeCompany;

  async ngOnInit(): Promise<void> {
    await this.companyService.loadAllCompanies();
  }

  selectCompany(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const company = this.companies().find((c) => c.id === id);
    if (company) this.companyService.setActiveCompany(company);
  }
}
