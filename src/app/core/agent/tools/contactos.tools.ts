import { Schema } from 'firebase/ai';
import { toolFail, toolOk, type AgentTool } from '../agent-tool';
import { rankMatches } from '../matching';
import { getContactDisplayName, type Contact } from '../../../interfaces/contact.interface';
import { compactar, leerTexto, type NavegadorPort } from './ports';

const AVISO_BORRADOR =
  'El formulario ha quedado abierto y relleno. NO se ha guardado nada: el usuario debe revisarlo y confirmarlo.';

export interface ContactosToolsDeps {
  contactos: () => readonly Contact[];
  navegador: NavegadorPort;
}

/**
 * Tools del módulo Contactos.
 *
 * `crear_contacto` manda los datos por `state` y no por queryParams a propósito:
 * son datos personales y la URL acaba en el historial del navegador y en logs.
 */
export function contactosTools({ contactos, navegador }: ContactosToolsDeps): AgentTool[] {
  /** Un contacto puede ser persona física o jurídica: el nombre visible lo resuelve el dominio. */
  const etiquetados = () => contactos().map((c) => ({ ...c, label: getContactDisplayName(c) }));

  const buscar_contactos: AgentTool = {
    name: 'buscar_contactos',
    description:
      'Busca clientes y contactos del despacho por nombre, apellidos o razón social, y devuelve su id. ' +
      'Úsala SIEMPRE antes de abrir un contacto o de asociarlo a un caso: nunca inventes un id.',
    parameters: Schema.object({
      properties: { consulta: Schema.string({ description: 'Nombre o razón social a buscar.' }) },
      optionalProperties: ['consulta'],
    }),
    permission: { modulo: 'Contactos', cap: 'ver' },
    execute(args) {
      const consulta = leerTexto(args, 'consulta');
      const encontrados = consulta ? rankMatches(etiquetados(), consulta) : etiquetados().slice(0, 10);

      return toolOk({
        resultados: encontrados
          .slice(0, 10)
          .map((c) => ({ id: c.id, nombre: c.label, status: c.status })),
      });
    },
  };

  const abrir_contacto: AgentTool = {
    name: 'abrir_contacto',
    description: 'Abre la ficha de un contacto. El id debe venir de buscar_contactos.',
    parameters: Schema.object({ properties: { contactoId: Schema.string() } }),
    permission: { modulo: 'Contactos', cap: 'ver' },
    async execute(args) {
      const id = leerTexto(args, 'contactoId');
      const contacto = contactos().find((c) => c.id === id);
      if (!contacto) {
        return toolFail(`No existe ningún contacto con id "${id}". Búscalo con buscar_contactos.`);
      }

      const nombre = getContactDisplayName(contacto);
      await navegador.navigate(['/contactos', contacto.id]);
      return toolOk({ abierto: { id: contacto.id, nombre } }, `Abriendo la ficha de ${nombre}.`);
    },
  };

  const crear_contacto: AgentTool = {
    name: 'crear_contacto',
    description:
      'Deja preparado el formulario de nuevo contacto (persona física) con los datos que dé el usuario. ' +
      'NO guarda el contacto: solo abre el formulario relleno para que el usuario lo confirme.',
    parameters: Schema.object({
      properties: {
        nombre: Schema.string({ description: 'Nombre de pila. Obligatorio.' }),
        apellidos: Schema.string(),
        mobile: Schema.string({ description: 'Teléfono móvil.' }),
        notes: Schema.string({ description: 'Notas o contexto de la captación.' }),
      },
      optionalProperties: ['apellidos', 'mobile', 'notes'],
    }),
    permission: { modulo: 'Contactos', cap: 'crear' },
    async execute(args) {
      const nombre = leerTexto(args, 'nombre');
      if (!nombre) return toolFail('Falta el nombre del contacto. Pregúntaselo al usuario.');

      await navegador.navigate(['/contactos'], {
        queryParams: { newContact: '1' },
        state: compactar({
          nombre,
          apellidos: leerTexto(args, 'apellidos'),
          mobile: leerTexto(args, 'mobile'),
          notes: leerTexto(args, 'notes'),
        }),
      });

      return toolOk(
        { formularioAbierto: true, aviso: AVISO_BORRADOR },
        `Formulario de contacto preparado: ${nombre}.`,
      );
    },
  };

  return [buscar_contactos, abrir_contacto, crear_contacto];
}
