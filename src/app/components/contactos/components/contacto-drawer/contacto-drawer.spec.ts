import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactoDrawerComponent } from './contacto-drawer';
import { ContactService } from '../../../../core/services/contact.service';
import { UsersService } from '../../../../core/services/users';
import { ToastService } from '../../../../core/services/toast.service';
import type { CompanyMember, Contact } from '../../../../interfaces';

interface RunOptions { successMessage?: string; errorTitle?: string; onSuccess?: () => void }

const ANA = {
  id: 'c1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'López', nifType: 'nie', nif: 'X1234567L',
  nacionalidad: 'FR', estadoCivil: 'soltero', email: 'ana@example.com', mobile: '600111222', status: 'activo',
  notes: 'Cliente VIP', asunto: 'Herencia', canalEntrada: 'web', assignedTo: 'u2', totalBilled: 1000, activeProjects: 2,
  direccion: { calle: 'Mayor', numero: '3', codigoPostal: '28001', municipio: 'Madrid', provincia: 'Madrid', pais: 'ES' },
  createdAt: { toMillis: () => 100 },
} as unknown as Contact;

const ACME = {
  id: 'c2', type: 'persona_juridica', razonSocial: 'Acme S.L.', nombreComercial: 'Acme', formaJuridica: 'S.L.',
  cifType: 'vat', cif: 'B12345678', sectorActividad: 'Logística', website: 'https://acme.test',
  representanteLegalNombre: 'Luis Pérez', email: 'info@acme.test', mobile: '', status: 'potencial', totalBilled: 500,
  direccionSocial: { calle: 'Gran Vía', numero: '1', codigoPostal: '08001', municipio: 'Barcelona', provincia: 'Barcelona', pais: 'ES' },
  createdAt: { toMillis: () => 200 },
} as unknown as Contact;

const MEMBERS = [
  { id: 'm1', userId: 'u1', nombre: 'Marta' },
  { id: 'm2', userId: 'u2', nombre: 'Luis', apellido: 'Gil' },
] as CompanyMember[];

