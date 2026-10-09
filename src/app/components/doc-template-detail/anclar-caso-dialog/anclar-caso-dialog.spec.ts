import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AnclarCasoDialogComponent } from './anclar-caso-dialog';
import { CasosService } from '../../../core/services/casos.service';
import { CasoDocService } from '../../../core/services/caso-doc.service';
import { DocGenerationService } from '../../../core/services/doc-generation.service';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { cupoDePruebas } from '../../../../testing/cupo-pruebas';
import type { Caso } from '../../../interfaces';

describe('AnclarCasoDialogComponent · cupo de almacenamiento (el .docx anclado se sube a Storage)', () => {
  let fixture: ComponentFixture<AnclarCasoDialogComponent>;
  let cupo: ReturnType<typeof cupoDePruebas>['cupo'];
  let generateDocxBlob: ReturnType<typeof vi.fn>;
  let anclarPlantilla: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    const prueba = cupoDePruebas();
    cupo = prueba.cupo;
    generateDocxBlob = vi.fn().mockResolvedValue(new Blob(['x']));
    anclarPlantilla = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [AnclarCasoDialogComponent],
      providers: [
        ...prueba.providers,
        { provide: CasosService, useValue: { casos: signal<Caso[]>([]), loadCasos: vi.fn().mockResolvedValue(undefined) } },
        { provide: CasoDocService, useValue: { getFolders: vi.fn().mockResolvedValue([]), anclarPlantilla } },
        { provide: DocGenerationService, useValue: { generateDocxBlob } },
        { provide: ToastService, useValue: { run: vi.fn(async (a: () => Promise<unknown>) => a()) } },
        { provide: PermissionService, useValue: { can: () => true } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AnclarCasoDialogComponent);
    fixture.componentRef.setInput('template', { id: 't1', name: 'Contrato', variables: [] });
    fixture.componentRef.setInput('values', {});
    fixture.componentRef.setInput('renderedHtml', '<p>x</p>');
    fixture.detectChanges();
    fixture.componentInstance.selectedCaso.set({ id: 'k1', titulo: 'Caso' } as Caso);
  });

  it('sin cupo no genera ni sube nada: el servicio muestra el modal de mejora', async () => {
    cupo.puedeSubir.mockReturnValue(false);
    await fixture.componentInstance.anchor();
    expect(cupo.puedeSubir).toHaveBeenCalled();
    expect(generateDocxBlob).not.toHaveBeenCalled();
    expect(anclarPlantilla).not.toHaveBeenCalled();
  });

  it('con cupo ancla normalmente', async () => {
    await fixture.componentInstance.anchor();
    expect(anclarPlantilla).toHaveBeenCalledTimes(1);
  });
});
