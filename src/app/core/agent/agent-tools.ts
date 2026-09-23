import { inject, InjectionToken, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { Router } from '@angular/router';
import { CasosService } from '../services/casos.service';
import { ContactService } from '../services/contact.service';
import { PermissionService } from '../services/permission.service';
import type { AgentTool } from './agent-tool';
import { casosTools } from './tools/casos.tools';
import { contactosTools } from './tools/contactos.tools';
import { navegacionTools } from './tools/navegacion.tools';

/**
 * Punto de ensamblaje del agente: aquí, y solo aquí, el dominio puro de las
 * tools se conecta con los servicios de Angular.
 *
 * Para dar una capacidad nueva al agente: escribe el archivo de tools en
 * `tools/`, añádelo a esta lista y listo. Ni el chat ni el modelo se tocan.
 */
export const AGENT_TOOLS = new InjectionToken<AgentTool[][]>('AGENT_TOOLS');

export function provideAgentTools(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: AGENT_TOOLS,
      multi: true,
      useFactory: () =>
        casosTools({ casos: inject(CasosService).casos, navegador: inject(Router) }),
    },
    {
      provide: AGENT_TOOLS,
      multi: true,
      useFactory: () =>
        contactosTools({ contactos: inject(ContactService).contacts, navegador: inject(Router) }),
    },
    {
      provide: AGENT_TOOLS,
      multi: true,
      useFactory: () => {
        const perm = inject(PermissionService);
        return navegacionTools({
          navegador: inject(Router),
          puedeVer: (modulo) => perm.canAccess(modulo),
        });
      },
    },
  ]);
}