describe('ContactoDrawerComponent', () => {
  let fixture: ComponentFixture<ContactoDrawerComponent>;
  let run: ReturnType<typeof vi.fn>;
  let contactService: {
    createContact: ReturnType<typeof vi.fn>;
    updateContact: ReturnType<typeof vi.fn>;
  };
  let cierres: number;
  let guardados: (Contact | null)[];

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string): T => {
    const found = el().querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
  const qa = <T extends HTMLElement>(selector: string): T[] => Array.from(el().querySelectorAll<T>(selector));
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.replace(/\s+/g, ' ').includes(texto));
  const drawer = (): HTMLElement | null => el().querySelector('aside[role="dialog"]');
  /** El drawer no se desmonta solo: pide al padre que lo cierre. */
  const cerrado = (): boolean => cierres + guardados.length > 0;
  const payloadCreado = () => contactService.createContact.mock.calls[0][0];
  const payloadActualizado = () => contactService.updateContact.mock.calls[0];

  async function estable(): Promise<void> {
    fixture.detectChanges();
    // Deja correr las promesas encadenadas (toast.run) antes de repintar.
    await new Promise(resolve => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(target: HTMLElement | undefined | null): Promise<void> {
    expect(target).toBeTruthy();
    target!.click();
    await estable();
  }

  function escribir(id: string, valor: string): void {
    const control = q<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    control.value = valor;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  const valor = (id: string): string => q<HTMLInputElement>(`#${id}`).value;
  const existe = (id: string): boolean => el().querySelector(`#${id}`) !== null;

  async function abrir(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(ContactoDrawerComponent);
    for (const [nombre, v] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, v);
    fixture.componentInstance.closed.subscribe(() => cierres++);
    fixture.componentInstance.saved.subscribe(c => guardados.push(c));
    await estable();
  }

  const abrirNuevo = (): Promise<void> => abrir();
  const abrirEdicion = (nombre: string): Promise<void> => abrir({ contact: nombre === 'Ana López' ? ANA : ACME });

  beforeEach(async () => {
    cierres = 0;
    guardados = [];
    run = vi.fn(async (action: () => Promise<unknown>, opts: RunOptions = {}) => {
      try {
        const result = await action();
        opts.onSuccess?.();
        return result;
      } catch {
        return undefined;
      }
    });
    contactService = {
      createContact: vi.fn().mockImplementation(async (data: object) => ({ id: 'nuevo', ...data })),
      updateContact: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ContactoDrawerComponent],
      providers: [
        { provide: ContactService, useValue: contactService },
        { provide: UsersService, useValue: { members: signal(MEMBERS) } },
        { provide: ToastService, useValue: { run } },
      ],
    }).compileComponents();
  });

  function rellenarPaso1(): void {
    escribir('nombre', 'Eva');
    escribir('apellidos', 'Ruiz');
    escribir('email', 'eva@example.com');
  }

  describe('alta', () => {
    it('abre en el paso 1 con los valores por defecto', async () => {
      await abrirNuevo();
      expect(drawer()!.getAttribute('aria-label')).toBe('Nuevo contacto');
      expect(valor('status')).toBe('activo');
      expect(valor('nifType')).toBe('dni');
      expect(existe('nombre')).toBe(true);
      expect(existe('calle')).toBe(false);
      expect(existe('estadoCivil')).toBe(false);
      expect(drawer()!.textContent).toContain('Datos principales');
    });

    it('no avanza y marca los errores si faltan los datos obligatorios', async () => {
      await abrirNuevo();
      await click(boton('Continuar', drawer()!));
      expect(existe('calle')).toBe(false);
      expect(qa('.form-error').map(e => e.textContent?.trim())).toEqual([
        'Campo obligatorio', 'Campo obligatorio', 'Indica al menos un email o un móvil.',
      ]);
      expect(contactService.createContact).not.toHaveBeenCalled();
    });

    it('no avanza con un email mal formado', async () => {
      await abrirNuevo();
      escribir('nombre', 'Eva');
      escribir('apellidos', 'Ruiz');
      escribir('email', 'no-es-email');
      await click(boton('Continuar', drawer()!));
      expect(existe('calle')).toBe(false);
      expect(drawer()!.textContent).toContain('Email no válido');
    });

    it('basta con el móvil como vía de contacto', async () => {
      await abrirNuevo();
      escribir('nombre', 'Eva');
      escribir('apellidos', 'Ruiz');
      escribir('mobile', '611222333');
      await click(boton('Continuar', drawer()!));
      expect(existe('calle')).toBe(true);
    });

    it('avanza al paso 2 y permite volver conservando lo escrito', async () => {
      await abrirNuevo();
      rellenarPaso1();
      await click(boton('Continuar', drawer()!));
      expect(existe('nombre')).toBe(false);
      expect(valor('pais')).toBe('ES');
      expect(valor('estadoCivil')).toBe('casado');
      await click(boton('Atrás', drawer()!));
      expect(valor('nombre')).toBe('Eva');
      expect(valor('email')).toBe('eva@example.com');
    });

    it('crea una persona física con todos sus datos', async () => {
      await abrirNuevo();
      rellenarPaso1();
      escribir('nifType', 'nie');
      escribir('nif', 'Y7654321G');
      escribir('mobile', '611222333');
      escribir('status', 'potencial');
      escribir('notes', 'Llamar por la tarde');
      escribir('asunto', 'Divorcio');
      escribir('canalEntrada', 'web');
      escribir('assignedTo', 'u2');
      await click(boton('Continuar', drawer()!));
      escribir('estadoCivil', 'soltero');
      escribir('calle', 'Sol');
      escribir('municipio', 'Sevilla');
      await click(boton('Guardar contacto', drawer()!));
      expect(contactService.updateContact).not.toHaveBeenCalled();
      expect(payloadCreado()).toEqual({
        type: 'persona_fisica',
        email: 'eva@example.com', mobile: '611222333', status: 'potencial', notes: 'Llamar por la tarde',
        asunto: 'Divorcio', canalEntrada: 'web', assignedTo: 'u2',
        nombre: 'Eva', apellidos: 'Ruiz', nifType: 'nie', nif: 'Y7654321G', nacionalidad: 'ES', estadoCivil: 'soltero',
        direccion: { calle: 'Sol', numero: '', codigoPostal: '', municipio: 'Sevilla', provincia: '', pais: 'ES' },
      });
      expect(run.mock.calls.at(-1)![1]).toMatchObject({ successMessage: 'Contacto creado' });
      expect(cerrado()).toBe(true);
    });

    it('crea una persona jurídica', async () => {
      await abrirNuevo();
      await click(boton('Persona Jurídica', drawer()!));
      expect(existe('nombre')).toBe(false);
      escribir('razonSocial', 'Beta S.A.');
      escribir('cif', 'A11111119');
      escribir('email', 'hola@beta.test');
      await click(boton('Continuar', drawer()!));
      escribir('formaJuridica', 'S.A.');
      escribir('website', 'https://beta.test');
      await click(boton('Guardar contacto', drawer()!));
      expect(payloadCreado()).toEqual({
        type: 'persona_juridica',
        email: 'hola@beta.test', mobile: '', status: 'activo', notes: '',
        asunto: undefined, canalEntrada: undefined, assignedTo: undefined,
        razonSocial: 'Beta S.A.', nombreComercial: '', formaJuridica: 'S.A.', cifType: 'cif', cif: 'A11111119',
        sectorActividad: '', website: 'https://beta.test', representanteLegalNombre: '',
        direccionSocial: { calle: '', numero: '', codigoPostal: '', municipio: '', provincia: '', pais: 'ES' },
      });
    });

    it('si el guardado falla el drawer sigue abierto con los datos', async () => {
      contactService.createContact.mockRejectedValue(new Error('sin red'));
      await abrirNuevo();
      rellenarPaso1();
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(cerrado()).toBe(false);
      expect(boton('Guardar contacto', drawer()!)!.disabled).toBe(false);
      await click(boton('Atrás', drawer()!));
      expect(valor('nombre')).toBe('Eva');
    });

    it('bloquea el botón mientras guarda', async () => {
      let resolver!: (c: Contact) => void;
      contactService.createContact.mockReturnValue(new Promise<Contact>(r => (resolver = r)));
      await abrirNuevo();
      rellenarPaso1();
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(boton('Guardar contacto', drawer()!)!.disabled).toBe(true);
      resolver(ANA);
      await estable();
      expect(cerrado()).toBe(true);
    });

    it('se cierra con Cancelar, con Cerrar y con Escape', async () => {
      await abrirNuevo();
      await click(boton('Cancelar', drawer()!));
      expect(cerrado()).toBe(true);
    });
  });

  describe('edición', () => {
    it('muestra todos los campos de una persona física con sus datos', async () => {
      await abrirEdicion('Ana López');
      expect(drawer()!.getAttribute('aria-label')).toBe('Editar contacto');
      expect(drawer()!.textContent).not.toContain('Datos principales');
      expect([valor('nombre'), valor('apellidos'), valor('nifType'), valor('nif')]).toEqual(['Ana', 'López', 'nie', 'X1234567L']);
      expect([valor('nacionalidad'), valor('estadoCivil')]).toEqual(['FR', 'soltero']);
      expect([valor('email'), valor('mobile'), valor('status')]).toEqual(['ana@example.com', '600111222', 'activo']);
      expect([valor('notes'), valor('asunto'), valor('canalEntrada'), valor('assignedTo')]).toEqual(['Cliente VIP', 'Herencia', 'web', 'u2']);
      expect([valor('calle'), valor('numero'), valor('codigoPostal'), valor('municipio'), valor('provincia'), valor('pais')])
        .toEqual(['Mayor', '3', '28001', 'Madrid', 'Madrid', 'ES']);
    });

    it('muestra los datos de una persona jurídica', async () => {
      await abrirEdicion('Acme S.L.');
      expect([valor('razonSocial'), valor('cifType'), valor('cif')]).toEqual(['Acme S.L.', 'vat', 'B12345678']);
      expect([valor('nombreComercial'), valor('formaJuridica'), valor('sectorActividad'), valor('website'), valor('representanteLegalNombre')])
        .toEqual(['Acme', 'S.L.', 'Logística', 'https://acme.test', 'Luis Pérez']);
      expect(valor('calle')).toBe('Gran Vía');
    });

    it('guarda los cambios sobre el contacto editado', async () => {
      await abrirEdicion('Ana López');
      escribir('apellidos', 'López Díaz');
      escribir('municipio', 'Getafe');
      await click(boton('Guardar cambios', drawer()!));
      expect(contactService.createContact).not.toHaveBeenCalled();
      expect(payloadActualizado()[0]).toBe('c1');
      expect(payloadActualizado()[1]).toEqual({
        type: 'persona_fisica',
        email: 'ana@example.com', mobile: '600111222', status: 'activo', notes: 'Cliente VIP',
        asunto: 'Herencia', canalEntrada: 'web', assignedTo: 'u2',
        nombre: 'Ana', apellidos: 'López Díaz', nifType: 'nie', nif: 'X1234567L', nacionalidad: 'FR', estadoCivil: 'soltero',
        direccion: { calle: 'Mayor', numero: '3', codigoPostal: '28001', municipio: 'Getafe', provincia: 'Madrid', pais: 'ES' },
      });
      expect(run.mock.calls.at(-1)![1]).toMatchObject({ successMessage: 'Contacto actualizado' });
      expect(cerrado()).toBe(true);
    });

    it('no guarda una edición que deja vacíos los campos obligatorios', async () => {
      await abrirEdicion('Ana López');
      escribir('nombre', '  ');
      await click(boton('Guardar cambios', drawer()!));
      expect(contactService.updateContact).not.toHaveBeenCalled();
      expect(drawer()!.textContent).toContain('Campo obligatorio');
      expect(cerrado()).toBe(false);
    });

    it('al cambiar de tipo limpia los campos del tipo anterior', async () => {
      await abrirEdicion('Ana López');
      await click(boton('Persona Jurídica', drawer()!));
      escribir('razonSocial', 'Ana López S.L.U.');
      await click(boton('Guardar cambios', drawer()!));
      expect(payloadActualizado()[1]).toMatchObject({
        type: 'persona_juridica', razonSocial: 'Ana López S.L.U.',
        nombre: null, apellidos: null, nifType: null, nif: null, nacionalidad: null, estadoCivil: null,
        profesion: null, direccion: null, lugarNacimiento: null,
        direccionSocial: { calle: 'Mayor', numero: '3', codigoPostal: '28001', municipio: 'Madrid', provincia: 'Madrid', pais: 'ES' },
      });
    });

    it('sin cambio de tipo no añade campos nulos', async () => {
      await abrirEdicion('Acme S.L.');
      await click(boton('Guardar cambios', drawer()!));
      expect(Object.values(payloadActualizado()[1])).not.toContain(null);
    });
  });

  describe('cierre', () => {
    it('emite closed con Cerrar, con el fondo y con Escape', async () => {
      await abrirNuevo();
      await click(drawer()!.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]'));
      await click(q('.fixed.inset-0.bg-black\\/40'));
      drawer()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(cierres).toBe(3);
      expect(guardados).toHaveLength(0);
    });
  });

  describe('resultado', () => {
    it('emite saved con el contacto creado en un alta', async () => {
      await abrirNuevo();
      rellenarPaso1();
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(guardados).toHaveLength(1);
      expect(guardados[0]).toMatchObject({ id: 'nuevo', nombre: 'Eva' });
      expect(cierres).toBe(0);
    });

    it('emite saved con null en una edición', async () => {
      await abrirEdicion('Ana López');
      await click(boton('Guardar cambios', drawer()!));
      expect(guardados).toEqual([null]);
    });
  });

  describe('datos de partida', () => {
    it('precarga el alta con los datos recibidos', async () => {
      await abrir({ prefill: { nombre: 'Eva', apellidos: 'Ruiz', mobile: '611222333', notes: 'Desde recepción' } });
      expect(drawer()!.getAttribute('aria-label')).toBe('Nuevo contacto');
      expect([valor('nombre'), valor('apellidos'), valor('mobile'), valor('notes')])
        .toEqual(['Eva', 'Ruiz', '611222333', 'Desde recepción']);
      expect(valor('status')).toBe('activo');
    });

    it('reinicia el formulario cuando cambian los datos de partida', async () => {
      await abrir({ prefill: { nombre: 'Eva' } });
      escribir('apellidos', 'Escrito a mano');
      await click(boton('Continuar', drawer()!));
      fixture.componentRef.setInput('prefill', { nombre: 'Noa' });
      await estable();
      expect([valor('nombre'), valor('apellidos')]).toEqual(['Noa', '']);
    });

    it('lista los miembros del despacho para asignar', async () => {
      await abrirNuevo();
      expect(Array.from(q<HTMLSelectElement>('#assignedTo').options).map(o => o.textContent?.trim()))
        .toEqual(['Sin asignar', 'Marta', 'Luis Gil']);
    });
  });

  describe('documento de identificación (cliente-factura-nif, R6)', () => {
    const textoLabel = (para: string): string => q(`label[for="${para}"]`).textContent!.replace(/\s+/g, ' ').trim();
    const errorDoc = (id: string): HTMLElement | null => el().querySelector<HTMLElement>(`#${id}-error`);
    const rellenarFisica = (): void => {
      escribir('nombre', 'Eva');
      escribir('apellidos', 'Ruiz');
      escribir('email', 'eva@test.dev');
    };

    it('S6.1 persona física: "Tipo de documento" y "Número de documento"', async () => {
      await abrirNuevo();
      expect(textoLabel('nifType')).toBe('Tipo de documento');
      expect(textoLabel('nif')).toBe('Número de documento');
      expect(qa<HTMLOptionElement>('#nifType option').map(o => o.textContent!.trim())).toEqual(['DNI', 'NIE', 'Pasaporte', 'Otro']);
    });

    it('S6.1 persona jurídica: "NIF (España)" con valor cif, sin ningún "CIF" visible ni asterisco en el número', async () => {
      await abrirNuevo();
      await click(boton('Persona Jurídica', drawer()!));
      expect(textoLabel('cifType')).toBe('Tipo de documento');
      expect(textoLabel('cif')).toBe('Número de documento');
      const opciones = qa<HTMLOptionElement>('#cifType option');
      expect(opciones.map(o => [o.value, o.textContent!.trim()])).toEqual([['cif', 'NIF (España)'], ['vat', 'VAT (UE)'], ['otro', 'Otro']]);
      expect(drawer()!.textContent).not.toMatch(/CIF/);
    });

    it('S6.4 el número vacío ya no muestra "Campo obligatorio" ni bloquea, en física y jurídica', async () => {
      await abrirNuevo();
      await click(boton('Continuar', drawer()!)); // faltan nombre/apellidos: showErrors activo
      expect(q('#nif').parentElement!.textContent).not.toContain('Campo obligatorio');
      expect(q('#nif').getAttribute('aria-invalid')).toBeNull();

      await click(boton('Persona Jurídica', drawer()!));
      await click(boton('Continuar', drawer()!));
      expect(q('#cif').parentElement!.textContent).not.toContain('Campo obligatorio');

      escribir('razonSocial', 'Beta S.A.');
      escribir('email', 'hola@beta.test');
      await click(boton('Continuar', drawer()!));
      expect(existe('formaJuridica')).toBe(true);
    });

    it('S6.2 un DNI con la letra de control mal no avanza y muestra un error accesible', async () => {
      await abrirNuevo();
      rellenarFisica();
      escribir('nif', '12345678A');
      await click(boton('Continuar', drawer()!));

      expect(existe('nacionalidad')).toBe(false);
      const error = errorDoc('nif');
      expect(error?.getAttribute('role')).toBe('alert');
      expect(error?.textContent).toContain('El NIF no es válido: revisa los números y la letra.');
      expect(q('#nif').getAttribute('aria-invalid')).toBe('true');
      expect(q('#nif').getAttribute('aria-describedby')).toBe('nif-error');
    });

    it('S6.2 una edición con el NIE inválido no guarda; corregido, guarda', async () => {
      await abrirEdicion('Ana López');
      escribir('nif', 'X1234567A');
      await click(boton('Guardar', drawer()!));
      expect(contactService.updateContact).not.toHaveBeenCalled();
      expect(errorDoc('nif')).not.toBeNull();

      escribir('nif', 'X1234567L');
      await click(boton('Guardar', drawer()!));
      expect(contactService.updateContact).toHaveBeenCalledTimes(1);
    });

    it('S6.2 jurídica con tipo NIF (cif) inválido bloquea; con VAT u Otro el mismo texto no se valida', async () => {
      await abrirNuevo();
      await click(boton('Persona Jurídica', drawer()!));
      escribir('razonSocial', 'Beta S.A.');
      escribir('email', 'hola@beta.test');
      escribir('cif', 'A11111111'); // control correcto = 9
      await click(boton('Continuar', drawer()!));
      expect(existe('formaJuridica')).toBe(false);
      expect(errorDoc('cif')).not.toBeNull();

      escribir('cifType', 'vat');
      await click(boton('Continuar', drawer()!));
      expect(existe('formaJuridica')).toBe(true);
    });

    it('S6.3 pasaporte y otro documento se aceptan sin validar como NIF', async () => {
      await abrirNuevo();
      rellenarFisica();
      escribir('nifType', 'pasaporte');
      escribir('nif', 'PAA 123456');
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(payloadCreado()).toMatchObject({ nifType: 'pasaporte', nif: 'PAA 123456' });
    });

    it('S6.4 sin número guarda igualmente', async () => {
      await abrirNuevo();
      rellenarFisica();
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(payloadCreado()).toMatchObject({ nifType: 'dni', nif: '' });
    });

    it('S6.5 con tipo español se guarda normalizado (mayúsculas, sin separadores ni prefijo ES)', async () => {
      await abrirNuevo();
      rellenarFisica();
      escribir('nif', ' 12.345.678-z ');
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(payloadCreado()).toMatchObject({ nifType: 'dni', nif: '12345678Z' });
    });

    it('S6.5 jurídica con tipo NIF se normaliza; VAT conserva el texto escrito (recortado)', async () => {
      await abrirNuevo();
      await click(boton('Persona Jurídica', drawer()!));
      escribir('razonSocial', 'Beta S.A.');
      escribir('email', 'hola@beta.test');
      escribir('cif', 'es-b12345674');
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(payloadCreado()).toMatchObject({ cifType: 'cif', cif: 'B12345674' });

      contactService.createContact.mockClear();
      await abrirNuevo();
      await click(boton('Persona Jurídica', drawer()!));
      escribir('razonSocial', 'Gamma Ltd');
      escribir('email', 'hi@gamma.test');
      escribir('cifType', 'vat');
      escribir('cif', ' fr 12 345678901 ');
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
      expect(payloadCreado()).toMatchObject({ cifType: 'vat', cif: 'fr 12 345678901' });
    });
  });
});
