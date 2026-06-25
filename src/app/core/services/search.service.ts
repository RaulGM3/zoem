import { Injectable, signal, computed, inject, type Signal } from '@angular/core';
import { Router } from '@angular/router';

export type SearchCategory = 'contactos' | 'casos' | 'personal';

export interface SearchCategoryMeta {
  readonly key: SearchCategory;
  readonly label: string;
  readonly route: string;
  readonly placeholder: string;
}

/**
 * Búsqueda global del header. Fuente única de verdad: una sola categoría
 * activa y un término. Cada página lee su término scopeado vía `termFor`,
 * de modo que el texto no se "contamina" entre listados distintos.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly router = inject(Router);

  readonly categories: readonly SearchCategoryMeta[] = [
    { key: 'contactos', label: 'Contactos', route: '/contactos', placeholder: 'Buscar por nombre, teléfono o email...' },
    { key: 'casos', label: 'Casos', route: '/casos', placeholder: 'Buscar por título o descripción...' },
    { key: 'personal', label: 'Personal', route: '/usuarios', placeholder: 'Buscar por nombre, teléfono o email...' },
  ];

  readonly category = signal<SearchCategory | null>(null);
  readonly term = signal('');

  readonly activeMeta = computed(
    () => this.categories.find((c) => c.key === this.category()) ?? null
  );

  /** Selecciona una categoría y navega a su ruta preservando el término actual. */
  selectCategory(key: SearchCategory): void {
    const meta = this.categories.find((c) => c.key === key);
    if (!meta) return;
    this.category.set(key);
    this.router.navigateByUrl(meta.route);
  }

  setTerm(value: string): void {
    this.term.set(value);
  }

  /** Término scopeado a una categoría — vacío salvo que esa categoría esté activa. */
  termFor(key: SearchCategory): Signal<string> {
    return computed(() => (this.category() === key ? this.term() : ''));
  }

  /**
   * Sincroniza la categoría activa según la URL sin navegar.
   * Llamado por el layout en cada NavigationEnd para que la búsqueda
   * filtre en la página actual sin requerir selección manual de categoría.
   */
  syncToRoute(url: string): void {
    if (url.startsWith('/contactos')) { this.category.set('contactos'); return; }
    if (url.startsWith('/casos')) { this.category.set('casos'); return; }
    if (url.startsWith('/usuarios')) { this.category.set('personal'); return; }
    this.clear();
  }

  clear(): void {
    this.category.set(null);
    this.term.set('');
  }
}
