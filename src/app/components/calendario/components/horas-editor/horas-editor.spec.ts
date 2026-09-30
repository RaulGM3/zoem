import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HorasEditorComponent, RegistrosChange } from './horas-editor';
import { ToastService } from '../../../../core/services/toast.service';
import type { CalendarItem } from '../../calendario.types';
import type { RegistroHoraHito } from '../../../../interfaces';
import { FECHA, MEMBERS, hito, registro } from '../../testing/calendario-fixtures';

describe('HorasEditorComponent', () => {
  let fixture: ComponentFixture<HorasEditorComponent>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let emitido: RegistrosChange[];

  const el = (): HTMLElement => fixture.nativeElement;
  const registrosEmitidos = (): RegistroHoraHito[] => emitido[0].registros;
  const boton = (texto: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent?.trim() === texto);
  const porLabel = <T extends HTMLElement>(label: string): T[] =>
    Array.from(el().querySelectorAll<T>(`[aria-label="${label}"]`));

  function render(item: CalendarItem): void {
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  }

  function cambiar(control: HTMLInputElement | HTMLSelectElement, valor: string): void {
    control.value = valor;
    control.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    toastInfo = vi.fn();
    emitido = [];
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HorasEditorComponent],
      providers: [{ provide: ToastService, useValue: { info: toastInfo } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HorasEditorComponent);
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.componentInstance.registrosChanged.subscribe(cambio => emitido.push(cambio));
  });

  describe('resumen', () => {
    it('sin registros muestra el estado vacío y el botón "Registrar horas"', () => {
      render(hito());
      expect(el().textContent).toContain('Sin horas registradas todavía');
      expect(boton('Registrar horas')).toBeTruthy();
    });

    it('con registros muestra miembro, horario, horas y el botón "Editar horas"', () => {
      render(hito({ registrosHoras: [registro({ horaFin: '10:30', minutos: 90 })] }));
      const texto = el().textContent ?? '';
      expect(texto).toContain('Ana');
      expect(texto).toContain('09:00–10:30');
      expect(texto).toContain('1.5h');
      expect(boton('Editar horas')).toBeTruthy();
    });

    it('muestra "Sin asignar" si el miembro del registro ya no existe', () => {
      render(hito({ registrosHoras: [registro({ userId: 'fantasma' })] }));
      expect(el().textContent).toContain('Sin asignar');
    });

    it('marca los registros facturados', () => {
      render(hito({ registrosHoras: [registro({ facturado: true })] }));
      expect(el().textContent).toContain('Facturado');
    });
  });

  describe('edición', () => {
    it('al registrar horas siembra un bloque por defecto con el primer asignado', () => {
      render(hito());
      click(boton('Registrar horas'));
      expect(porLabel('Miembro')).toHaveLength(1);
      expect(porLabel<HTMLInputElement>('Fecha')[0].value).toBe(FECHA);
      expect(el().textContent).toContain('Total: 1h');
      click(boton('Guardar horas'));
      expect(emitido).toHaveLength(1);
      expect(emitido[0]).toMatchObject({ hitoId: 'h1', casoId: 'c1' });
      expect(registrosEmitidos()).toHaveLength(1);
      expect(registrosEmitidos()[0]).toMatchObject({
        userId: 'u2', fecha: FECHA, horaInicio: '09:00', horaFin: '10:00', minutos: 60,
      });
    });

    it('sin asignados usa el primer miembro del despacho', () => {
      render(hito({ asignadosA: undefined }));
      click(boton('Registrar horas'));
      click(boton('Guardar horas'));
      expect(registrosEmitidos()[0].userId).toBe('u1');
    });

    it('el bloque por defecto parte de la hora y duración del hito si las tiene', () => {
      render(hito({ horaInicio: '16:00', duracionMinutos: 30 }));
      click(boton('Registrar horas'));
      click(boton('Guardar horas'));
      expect(registrosEmitidos()[0]).toMatchObject({ horaInicio: '16:00', horaFin: '16:30', minutos: 30 });
    });

    it('oculta el botón de abrir mientras el editor está abierto', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      expect(boton('Editar horas')).toBeUndefined();
    });

    it('cierra el editor al guardar', () => {
      render(hito());
      click(boton('Registrar horas'));
      click(boton('Guardar horas'));
      expect(boton('Guardar horas')).toBeUndefined();
    });

    it('cancelar cierra el editor sin emitir', () => {
      render(hito());
      click(boton('Registrar horas'));
      click(boton('Cancelar'));
      expect(boton('Guardar horas')).toBeUndefined();
      expect(emitido).toHaveLength(0);
    });

    it('recalcula los minutos y el total al cambiar las horas', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '11:30');
      expect(el().textContent).toContain('Total: 2.5h');
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([registro({ horaFin: '11:30', minutos: 150 })]);
    });

    it('permite cambiar el miembro y la fecha de un bloque', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLSelectElement>('Miembro')[0], 'u2');
      cambiar(porLabel<HTMLInputElement>('Fecha')[0], '2026-03-12');
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([registro({ userId: 'u2', fecha: '2026-03-12' })]);
    });

    it('añade bloques nuevos', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      click(boton('Añadir bloque'));
      expect(porLabel('Miembro')).toHaveLength(2);
      expect(el().textContent).toContain('Total: 2h');
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toHaveLength(2);
      expect(registrosEmitidos()[1].id).not.toBe('r1');
    });

    it('separar duplica el bloque en el día siguiente', () => {
      render(hito({ registrosHoras: [registro({ fecha: '2026-03-31' })] }));
      click(boton('Editar horas'));
      click(porLabel<HTMLButtonElement>('Separar bloque en otro día')[0]);
      click(boton('Guardar horas'));
      expect(registrosEmitidos().map(r => r.fecha)).toEqual(['2026-03-31', '2026-04-01']);
      expect(registrosEmitidos()[1]).toMatchObject({ userId: 'u1', horaInicio: '09:00', horaFin: '10:00', minutos: 60 });
    });

    it('elimina bloques', () => {
      render(hito({ registrosHoras: [registro(), registro({ id: 'r2', horaInicio: '12:00', horaFin: '13:00' })] }));
      click(boton('Editar horas'));
      click(porLabel<HTMLButtonElement>('Eliminar bloque')[0]);
      click(boton('Guardar horas'));
      expect(registrosEmitidos().map(r => r.id)).toEqual(['r2']);
    });

    it('descarta al guardar los bloques sin duración', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '08:00');
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([]);
    });

    it('los bloques facturados no se pueden editar ni borrar y se conservan', () => {
      const facturado = registro({ facturado: true, movimientoId: 'mov1' });
      render(hito({ registrosHoras: [facturado] }));
      click(boton('Editar horas'));
      expect(porLabel<HTMLSelectElement>('Miembro')[0].disabled).toBe(true);
      expect(porLabel<HTMLInputElement>('Hora fin')[0].disabled).toBe(true);
      expect(porLabel('Eliminar bloque')).toHaveLength(0);
      expect(porLabel('Separar bloque en otro día')).toHaveLength(0);
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([facturado]);
    });
  });

  describe('edición concurrente', () => {
    const r2 = registro({ id: 'r2', horaInicio: '12:00', horaFin: '13:00' });

    it('conserva los bloques que otro usuario añadió mientras el editor estaba abierto', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '11:00');
      const ajeno = registro({ id: 'r9', userId: 'u2', horaInicio: '15:00', horaFin: '16:00' });
      render(hito({ registrosHoras: [registro(), ajeno] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([registro({ horaFin: '11:00', minutos: 120 }), ajeno]);
      expect(toastInfo).not.toHaveBeenCalled();
    });

    it('si ambos editan el mismo bloque gana el servidor y se avisa', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '11:00');
      const remoto = registro({ horaFin: '12:00', minutos: 180 });
      render(hito({ registrosHoras: [remoto] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([remoto]);
      expect(toastInfo).toHaveBeenCalledTimes(1);
      expect(toastInfo).toHaveBeenCalledWith(
        'Alguien más editó alguno de estos bloques de horas mientras los modificabas; se ha conservado su versión.',
        'Edición concurrente detectada',
      );
    });

    it('no avisa si ambos llegaron al mismo valor', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '11:00');
      render(hito({ registrosHoras: [registro({ horaFin: '11:00', minutos: 120 })] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([registro({ horaFin: '11:00', minutos: 120 })]);
      expect(toastInfo).not.toHaveBeenCalled();
    });

    it('si solo cambió en el servidor conserva la versión remota sin avisar', () => {
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      const remoto = registro({ horaFin: '12:00', minutos: 180 });
      render(hito({ registrosHoras: [remoto] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos()).toEqual([remoto]);
      expect(toastInfo).not.toHaveBeenCalled();
    });

    it('no resucita un bloque que otro usuario borró, y avisa', () => {
      render(hito({ registrosHoras: [registro(), r2] }));
      click(boton('Editar horas'));
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos().map(r => r.id)).toEqual(['r1']);
      expect(toastInfo).toHaveBeenCalledWith(
        'Un bloque fue eliminado por otro usuario y no se restauró.',
        'Edición concurrente detectada',
      );
    });

    it('avisa si se borra localmente un bloque que otro usuario había modificado', () => {
      render(hito({ registrosHoras: [registro(), r2] }));
      click(boton('Editar horas'));
      click(porLabel<HTMLButtonElement>('Eliminar bloque')[0]);
      render(hito({ registrosHoras: [registro({ horaFin: '10:30', minutos: 90 }), r2] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos().map(r => r.id)).toEqual(['r2']);
      expect(toastInfo).toHaveBeenCalledWith(
        'Se eliminó un bloque que otro usuario había modificado mientras tanto.',
        'Edición concurrente detectada',
      );
    });

    it('un bloque facturado en el servidor se conserva aunque se borre localmente', () => {
      render(hito({ registrosHoras: [registro(), r2] }));
      click(boton('Editar horas'));
      click(porLabel<HTMLButtonElement>('Eliminar bloque')[0]);
      const facturado = registro({ facturado: true, movimientoId: 'mov1' });
      render(hito({ registrosHoras: [facturado, r2] }));
      click(boton('Guardar horas'));
      expect(registrosEmitidos().map(r => r.id).sort()).toEqual(['r1', 'r2']);
      expect(registrosEmitidos().find(r => r.id === 'r1')).toEqual(facturado);
    });
  });
});
