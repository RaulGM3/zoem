import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoDocSlotRowComponent } from './caso-doc-slot-row';
import type { CasoDocSlot } from '../../../../interfaces';
import { mockViewport } from '../../mock-viewport';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const slot = (extra: Record<string, unknown> = {}): CasoDocSlot =>
  ({ id: 's1', folderId: null, name: 'DNI', status: 'subido', downloadUrl: 'http://x/dni', ...extra }) as unknown as CasoDocSlot;

describe('CasoDocSlotRowComponent — móvil', () => {
  let fixture: ComponentFixture<CasoDocSlotRowComponent>;
  let eventos: string[];
  const el = (): HTMLElement => fixture.nativeElement;
  const acciones = (): { id: string; disabled?: boolean }[] => fixture.componentInstance.acciones();

  async function montar(mobile: boolean, s: CasoDocSlot, inputs: Record<string, unknown> = {}): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [CasoDocSlotRowComponent] });
    fixture = TestBed.createComponent(CasoDocSlotRowComponent);
    const c = fixture.componentInstance;
    eventos = [];
    c.preview.subscribe(() => eventos.push('preview'));
    c.history.subscribe(() => eventos.push('history'));
    c.access.subscribe(() => eventos.push('access'));
    c.remove.subscribe(() => eventos.push('remove'));
    fixture.componentRef.setInput('slot', s);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
  }

  async function elegir(id: string): Promise<void> {
    el().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('acciones: subido con todos los permisos', async () => {
    await montar(true, slot(), { isAdmin: true });
    expect(acciones().map((a) => a.id)).toEqual(['preview', 'history', 'access', 'remove']);
  });

  it('acciones: sin URL no hay previsualización; sin permisos solo historial', async () => {
    await montar(true, slot({ downloadUrl: undefined }), { canDelete: false });
    expect(acciones().map((a) => a.id)).toEqual(['history']);
  });

  it('acciones: clasificado con storagePath permite previsualizar', async () => {
    await montar(true, slot({ downloadUrl: undefined, clasificado: true, storagePath: 'p/x' }), { canDelete: false });
    expect(acciones().map((a) => a.id)).toEqual(['preview', 'history']);
  });

  it('acciones: quitar se deshabilita mientras hay una subida en curso', async () => {
    await montar(true, slot(), { uploading: true });
    expect(acciones().find((a) => a.id === 'remove')!.disabled).toBe(true);
  });

  it('acciones: slot pendiente o con plantilla no tiene menú', async () => {
    await montar(true, slot({ status: 'pendiente' }));
    expect(acciones()).toEqual([]);
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('móvil: subido muestra un único menú y no los iconos inline', async () => {
    await montar(true, slot(), { isAdmin: true });
    expect(el().querySelectorAll('button[aria-haspopup="menu"]')).toHaveLength(1);
    expect(el().querySelector('button[aria-label="Previsualizar"]')).toBeNull();
  });

  it('móvil: elegir acciones emite los mismos outputs que escritorio', async () => {
    await montar(true, slot(), { isAdmin: true });
    for (const id of ['preview', 'history', 'access', 'remove']) await elegir(id);
    expect(eventos).toEqual(['preview', 'history', 'access', 'remove']);
  });

  it('móvil: el botón principal "Subir" tiene área táctil', async () => {
    await montar(true, slot({ status: 'pendiente' }));
    const subir = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Subir'))!;
    expect(subir.classList.contains('max-sm:tap-target')).toBe(true);
  });

  it('la fila se apila en móvil y se alinea en fila desde sm', async () => {
    await montar(true, slot());
    const fila = el().firstElementChild!;
    expect(fila.classList.contains('flex-col')).toBe(true);
    expect(fila.classList.contains('sm:flex-row')).toBe(true);
  });

  it('escritorio: iconos inline, sin menú', async () => {
    await montar(false, slot(), { isAdmin: true });
    expect(el().querySelector('button[aria-haspopup="menu"]')).toBeNull();
    expect(el().querySelector('button[aria-label="Previsualizar"]')).not.toBeNull();
    expect(el().querySelector('button[aria-label="Quitar documento"]')).not.toBeNull();
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true, slot(), { isAdmin: true });
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
