import { Component, signal, computed, inject, viewChild, type ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SearchService, type SearchCategory } from '../../core/services/search.service';
import { AuthService } from '../../auth/auth.service';
import { PermissionService } from '../../core/services/permission.service';
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
}

@Component({
  selector: 'app-demo-layout',
  standalone: true,
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

  readonly searchSvc = inject(SearchService);
  private readonly authSvc = inject(AuthService);
  private readonly perm = inject(PermissionService);
  readonly searchMenuOpen = signal(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Íconos por categoría — el adapter lucide vive acá, no en el servicio. */
  readonly categoryIcons: Record<SearchCategory, LucideIconData> = {
    contactos: Users,
    casos: Briefcase,
    personal: UserCog,
  };

  selectSearchCategory(key: SearchCategory): void {
    this.searchSvc.selectCategory(key);
    this.searchMenuOpen.set(false);
    // Mantener el foco en el input para tipear de inmediato tras elegir categoría.
    // El header no se destruye al navegar (es el layout), así que el input persiste.
    this.searchInput()?.nativeElement.focus();
  }

  sidebarOpen = signal(false);
  logoutDialogOpen = signal(false);
  sidebarCollapsed = signal(false);
  sidebarClass = computed(() =>
    this.sidebarCollapsed()
      ? 'hidden flex-col border-r bg-white transition-all duration-300 ease-in-out lg:flex overflow-hidden w-16'
      : 'hidden flex-col border-r bg-white transition-all duration-300 ease-in-out lg:flex overflow-hidden w-64'
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
        // { name: 'Expedientes', href: '/proyectos', icon: FolderKanban },
        { name: 'Contactos', href: '/contactos', icon: Users, modulo: 'Contactos' },
        { name: 'Casos', href: '/casos', icon: Briefcase, modulo: 'Casos' },
        { name: 'Calendario', href: '/calendario', icon: Calendar, modulo: 'Calendario' },
        // { name: 'Eventos', href: '/eventos', icon: CalendarPlus },
        { name: 'Documentos', href: '/documentos', icon: FileText, modulo: 'Documentos' },
      ],
    },
    // {
    //   category: 'Comunicaciones',
    //   items: [
    //     { name: 'Centro de Mensajes', href: '/comunicaciones', icon: Send, badge: 'Nuevo' },
    //   ],
    // },
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
  ];

  /**
   * Menú filtrado por rol: oculta items cuyo módulo el usuario no puede ver,
   * y descarta categorías que quedan sin items. Items sin `modulo` siempre se muestran.
   */
  readonly visibleCategories = computed<NavCategory[]>(() => {
    // Leer la lista de miembros mantiene este computed reactivo cuando el rol llega tras el login.
    this.perm.userRole();
    return this.navCategories
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
