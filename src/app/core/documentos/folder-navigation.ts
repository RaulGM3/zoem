import { signal } from '@angular/core';

interface FolderNode {
  id: string;
  parentId?: string | null;
}

/**
 * Estado de navegación de un árbol de carpetas: la carpeta abierta y la ruta
 * (migas) hasta ella. Lo comparten los exploradores de documentos de
 * plantillas, contactos y casos, que solo difieren en cómo pintan el contenido.
 */
export class FolderNavigation<T extends FolderNode> {
  /** Carpeta abierta; `null` es la raíz. */
  readonly currentFolderId = signal<string | null>(null);
  /** Carpetas desde la raíz hasta la abierta, ambas incluidas. */
  readonly path = signal<T[]>([]);

  open(folder: T): void {
    this.currentFolderId.set(folder.id);
    this.path.update(path => [...path, folder]);
  }

  toRoot(): void {
    this.currentFolderId.set(null);
    this.path.set([]);
  }

  toBreadcrumb(index: number): void {
    const path = this.path();
    this.currentFolderId.set(path[index].id);
    this.path.set(path.slice(0, index + 1));
  }

  back(): void {
    const path = this.path();
    if (path.length <= 1) {
      this.toRoot();
    } else {
      this.toBreadcrumb(path.length - 2);
    }
  }

  /** Abre una carpeta arbitraria reconstruyendo su ruta a partir de `all`. */
  goTo(folderId: string, all: readonly T[]): void {
    const path: T[] = [];
    let currentId: string | null = folderId;
    while (currentId) {
      const folder = all.find(f => f.id === currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parentId ?? null;
    }
    this.currentFolderId.set(folderId);
    this.path.set(path);
  }
}
