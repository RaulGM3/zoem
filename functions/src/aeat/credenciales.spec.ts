import { describe, it, expect } from 'vitest';
import { ErrorCredenciales, clasificarErrorCredenciales, mensajeCredenciales } from './credenciales';

describe('clasificarErrorCredenciales', () => {
  it.each([
    ['gRPC 5 NOT_FOUND', { code: 5, message: 'x' }, 'sin_certificado'],
    ['gRPC 7 PERMISSION_DENIED', Object.assign(new Error('denied'), { code: 7 }), 'sin_permiso'],
    ['ErrorCredenciales explícito', new ErrorCredenciales('certificado_invalido', 'pwd'), 'certificado_invalido'],
    ['gRPC otro código', { code: 14 }, 'desconocido'],
    ['Error sin código', new Error('boom'), 'desconocido'],
    ['código como texto no cuenta', { code: '7' }, 'desconocido'],
    ['valor no-objeto', 'PERMISSION_DENIED', 'desconocido'],
    ['null', null, 'desconocido'],
  ])('%s -> %s', (_n, err, motivo) => {
    expect(clasificarErrorCredenciales(err)).toBe(motivo);
  });
});

describe('mensajeCredenciales', () => {
  it('un mensaje distinto y en español por motivo', () => {
    expect(mensajeCredenciales('sin_certificado')).toContain('Súbelo');
    expect(mensajeCredenciales('sin_permiso')).toContain('administrador');
    expect(mensajeCredenciales('certificado_invalido')).toContain('Vuelve a subirlo');
    expect(mensajeCredenciales('desconocido')).toBe('Certificado AEAT no configurado para esta empresa.');
  });
});
