import { Esquema } from '../esquema';
import { toolFail, toolOk, type AgentTool } from '../agent-tool';
import { buscarGuias } from '../../ayuda/buscar-guias';
import { guiasVisibles } from '../../ayuda/filtro-guias';
import { GUIA_IDS, type Guia, type PuedeFn } from '../../ayuda/guia';
import { serializarGuia } from '../../ayuda/serializar-guia';
import { leerOpcion, leerTexto } from './ports';

export interface AyudaToolsDeps {
  /** Carga diferida del contenido: este archivo vive en el bundle inicial y las guías no. */
  cargar: () => Promise<readonly Guia[]>;
  puede: PuedeFn;
}

/** Más de tres guías por respuesta es ruido para el modelo y tokens tirados. */
const MAX_RESULTADOS = 3;

const AVISO_SIN_GUIA =
  'No hay ninguna guía sobre esto. Díselo al usuario tal cual y NO improvises los pasos: ' +
  'sugiérele abrir la página Ayuda o preguntar a su administrador.';

const PUEDE_TODO: PuedeFn = () => true;

/**
 * Tool de ayuda: responde "¿cómo se hace X?" con las guías oficiales.
 *
 * No declara `permission` porque el permiso depende del CONTENIDO que se
 * encuentre, no de la tool: igual que `navegar`, se autocontrola. Al no
 * declararlo queda disponible también en los modos de solo lectura, que es
 * justo donde se hacen estas preguntas.
 */
export function ayudaTools({ cargar, puede }: AyudaToolsDeps): AgentTool[] {
  return [
    {
      name: 'consultar_ayuda',
      description:
        'Busca en las guías oficiales de Vertey cómo se hace una tarea y para qué sirve cada pantalla. ' +
        'Úsala SIEMPRE ante preguntas de "¿cómo hago…?", "¿dónde está…?" o "¿para qué sirve…?", ' +
        'antes de responder. Pasa en `consulta` las palabras clave en infinitivo (por ejemplo "crear caso"). ' +
        'Sin argumentos devuelve el índice de guías disponibles.',
      parameters: Esquema.object({
        properties: {
          consulta: Esquema.string({ description: 'Palabras clave de la tarea, por ejemplo "invitar usuario".' }),
          guia: Esquema.enumString({
            enum: [...GUIA_IDS],
            description: 'Limita la búsqueda a una guía. Sin `consulta`, devuelve esa guía entera.',
          }),
        },
        optionalProperties: ['consulta', 'guia'],
      }),
      async execute(args) {
        const consulta = leerTexto(args, 'consulta') ?? '';
        const opcion = leerOpcion(args, 'guia', GUIA_IDS);
        if (!opcion.ok) return toolFail(opcion.error);
        const guiaId = opcion.valor;

        const todas = await cargar();
        const enAlcance = guiaId ? todas.filter(g => g.id === guiaId) : todas;
        const visibles = guiasVisibles(enAlcance, puede);

        if (guiaId && visibles.length === 0) {
          return toolFail(`El usuario no tiene acceso a la guía "${guiaId}". Debe pedírselo a su administrador.`);
        }

        const encontradas = buscarGuias(visibles, consulta);

        // Sin términos útiles y sin guía concreta: el índice, no doce guías enteras.
        if (!guiaId && encontradas.every(r => r.puntos === 0) && encontradas.length > 0) {
          return toolOk({
            guias: visibles.map(g => ({ guia: g.id, titulo: g.titulo, resumen: g.resumen, ruta: g.ruta })),
            aviso: 'Este es el índice. Vuelve a llamar con `consulta` o con `guia` para obtener los pasos.',
          });
        }

        if (encontradas.length === 0) {
          // ¿Existe la respuesta pero el usuario no puede verla? Distinguirlo evita
          // decirle "no hay guía" de algo que sí existe y simplemente no le toca.
          const vetadas = buscarGuias(guiasVisibles(enAlcance, PUEDE_TODO), consulta);
          if (vetadas.length > 0) {
            const titulos = vetadas.slice(0, MAX_RESULTADOS).map(r => r.guia.titulo).join(', ');
            return toolFail(
              `El usuario no tiene acceso a lo que pregunta (${titulos}). No le expliques los pasos: debe pedir el permiso a su administrador.`,
            );
          }
          return toolOk({ resultados: [], aviso: AVISO_SIN_GUIA });
        }

        return toolOk({
          resultados: encontradas.slice(0, MAX_RESULTADOS).map(({ guia, tareas }) => ({
            guia: guia.id,
            titulo: guia.titulo,
            modulo: guia.modulo,
            ruta: guia.ruta,
            texto: serializarGuia(guia, tareas),
          })),
        });
      },
    },
  ];
}
