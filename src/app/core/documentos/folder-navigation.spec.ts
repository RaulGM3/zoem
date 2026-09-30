import { describe, it, expect, beforeEach } from 'vitest';
import { FolderNavigation } from './folder-navigation';

interface Carpeta { id: string; name: string; parentId: string | null }

const A: Carpeta = { id: 'a', name: 'A', parentId: null };
const B: Carpeta = { id: 'b', name: 'B', parentId: 'a' };
const C: Carpeta = { id: 'c', name: 'C', parentId: 'b' };

describe('FolderNavigation', () => {
  let nav: FolderNavigation<Carpeta>;

  beforeEach(() => {
    nav = new FolderNavigation<Carpeta>();
  });

  it('empieza en la raíz', () => {
    expect(nav.currentFolderId()).toBeNull();
    expect(nav.path()).toEqual([]);
  });

  it('entrar en una carpeta la añade a la ruta', () => {
    nav.open(A);
    nav.open(B);
    expect(nav.currentFolderId()).toBe('b');
    expect(nav.path()).toEqual([A, B]);
  });

  it('volver a la raíz vacía la ruta', () => {
    nav.open(A);
    nav.toRoot();
    expect(nav.currentFolderId()).toBeNull();
    expect(nav.path()).toEqual([]);
  });

  it('saltar a una miga recorta la ruta hasta ella', () => {
    nav.open(A);
    nav.open(B);
    nav.open(C);
    nav.toBreadcrumb(0);
    expect(nav.currentFolderId()).toBe('a');
    expect(nav.path()).toEqual([A]);
  });

  it('volver atrás sube un nivel y, desde el primero, va a la raíz', () => {
    nav.open(A);
    nav.open(B);
    nav.back();
    expect(nav.path()).toEqual([A]);
    nav.back();
    expect(nav.currentFolderId()).toBeNull();
    nav.back();
    expect(nav.path()).toEqual([]);
  });

  it('ir a una carpeta cualquiera reconstruye la ruta desde sus ancestros', () => {
    nav.goTo('c', [C, A, B]);
    expect(nav.currentFolderId()).toBe('c');
    expect(nav.path()).toEqual([A, B, C]);
  });

  it('al reconstruir la ruta se detiene si falta un ancestro', () => {
    nav.goTo('c', [C, A]);
    expect(nav.currentFolderId()).toBe('c');
    expect(nav.path()).toEqual([C]);
  });
});
