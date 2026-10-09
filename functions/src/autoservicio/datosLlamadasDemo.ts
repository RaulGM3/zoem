// COPIA de LLAMADAS (src/app/core/demo/datos-demo-civil.ts): las Functions no importan del cliente.
// `llamadasDemo.spec.ts` comprueba que siguen iguales. Solo datos; la construcción está en llamadasDemo.ts.
// Recepción IA: llamadas atendidas por el agente de voz y leads del dashboard

export interface LlamadaDemo {
  key: string;
  /** Días atrás y hora. */
  hace: number;
  hora: string;
  nombre?: string;
  telefono: string;
  especialidad?: string;
  urgencia?: 'baja' | 'media' | 'alta';
  descripcion?: string;
  titulo: string;
  resumen: string;
  estado: 'completada' | 'fallida' | 'interrumpida';
  /** Índice del contacto enlazado a mano (si no, se reconoce por teléfono o es nuevo). */
  contacto?: number;
  /** [quién, mensaje]; `a` = agente, `u` = usuario. */
  turnos: readonly (readonly ['a' | 'u', string])[];
}

export const LLAMADAS: readonly LlamadaDemo[] = [
  {
    key: '01', hace: 0, hora: '08:47', nombre: 'Andrés Gil Navarro', telefono: '+34 699 888 777', especialidad: 'Responsabilidad civil', urgencia: 'alta',
    descripcion: 'Filtraciones desde el piso de arriba por unas obras; el vecino no responde y el techo del baño se ha caído.',
    titulo: 'Daños por obras del vecino de arriba',
    resumen: 'Nuevo cliente. El vecino del piso superior está haciendo obras y hay filtraciones graves; ayer se desprendió parte del techo del baño. Pide asesoramiento urgente para reclamar los daños. Tiene fotos y presupuesto de reparación.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados, le atiende el asistente virtual. ¿En qué puedo ayudarle?'],
      ['u', 'Hola, buenos días. Mire, tengo un problema con el vecino de arriba, está haciendo obras y me está entrando agua en casa.'],
      ['a', 'Lamento lo ocurrido. ¿Desde cuándo tiene las filtraciones y qué daños ha sufrido la vivienda?'],
      ['u', 'Desde hace dos semanas, y ayer se me cayó un trozo del techo del baño. He hablado con él pero no hace nada.'],
      ['a', 'Entiendo. ¿Dispone de fotografías o de algún presupuesto de reparación?'],
      ['u', 'Sí, tengo fotos de todo y un presupuesto de un albañil de unos 3.800 euros.'],
      ['a', 'Perfecto. Le paso su caso a uno de nuestros abogados de responsabilidad civil y le llamarán hoy mismo. ¿Me confirma su nombre completo?'],
      ['u', 'Andrés Gil Navarro. Gracias.'],
    ],
  },
  {
    key: '02', hace: 0, hora: '10:12', nombre: 'Javier Martín Ruiz', telefono: '+34 623 456 789', especialidad: 'Arrendamientos', urgencia: 'media',
    descripcion: 'Pregunta por la fecha de la vista; el inquilino le ha ofrecido pagar la mitad de la deuda.',
    titulo: 'Javier Martín: oferta de pago del inquilino',
    resumen: 'Cliente actual (desahucio Ríos Rosas 12). El inquilino le ha ofrecido pagar la mitad de lo adeudado si retira la demanda. Quiere saber si le conviene y cuándo es la vista. Pide que le llame su abogado.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados. ¿En qué puedo ayudarle?'],
      ['u', 'Hola, soy Javier Martín, tengo un caso de desahucio con vosotros.'],
      ['a', 'Buenos días, Javier. Veo su expediente. ¿Qué necesita?'],
      ['u', 'El inquilino me ha llamado y me ofrece pagar la mitad de lo que debe si retiro la demanda. No sé qué hacer.'],
      ['a', 'Entiendo. Le recomiendo no aceptar nada por escrito antes de hablar con su abogado. Dejo nota para que le llamen hoy.'],
      ['u', 'Vale, perfecto. ¿Y la vista para cuándo es?'],
      ['a', 'Su abogado le confirmará la fecha exacta en la llamada. ¿Le viene bien por la tarde?'],
      ['u', 'Sí, a partir de las cinco. Gracias.'],
    ],
  },
  {
    key: '03', hace: 1, hora: '09:31', nombre: 'Raquel Molina Serrano', telefono: '+34 689 123 456', especialidad: 'Seguros', urgencia: 'alta', contacto: 10,
    descripcion: 'La aseguradora del hogar rechaza cubrir una inundación por rotura de tubería alegando falta de mantenimiento.',
    titulo: 'Seguro del hogar rechaza una inundación',
    resumen: 'Nueva clienta (ya dada de alta como contacto). Inundación en su vivienda por rotura de tubería; la aseguradora rechaza el siniestro alegando falta de mantenimiento. Daños estimados de 12.000 €. Tiene la póliza y la carta de rechazo. Reunión agendada.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados, le atiende el asistente virtual.'],
      ['u', 'Hola, llamo porque el seguro de mi casa no me quiere pagar una inundación.'],
      ['a', 'Lo siento mucho. ¿Qué le han dicho exactamente para rechazar el siniestro?'],
      ['u', 'Que la tubería estaba mal mantenida. Pero la casa la reformamos hace tres años, tengo las facturas.'],
      ['a', '¿Conserva la póliza y la carta de rechazo?'],
      ['u', 'Sí, las dos. Los daños son de unos doce mil euros.'],
      ['a', 'Le propongo una reunión con una de nuestras abogadas mañana a las diez. ¿Le encaja?'],
      ['u', 'Perfecto, allí estaré. Soy Raquel Molina.'],
    ],
  },
  {
    key: '04', hace: 1, hora: '13:05', nombre: 'Rosa Jiménez Vidal', telefono: '+34 914 445 566', especialidad: 'Arrendamientos', urgencia: 'media', contacto: 8,
    descripcion: 'Nuevo impago en un piso de la cartera de Solaz (C/ Narváez 18).',
    titulo: 'Solaz: nuevo impago en C/ Narváez 18',
    resumen: 'Cliente recurrente (Inmobiliaria Solaz). Avisa de un nuevo inquilino con dos meses de impago en C/ Narváez 18. Pide abrir expediente y enviar burofax esta semana. Enviará el contrato por email.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados. ¿En qué puedo ayudarle?'],
      ['u', 'Hola, soy Rosa, de Inmobiliaria Solaz. Tenemos otro impago.'],
      ['a', 'Buenos días, Rosa. ¿De qué inmueble se trata?'],
      ['u', 'Un piso en la calle Narváez 18. Dos meses sin pagar y no contesta.'],
      ['a', 'Tomo nota. ¿Quieren que enviemos el burofax de requerimiento como en los anteriores?'],
      ['u', 'Sí, esta misma semana si puede ser. Os mando el contrato por email ahora.'],
      ['a', 'Perfecto, se lo comunico al equipo y le confirmamos la apertura del expediente.'],
    ],
  },
  {
    key: '05', hace: 2, hora: '17:40', nombre: 'Pilar Sanz Ortega', telefono: '+34 611 222 333', especialidad: 'Sucesiones', urgencia: 'baja',
    descripcion: 'Su madre falleció sin testamento; necesita una declaración de herederos para tres hermanos.',
    titulo: 'Declaración de herederos sin testamento',
    resumen: 'Posible clienta. Su madre falleció hace un mes sin testamento. Son tres hermanos y hay un piso y una cuenta bancaria. Quiere presupuesto para la declaración de herederos ab intestato y la aceptación de la herencia.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenas tardes, despacho de abogados. ¿En qué puedo ayudarle?'],
      ['u', 'Hola, mi madre murió hace un mes y no hizo testamento. No sé por dónde empezar.'],
      ['a', 'Lamento su pérdida. ¿Cuántos herederos son y qué bienes hay?'],
      ['u', 'Somos tres hermanos. Hay un piso en Getafe y una cuenta en el banco.'],
      ['a', 'En ese caso hace falta una declaración de herederos ante notario. ¿Quiere que le preparemos un presupuesto?'],
      ['u', 'Sí, por favor. Me llamo Pilar Sanz.'],
    ],
  },
  {
    key: '06', hace: 3, hora: '11:18', nombre: 'Jorge Blanco Ruiz', telefono: '+34 917 778 899', especialidad: 'Arrendamientos', urgencia: 'media', contacto: 11,
    descripcion: 'El arrendador del local del restaurante no devuelve la fianza de 9.000 € tras finalizar el contrato.',
    titulo: 'Restaurante El Olivo: fianza no devuelta',
    resumen: 'Nuevo cliente (dado de alta: Hostelería El Olivo S.L.). Dejaron el local hace tres meses y el arrendador retiene la fianza de 9.000 € alegando desperfectos que niegan. Tienen acta de entrega de llaves con fotos. Piden presupuesto.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados. ¿En qué puedo ayudarle?'],
      ['u', 'Buenos días, llamo por el restaurante El Olivo. El dueño del local no nos devuelve la fianza.'],
      ['a', '¿Cuánto tiempo hace que entregaron el local y de qué importe es la fianza?'],
      ['u', 'Tres meses. Son nueve mil euros. Dice que hay desperfectos, pero lo dejamos impecable.'],
      ['a', '¿Tienen algún documento de la entrega de llaves?'],
      ['u', 'Sí, un acta firmada por los dos y fotos.'],
      ['a', 'Eso es muy útil. Le pasamos un presupuesto en las próximas 48 horas.'],
    ],
  },
  {
    key: '07', hace: 5, hora: '19:02', nombre: 'Sophie Dubois', telefono: '+34 667 890 123', especialidad: 'Familia', urgencia: 'alta',
    descripcion: 'Nerviosa por la vista de modificación de medidas; pregunta si sus hijos tendrán que declarar.',
    titulo: 'Sophie Dubois: dudas sobre la vista',
    resumen: 'Clienta actual (modificación de medidas). Pregunta si sus hijos tendrán que declarar en la vista y qué documentación debe llevar. También recuerda que tiene una factura pendiente y pide fraccionarla en dos pagos.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenas tardes, despacho de abogados.'],
      ['u', 'Hola, soy Sophie Dubois. Tengo la vista dentro de poco y estoy un poco nerviosa.'],
      ['a', 'Es normal, Sophie. ¿Qué le preocupa?'],
      ['u', 'Si mis hijos van a tener que hablar con el juez. Y qué papeles tengo que llevar.'],
      ['a', 'Su abogada le explicará todo en la reunión previa. Dejo anotadas sus preguntas.'],
      ['u', 'Gracias. Y otra cosa, ¿puedo pagar la factura en dos veces?'],
      ['a', 'Lo consulto con administración y le respondemos por email.'],
    ],
  },
  {
    key: '08', hace: 6, hora: '12:26', nombre: 'Luis Herrera Molina', telefono: '+34 913 332 211', especialidad: 'Propiedad horizontal', urgencia: 'baja',
    descripcion: 'Otro propietario (2ºC) acumula seis meses de cuotas impagadas.',
    titulo: 'C.P. Velázquez 30: segundo moroso',
    resumen: 'Cliente actual (presidente de la comunidad). Un segundo propietario, el del 2ºC, debe seis cuotas. Pregunta si pueden incluirlo en la reclamación en curso o hay que abrir otra. Llevará el acuerdo de la próxima junta.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados.'],
      ['u', 'Hola, soy Luis Herrera, presidente de la comunidad de Velázquez 30.'],
      ['a', 'Buenos días, Luis. ¿En qué podemos ayudarle?'],
      ['u', 'Ahora el del segundo C también ha dejado de pagar. Ya van seis meses.'],
      ['a', 'Para reclamarle hará falta el acuerdo de la junta y el certificado de deuda. ¿Tienen junta pronto?'],
      ['u', 'Sí, la semana que viene. Lo llevamos al orden del día.'],
    ],
  },
  {
    key: '09', hace: 7, hora: '16:58', telefono: '+34 600 431 905',
    titulo: 'Llamada interrumpida',
    resumen: 'La llamada se cortó antes de que el interlocutor explicara el motivo. No dejó nombre. Conviene devolver la llamada.',
    estado: 'interrumpida',
    turnos: [
      ['a', 'Buenas tardes, despacho de abogados, le atiende el asistente virtual.'],
      ['u', 'Hola, sí, llamaba porque…'],
      ['a', 'Disculpe, no le he oído bien. ¿Podría repetirlo?'],
      ['u', '…'],
    ],
  },
  {
    key: '10', hace: 9, hora: '10:40', nombre: 'Teresa Campos Rey', telefono: '+34 622 333 444', especialidad: 'Consumo', urgencia: 'baja',
    descripcion: 'Reclamación por cancelación de un vuelo. Fuera de las áreas del despacho.',
    titulo: 'Vuelo cancelado (fuera de especialidad)',
    resumen: 'Consulta sobre la cancelación de un vuelo (reclamación de 400 € a la aerolínea). No es materia del despacho; se le indica que puede reclamar directamente o acudir a una asociación de consumidores.',
    estado: 'completada',
    turnos: [
      ['a', 'Buenos días, despacho de abogados.'],
      ['u', 'Hola, me cancelaron un vuelo y la aerolínea no me devuelve el dinero.'],
      ['a', 'Entiendo. Para importes así puede reclamar directamente a la compañía o a través de una asociación de consumidores.'],
      ['u', '¿Vosotros no lo lleváis?'],
      ['a', 'No es una de nuestras especialidades, pero le enviamos por email los pasos para reclamar.'],
    ],
  },
];
