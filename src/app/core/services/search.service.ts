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

  /** Selecciona una categoría, reinicia el término y navega a su ruta. */
  selectCategory(key: SearchCategory): void {
    const meta = this.categories.find((c) => c.key === key);
    if (!meta) return;
    this.category.set(key);
    this.term.set('');
    this.router.navigateByUrl(meta.route);
  }

  setTerm(value: string): void {
    this.term.set(value);
  }

  /** Término scopeado a una categoría — vacío salvo que esa categoría esté activa. */
  termFor(key: SearchCategory): Signal<string> {
    return computed(() => (this.category() === key ? this.term() : ''));
  }

  clear(): void {
    this.category.set(null);
    this.term.set('');
  }
}
