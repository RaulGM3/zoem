import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NuevaPlantillaDrawerComponent } from './nueva-plantilla-drawer';
import { DocExtractionService } from '../../../../core/services/doc-extraction.service';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { cupoDePruebas } from '../../../../../testing/cupo-pruebas';

describe('NuevaPlantillaDrawerComponent · cupo de almacenamiento (la fuente se guarda en Storage)', () => {
  let fixture: ComponentFixture<NuevaPlantillaDrawerComponent>;
  let cupo: ReturnType<typeof cupoDePruebas>['cupo'];
  const el = (): HTMLElement => fixture.nativeElement;
  const input = (): HTMLInputElement => el().querySelector<HTMLInputElement>('input[type="file"]')!;
  const dropZone = (): HTMLElement => input().closest('label')!;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    const prueba = cupoDePruebas();
    cupo = prueba.cupo;
    await TestBed.configureTestingModule({
      imports: [NuevaPlantillaDrawerComponent],
      providers: [
        ...prueba.providers,
        { provide: DocExtractionService, useValue: { extractFromFile: vi.fn() } },
        { provide: DocTemplateService, useValue: { createTemplate: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NuevaPlantillaDrawerComponent);
    fixture.detectChanges();
  });

  it('sin cupo el selector no se abre (click cancelado)', () => {
    cupo.puedeSubir.mockReturnValue(false);
    const click = new MouseEvent('click', { cancelable: true, bubbles: true });
    input().dispatchEvent(click);
    expect(cupo.puedeSubir).toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
  });

  it('sin cupo, soltar un archivo en la zona de arrastre no lo acepta', () => {
    cupo.puedeSubir.mockReturnValue(false);
    const archivo = new File(['x'], 'contrato.docx');
    const drop = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [archivo] } });
    dropZone().dispatchEvent(drop);
    fixture.detectChanges();
    expect(fixture.componentInstance.file()).toBeNull();
    expect(drop.defaultPrevented).toBe(true);
  });

  it('con cupo, el archivo soltado o elegido se acepta; si no cabe, se descarta', () => {
    const cabe = new File(['x'], 'cabe.docx');
    const drop = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [cabe] } });
    dropZone().dispatchEvent(drop);
    expect(fixture.componentInstance.file()).toBe(cabe);

    cupo.admitir.mockReturnValue([]);
    const enorme = new File(['x'], 'enorme.docx');
    Object.defineProperty(input(), 'files', { value: [enorme], configurable: true });
    input().dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.file()).toBe(cabe); // no se reemplaza
  });
});
