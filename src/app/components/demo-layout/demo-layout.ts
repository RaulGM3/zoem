import { Component, signal, inject, viewChild, type ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SearchService, type SearchCategory } from '../../core/services/search.service';
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
} from 'lucide-angular';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIconData;
  badge?: string;
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
  readonly BellIcon = Bell;
  readonly SearchIcon = Search;
  readonly MenuIcon = Menu;
  readonly XIcon = X;
  readonly SettingsIcon = Settings;
  readonly LogOutIcon = LogOut;

  readonly searchSvc = inject(SearchService);
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
        { name: 'Recepción IA', href: '/recepcion-ia', icon: MessagesSquare },
        // { name: 'Agente IA', href: '/agente-ia', icon: Bot, badge: 'Online' },
        // { name: 'Vertey Studio', href: '/vertey-studio', icon: Sparkles, badge: 'Pro' },
      ],
    },
    {
      category: 'Gestión',
      items: [
        // { name: 'Expedientes', href: '/proyectos', icon: FolderKanban },
        { name: 'Contactos', href: '/contactos', icon: Users },
        { name: 'Casos', href: '/casos', icon: Briefcase },
        { name: 'Calendario', href: '/calendario', icon: Calendar },
        // { name: 'Eventos', href: '/eventos', icon: CalendarPlus },
        { name: 'Documentos', href: '/documentos', icon: FileText },
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
        { name: 'Facturación', href: '/facturacion', icon: Receipt },
        { name: 'Tesorería', href: '/tesoreria', icon: Wallet },
      ],
    },
    {
      category: 'Configuración',
      items: [
        { name: 'Usuarios y Permisos', href: '/usuarios', icon: UserCog, badge: 'Nuevo' },
        { name: 'Mi Perfil', href: '/perfil', icon: User },
      ],
    },
  ];

  getBadgeClass(badge?: string): string {
    if (badge === 'Online') return 'bg-emerald-500/20 text-emerald-400';
    if (badge === 'Pro') return 'bg-violet-500/20 text-violet-400';
    return 'bg-blue-500/20 text-blue-400';
  }
}
