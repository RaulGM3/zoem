import { Schema } from 'firebase/ai';
import { toolFail, toolOk, type AgentTool } from '../agent-tool';
import { rankMatches } from '../matching';
import type { Caso, CasoEstado, CasoPrioridad, CasoTipo } from '../../../interfaces/caso.interface';
import { compactar, leerOpcion, leerTexto, type NavegadorPort } from './ports';

const TIPOS: readonly CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];
const ESTADOS: readonly CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
const PRIORIDADES: readonly CasoPrioridad[] = ['alta', 'media', 'baja'];

const AVISO_BORRADOR =
  'El formulario ha quedado abierto y relleno. NO se ha guardado nada: el usuario debe revisarlo y confirmarlo.';

export interface CasosToolsDeps {
  /** Casos ya cargados en memoria (el signal del servicio). */
  casos: () => readonly Caso[];
  navegador: NavegadorPort;
}

/**
 * Tools del módulo Casos.
 *
 * Las de creación NO escriben en Firestore: navegan a la página con la señal
 * `newCaso=1` y los datos en el `state`, que es el contrato que `casos.ts` ya
 * consume para abrir el drawer precargado. El usuario sigue siendo quien firma.
 */
export function casosTools({ casos, navegador }: CasosToolsDeps): AgentTool[] {
  const buscar_casos: AgentTool = {
    name: 'buscar_casos',
    description:
      'Busca casos del despacho por nombre o descripción y devuelve los candidatos con su id. ' +
      'Úsala SIEMPRE antes de abrir un caso: nunca inventes un id. Sin consulta, lista los casos disponibles.',
    parameters: Schema.object({
      properties: {
        consulta: Schema.string({ description: 'Texto a buscar en el título del caso.' }),
        estado: Schema.enumString({ enum: [...ESTADOS] }),
        tipo: Schema.enumString({ enum: [...TIPOS] }),
      },
      optionalProperties: ['consulta', 'estado', 'tipo'],
    }),
    permission: { modulo: 'Casos', cap: 'ver' },
    execute(args) {
      const estado = leerOpcion(args, 'estado', ESTADOS);
      if (!estado.ok) return toolFail(estado.error);
      const tipo = leerOpcion(args, 'tipo', TIPOS);
      if (!tipo.ok) return toolFail(tipo.error);

      let candidatos = casos().filter(
        (c) => (!estado.valor || c.estado === estado.valor) && (!tipo.valor || c.tipo === tipo.valor),
      );

      const consulta = leerTexto(args, 'consulta');
      if (consulta) {
        candidatos = rankMatches(
          candidatos.map((c) => ({ ...c, label: c.titulo })),
          consulta,
        );
      }

      return toolOk({
        resultados: candidatos
          .slice(0, 10)
          .map(({ id, titulo, estado: e, tipo: t }) => ({ id, titulo, estado: e, tipo: t })),
      });
    },
  };

  const abrir_caso: AgentTool = {
    name: 'abrir_caso',
    description:
      'Abre la ficha de un caso concreto en pantalla. El id debe venir de buscar_casos.',
    parameters: Schema.object({ properties: { casoId: Schema.string() } }),
    permission: { modulo: 'Casos', cap: 'ver' },
    async execute(args) {
      const casoId = leerTexto(args, 'casoId');
      const caso = casos().find((c) => c.id === casoId);
      // El modelo puede alucinar un id: navegar a ciegas dejaría al usuario en
      // una pantalla rota. Mejor devolver el fallo y que vuelva a buscar.
      if (!caso) return toolFail(`No existe ningún caso con id "${casoId}". Búscalo con buscar_casos.`);

      await navegador.navigate(['/casos', caso.id]);
      return toolOk({ abierto: { id: caso.id, titulo: caso.titulo } }, `Abriendo "${caso.titulo}".`);
    },
  };

  const crear_caso: AgentTool = {
    name: 'crear_caso',
    description:
      'Deja preparado el formulario de nuevo caso con los datos que dé el usuario. ' +
      'NO guarda el caso: solo abre el formulario relleno para que el usuario lo confirme.',
    parameters: Schema.object({
      properties: {
        titulo: Schema.string({ description: 'Título del caso. Obligatorio.' }),
        descripcion: Schema.string(),
        tipo: Schema.enumString({ enum: [...TIPOS] }),
        prioridad: Schema.enumString({ enum: [...PRIORIDADES] }),
        contactoId: Schema.string({ description: 'Id del cliente, obtenido con buscar_contactos.' }),
      },
      optionalProperties: ['descripcion', 'tipo', 'prioridad', 'contactoId'],
    }),
    permission: { modulo: 'Casos', cap: 'crear' },
    async execute(args) {
      const titulo = leerTexto(args, 'titulo');
      if (!titulo) return toolFail('Falta el título del caso. Pregúntaselo al usuario.');

      const tipo = leerOpcion(args, 'tipo', TIPOS);
      if (!tipo.ok) return toolFail(tipo.error);
      const prioridad = leerOpcion(args, 'prioridad', PRIORIDADES);
      if (!prioridad.ok) return toolFail(prioridad.error);

      const contactoId = leerTexto(args, 'contactoId');
      await navegador.navigate(['/casos'], {
        queryParams: { newCaso: '1', ...(contactoId ? { contactId: contactoId } : {}) },
        state: compactar({
          titulo,
          descripcion: leerTexto(args, 'descripcion'),
          tipo: tipo.valor,
          prioridad: prioridad.valor,
        }),
      });

      return toolOk({ formularioAbierto: true, aviso: AVISO_BORRADOR }, `Formulario de caso preparado: "${titulo}".`);
    },
  };

  return [buscar_casos, abrir_caso, crear_caso];
}
