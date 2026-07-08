import { Component, signal, computed, inject, viewChild, type ElementRef, DestroyRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SearchService, type SearchCategory } from '../../core/services/search.service';
import { AuthService } from '../../auth/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { ThemeService } from '../../core/services/theme.service';
import type { Modulo } from '../../core/permissions/permissions';
import {
  LucideAngularModule,
  LucideIconData,
  Layers,
  LayoutDashboard,
  BarChart3,
  MessagesSquare,
  Bot,
  Sparkles,
  FolderKanban,
  Users,
  Calendar,
  CalendarPlus,
  FileText,
  Send,
  Receipt,
  Wallet,
  UserCog,
  Briefcase,
  User,
  ShieldCheck,
  ArrowLeft,
  Bell,
  Search,
  Menu,
  Settings,
  LogOut,
  X,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-angular';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIconData;
  badge?: string;
  /** Módulo que gatea el item. Sin módulo = visible siempre (Dashboard, Mi Perfil). */
  modulo?: Modulo;
}

export interface NavCategory {
  category: string;
  items: NavItem[];
  superuserOnly?: boolean;
}

@Component({
  selector: 'app-demo-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './demo-layout.html',
})
export class DemoLayoutComponent {
  readonly LayersIcon = Layers;
  readonly ArrowLeftIcon = ArrowLeft;
  readonly ChevronsLeftIcon = ChevronsLeft;
  readonly ChevronsRightIcon = ChevronsRight;
  readonly BellIcon = Bell;
  readonly SearchIcon = Search;
  readonly MenuIcon = Menu;
  readonly XIcon = X;
  readonly SettingsIcon = Settings;
  readonly LogOutIcon = LogOut;
  readonly ShieldCheckIcon = ShieldCheck;

  readonly searchSvc = inject(SearchService);
  readonly themeSvc = inject(ThemeService);
  private readonly authSvc = inject(AuthService);
  private readonly perm = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly searchMenuOpen = signal(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    // Sync active search category to current route on every navigation.
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => {
      this.searchSvc.syncToRoute(e.urlAfterRedirects);
    });
    // Sync on initial load.
    this.searchSvc.syncToRoute(this.router.url);
  }

  /** Íconos por categoría — el adapter lucide vive acá, no en el servicio. */
  readonly categoryIcons: Record<SearchCategory, LucideIconData> = {
    contactos: Users,
    casos: Briefcase,
    personal: UserCog,
  };

  selectSearchCategory(key: SearchCategory): void {
    this.searchSvc.selectCategory(key);
    this.searchMenuOpen.set(false);
    this.searchInput()?.nativeElement.focus();
  }

  clearSearch(): void {
    this.searchSvc.setTerm('');
    this.searchMenuOpen.set(false);
    this.searchInput()?.nativeElement.focus();
  }

  closeSearch(): void {
    this.searchMenuOpen.set(false);
    this.searchSvc.clear();
    this.searchInput()?.nativeElement.blur();
  }

  submitSearch(): void {
    const meta = this.searchSvc.activeMeta();
    if (!meta) {
      this.searchMenuOpen.set(true);
      return;
    }
    this.searchMenuOpen.set(false);
    this.router.navigateByUrl(meta.route);
  }

  sidebarOpen = signal(false);
  logoutDialogOpen = signal(false);
  sidebarCollapsed = signal(false);
  sidebarClass = computed(() =>
    this.sidebarCollapsed()
      ? 'hidden flex-col lg:flex overflow-hidden w-16 transition-all duration-300 ease-in-out'
      : 'hidden flex-col lg:flex overflow-hidden w-64 transition-all duration-300 ease-in-out'
  );

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  async confirmLogout(): Promise<void> {
    this.logoutDialogOpen.set(false);
    await this.authSvc.logout();
  }

  navCategories: NavCategory[] = [
    {
      category: 'Principal',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        // { name: 'Informes', href: '/informes', icon: BarChart3, badge: 'Nuevo' },
      ],
    },
    {
      category: 'Inteligencia Artificial',
      items: [
        { name: 'Recepción IA', href: '/recepcion-ia', icon: MessagesSquare, modulo: 'RecepciónIA' },
        // { name: 'Agente IA', href: '/agente-ia', icon: Bot, badge: 'Online' },
        // { name: 'Vertey Studio', href: '/vertey-studio', icon: Sparkles, badge: 'Pro' },
      ],
    },
    {
      category: 'Gestión',
      items: [
        { name: 'Contactos', href: '/contactos', icon: Users, modulo: 'Contactos' },
        { name: 'Casos', href: '/casos', icon: Briefcase, modulo: 'Casos' },
        { name: 'Calendario', href: '/calendario', icon: Calendar, modulo: 'Calendario' },
        { name: 'Documentos', href: '/documentos', icon: FileText, modulo: 'Documentos' },
      ],
    },
    {
      category: 'Finanzas',
      items: [
        { name: 'Facturación', href: '/facturacion', icon: Receipt, modulo: 'Facturación' },
        { name: 'Tesorería', href: '/tesoreria', icon: Wallet, modulo: 'Tesorería' },
      ],
    },
    {
      category: 'Configuración',
      items: [
        { name: 'Usuarios y Permisos', href: '/usuarios', icon: UserCog, badge: 'Nuevo', modulo: 'Configuración' },
        { name: 'Mi Perfil', href: '/perfil', icon: User },
      ],
    },
    {
      category: 'Superuser',
      superuserOnly: true,
      items: [
        { name: 'Superuser', href: '/superuser', icon: ShieldCheck },
      ],
    },
  ];

  /**
   * Menú filtrado por rol: oculta items cuyo módulo el usuario no puede ver,
   * y descarta categorías que quedan sin items. Items sin `modulo` siempre se muestran.
   */
  readonly visibleCategories = computed<NavCategory[]>(() => {
    // Leer la lista de miembros mantiene este computed reactivo cuando el rol llega tras el login.
    this.perm.userRole();
    const isSuperUser = this.perm.isSuperUser();
    return this.navCategories
      .filter(cat => !cat.superuserOnly || isSuperUser)
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item => !item.modulo || this.perm.can(item.modulo, 'ver')),
      }))
      .filter(cat => cat.items.length > 0);
  });

  getBadgeClass(badge?: string): string {
    if (badge === 'Online') return 'bg-emerald-500/20 text-emerald-400';
    if (badge === 'Pro') return 'bg-violet-500/20 text-violet-400';
    return 'bg-blue-500/20 text-blue-400';
  }
}
