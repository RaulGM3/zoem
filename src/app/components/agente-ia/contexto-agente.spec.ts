import { describe, it, expect } from 'vitest';
import { contextoAgente } from './contexto-agente';

describe('contextoAgente', () => {
  it('incluye la pantalla actual y el rol', () => {
    expect(contextoAgente('/casos', 'admin')).toBe('- Pantalla actual: /casos\n- Rol del usuario: admin');
  });

  it('sin rol lo dice en vez de dejar el hueco', () => {
    expect(contextoAgente('/casos', null)).toContain('sin rol asignado');
  });
});
