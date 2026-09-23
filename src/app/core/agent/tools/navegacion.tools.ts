import { Schema } from 'firebase/ai';
import { toolFail, toolOk, type AgentTool } from '../agent-tool';
import type { Modulo } from '../../permissions/permissions';
import { leerTexto, type NavegadorPort } from './ports';

/**
 * Módulos a los que el agente puede llevar al usuario.
 * Es un mapa explícito y no una convención de slug: `Facturación` → `/facturacion`
 * no se deduce sin normalizar, y una ruta mal adivinada deja al usuario en un 404.
 */
export const RUTAS_POR_MODULO: Record<Modulo, string> = {
  Casos: '/casos',
  Contactos: '/contactos',
  Calendario: '/calendario',
  Documentos: '/documentos',
  Facturación: '/facturacion',
  Tesorería: '/tesoreria',
  RecepciónIA: '/recepcion-ia',
  Informes: '/informes',
  Configuración: '/usuarios',
};

export interface NavegacionToolsDeps {
  navegador: NavegadorPort;
  puedeVer: (modulo: Modulo) => boolean;
}

/**
 * Tool de navegación general.
 *
 * No declara `permission` porque el permiso depende del ARGUMENTO, no de la
 * tool: el registry solo sabe filtrar por un permiso fijo. Por eso esta se
 * autocontrola. Es la excepción, y por eso está documentada.
 */
export function navegacionTools({ navegador, puedeVer }: NavegacionToolsDeps): AgentTool[] {
  const modulos = Object.keys(RUTAS_POR_MODULO) as Modulo[];

  return [
    {
      name: 'navegar',
      description:
        'Lleva al usuario a la pantalla principal de un módulo de la aplicación. ' +
        'Para abrir un elemento concreto usa las herramientas de abrir, no esta.',
      parameters: Schema.object({ properties: { modulo: Schema.enumString({ enum: modulos }) } }),
      async execute(args) {
        const modulo = leerTexto(args, 'modulo') as Modulo | undefined;
        if (!modulo || !RUTAS_POR_MODULO[modulo]) {
          return toolFail(`"${modulo}" no es un módulo válido. Usa uno de: ${modulos.join(', ')}.`);
        }
        if (!puedeVer(modulo)) {
          return toolFail(`El usuario no tiene acceso al módulo ${modulo}.`);
        }

        await navegador.navigate([RUTAS_POR_MODULO[modulo]]);
        return toolOk({ navegado: modulo }, `Abriendo ${modulo}.`);
      },
    },
  ];
}
