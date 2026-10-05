import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { AccionEjecucionService, type EjecutarAccionInput } from './accion-ejecucion.service';
import { DocTemplateService } from './doc-template.service';
import { DocGenerationService } from './doc-generation.service';
import { AccionDocService } from './accion-doc.service';
import { AccionRegistrosService } from './accion-registros.service';
import { PlatformService } from './platform.service';
import type { Accion } from '../../interfaces/accion.interface';
import type { Contact } from '../../interfaces/contact.interface';

const ana = {
  id: 'k1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Ruiz', email: 'ana@x.com', mobile: '612345678',
} as Contact;

const accion = (over: Partial<Accion> = {}): Accion =>
  ({
    id: 'a1', nombre: 'Bienvenida', ambito: 'contacto', asunto: 'Hola', cuerpo: 'Texto',
    canales: ['gmail', 'whatsapp', 'mail'], activa: true, ...over,
  }) as Accion;

const input = (over: Partial<EjecutarAccionInput> = {}): EjecutarAccionInput => ({
  accion: accion(),
  contactos: [ana],
  canal: 'gmail',
  asunto: 'Hola Ana',
  cuerpo: 'Texto final',
  ...over,
});

describe('AccionEjecucionService', () => {
  let svc: AccionEjecucionService;
  let calls: string[];
  let open: ReturnType<typeof vi.fn>;
  let crear: ReturnType<typeof vi.fn>;
  let getTemplate: ReturnType<typeof vi.fn>;
  let interpolate: ReturnType<typeof vi.fn>;
  let generateDocxBlob: ReturnType<typeof vi.fn>;
  let subirYFirmar: ReturnType<typeof vi.fn>;
  let isNative: boolean;

  beforeEach(() => {
    calls = [];
    isNative = false;
    open = vi.fn((url: string) => { calls.push('open'); return url ? { opener: null } : null; });
    crear = vi.fn(async () => { calls.push('registro'); });
    getTemplate = vi.fn().mockResolvedValue({ id: 't1', name: 'Hoja de encargo', html: '<p>{{cliente}}</p>' });
    interpolate = vi.fn().mockReturnValue('<p>Ana Ruiz</p>');
    generateDocxBlob = vi.fn().mockResolvedValue(new Blob(['x']));
    subirYFirmar = vi.fn().mockResolvedValue({ path: 'companies/c1/acciones_envios/r1.docx', url: 'https://signed/doc' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AccionEjecucionService,
        { provide: DocTemplateService, useValue: { getTemplate } },
        { provide: DocGenerationService, useValue: { interpolate, generateDocxBlob } },
        { provide: AccionDocService, useValue: { subirYFirmar } },
        { provide: AccionRegistrosService, useValue: { nuevoId: () => 'r1', crear } },
        { provide: PlatformService, useValue: { get isNative() { return isNative; } } },
        { provide: DOCUMENT, useValue: { defaultView: { open } } },
      ],
    });
    svc = TestBed.inject(AccionEjecucionService);
  });

  it('sin documento: construye la URL del canal, registra y abre', async () => {
    const r = await svc.ejecutar(input());
    expect(getTemplate).not.toHaveBeenCalled();
    expect(subirYFirmar).not.toHaveBeenCalled();
    expect(r.url).toContain('https://mail.google.com/mail/?view=cm');
    expect(r.url).toContain('to=ana%40x.com');
    expect(r.url).toContain('su=Hola%20Ana');
    expect(r.registroId).toBe('r1');
    expect(r.abierto).toBe(true);
    expect(crear).toHaveBeenCalledWith('r1', {
      accionId: 'a1', accionNombre: 'Bienvenida', contactoIds: ['k1'], canal: 'gmail',
    });
    expect(open).toHaveBeenCalledWith(r.url, '_blank');
  });

  it('con documento: interpola, genera docx, sube, firma y añade el enlace al cuerpo', async () => {
    const r = await svc.ejecutar(input({
      accion: accion({ docTemplateId: 't1' }),
      valoresDoc: { cliente: 'Ana Ruiz' },
    }));
    expect(getTemplate).toHaveBeenCalledWith('t1');
    expect(interpolate).toHaveBeenCalledWith('<p>{{cliente}}</p>', { cliente: 'Ana Ruiz' });
    expect(generateDocxBlob).toHaveBeenCalledWith('<p>Ana Ruiz</p>', 'Hoja de encargo');
    expect(subirYFirmar).toHaveBeenCalledWith('r1', expect.any(Blob));
    expect(r.cuerpoFinal).toBe('Texto final\n\nDocumento: https://signed/doc');
    expect(decodeURIComponent(r.url)).toContain('Documento: https://signed/doc');
    expect(crear.mock.calls[0][1]).toMatchObject({ docPath: 'companies/c1/acciones_envios/r1.docx' });
  });

  it('escribe el registro ANTES de abrir la app', async () => {
    await svc.ejecutar(input());
    expect(calls).toEqual(['registro', 'open']);
  });

  it('guarda casoId y hitoId cuando vienen', async () => {
    await svc.ejecutar(input({ casoId: 'cs1', hitoId: 'h1' }));
    expect(crear.mock.calls[0][1]).toMatchObject({ casoId: 'cs1', hitoId: 'h1' });
  });

  it('whatsapp usa el móvil normalizado del contacto', async () => {
    const r = await svc.ejecutar(input({ canal: 'whatsapp' }));
    expect(r.url.startsWith('https://wa.me/34612345678?text=')).toBe(true);
  });

  it('nativo abre con _system', async () => {
    isNative = true;
    await svc.ejecutar(input());
    expect(open.mock.calls[0][1]).toBe('_system');
  });

  it('plantilla de documento inexistente: error y no se crea ni abre nada', async () => {
    getTemplate.mockResolvedValue(null);
    await expect(svc.ejecutar(input({ accion: accion({ docTemplateId: 't1' }) }))).rejects.toThrow(/plantilla/i);
    expect(crear).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('canal no disponible para los destinatarios: error sin efectos', async () => {
    await expect(svc.ejecutar(input({ contactos: [{ ...ana, mobile: '' } as Contact], canal: 'whatsapp' }))).rejects.toThrow(/móvil/i);
    expect(crear).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('si falla el registro no se abre la app', async () => {
    crear.mockRejectedValue(new Error('permission-denied'));
    await expect(svc.ejecutar(input())).rejects.toThrow('permission-denied');
    expect(open).not.toHaveBeenCalled();
  });

  it('abierto=false si el navegador bloquea el popup', async () => {
    open.mockReturnValue(null);
    const r = await svc.ejecutar(input());
    expect(r.abierto).toBe(false);
    expect(r.url).toBeTruthy();
  });

  it('marca excedeLimite si la URL supera 2000 caracteres', async () => {
    const r = await svc.ejecutar(input({ cuerpo: 'x'.repeat(2500) }));
    expect(r.excedeLimite).toBe(true);
    const corto = await svc.ejecutar(input());
    expect(corto.excedeLimite).toBe(false);
  });
});
