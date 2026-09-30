import type { Guia } from '../guia';

export const GUIA_AGENTE_IA: Guia = {
  id: 'agente-ia',
  titulo: 'Agente IA',
  modulo: null,
  ruta: '/agente-ia',
  resumen: 'El asistente Vertey IA: un chat al que le preguntas o le pides cosas con tus palabras, escribiendo o dictando.',
  paraQue:
    'Hacer más rápido lo de siempre: preguntar cómo se hace algo, encontrar un contacto o un caso, ir a una pantalla o dejar un formulario ya rellenado.',
  claves: ['asistente', 'chat', 'ia', 'inteligencia artificial', 'vertey ia', 'copiloto', 'bot'],
  tareas: [
    {
      id: 'hablar-con-agente',
      titulo: 'Hacerle una pregunta o un encargo al agente',
      claves: ['preguntar', 'escribir', 'consultar', 'pedir', 'mensaje'],
      pasos: [
        'Abre el agente desde "Agente IA" en el menú, o con el botón flotante "Abrir el asistente Vertey IA" desde cualquier pantalla.',
        'Escribe en "Escribe tu pregunta...".',
        'Pulsa Enter para enviar. Shift + Enter añade un salto de línea.',
      ],
      nota: 'El agente solo ve y hace lo que tus permisos te permiten a ti.',
    },
    {
      id: 'modos-agente',
      titulo: 'Elegir el modo del agente',
      claves: ['modo', 'soporte', 'análisis', 'acciones', 'solo consulta'],
      pasos: [
        'Arriba del chat, elige el modo: "Soporte", "Análisis" o "Acciones".',
        '"Soporte" y "Análisis" son de consulta: el agente responde, busca y te lleva a pantallas, pero no abre formularios.',
        '"Acciones" le permite además preparar formularios, como un contacto o un caso nuevo.',
      ],
    },
    {
      id: 'sugerencias-agente',
      titulo: 'Usar las sugerencias con huecos',
      claves: ['sugerencia', 'plantilla de mensaje', 'huecos', 'tab', 'ejemplos'],
      pasos: [
        'Con el chat vacío, elige una sugerencia: rellena el mensaje por ti.',
        'Las partes resaltadas son huecos. Escribe encima del primero.',
        'Pulsa Tab para saltar al siguiente hueco y después Enter para enviar.',
      ],
    },
    {
      id: 'dictar-agente',
      titulo: 'Dictar el mensaje con la voz',
      claves: ['voz', 'micrófono', 'dictado', 'hablar', 'audio'],
      pasos: [
        'Pulsa el micrófono del cuadro de mensaje y habla.',
        'El texto transcrito aparece en el cuadro de mensaje. Revísalo y corrígelo si hace falta.',
        'Pulsa Enter para enviarlo.',
      ],
      nota: 'El dictado nunca se envía solo: siempre lo revisas tú antes.',
    },
    {
      id: 'agente-no-guarda',
      titulo: 'Crear un contacto o un caso con ayuda del agente',
      claves: ['crear con ia', 'formulario', 'rellenar', 'automático', 'guardar'],
      pasos: [
        'Pon el agente en modo "Acciones".',
        'Pídele, por ejemplo, que cree un contacto con su nombre y su DNI.',
        'El agente abre el formulario con esos datos ya puestos. Revísalos y guarda tú.',
      ],
      nota: 'El agente nunca guarda por ti: prepara el formulario y la última palabra es tuya.',
    },
    {
      id: 'vaciar-conversacion',
      titulo: 'Empezar una conversación nueva',
      claves: ['borrar chat', 'limpiar', 'reiniciar', 'vaciar'],
      pasos: ['Pulsa "Vaciar la conversación", arriba del chat.'],
    },
  ],
};
