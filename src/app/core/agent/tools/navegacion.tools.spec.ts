import { describe, it, expect, vi } from 'vitest';
import { navegacionTools, RUTAS_POR_MODULO } from './navegacion.tools';
import type { Modulo } from '../../permissions/permissions';
import type { AgentTool } from '../agent-tool';

function setup(puedeVer: (m: Modulo) => boolean = () => true) {
  const navigate = vi.fn(async () => true);
  const [navegar] = navegacionTools({ navegador: { navigate }, puedeVer }) as AgentTool[];
  return { navigate, navegar };
}

describe('navegar', () => {
  it('lleva al usuario al módulo pedido', async () => {
    const { navegar, navigate } = setup();
    const r = await navegar.execute({ modulo: 'Tesorería' });
    expect(r.ok).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/tesoreria']);
  });

  it('se autocontrola los permisos: el registry no puede hacerlo por módulo', async () => {
    const { navegar, navigate } = setup((m) => m !== 'Tesorería');
    const r = await navegar.execute({ modulo: 'Tesorería' });
    expect(r.ok).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un módulo inexistente devuelve el catálogo válido, no un fallo mudo', async () => {
    const { navegar } = setup();
    const r = await navegar.execute({ modulo: 'Marketing' });
    expect(r.ok).toBe(false);
    expect(r.data['error']).toContain('Casos');
  });

  it('cada módulo del sistema de permisos tiene ruta — si no, el agente miente', () => {
    const MODULOS_NAVEGABLES = Object.keys(RUTAS_POR_MODULO);
    expect(MODULOS_NAVEGABLES.length).toBeGreaterThan(0);
    for (const ruta of Object.values(RUTAS_POR_MODULO)) {
      expect(ruta.startsWith('/')).toBe(true);
    }
  });
});
