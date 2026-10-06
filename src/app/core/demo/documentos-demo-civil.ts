/**
 * Documentos de ejemplo para los casos de la empresa demo (contratos, escritos,
 * hojas de encargo, comunicaciones). Solo HTML: `DemoSeedService` lo convierte a
 * .docx con la callable `generateDocx` y lo sube a la carpeta del caso.
 * Todos los datos son ficticios.
 */
import { CONTACTOS, type ContactoDemo } from './datos-demo-civil';

export type CarpetaDemo = 'cliente' | 'contratos' | 'escritos' | 'comunicaciones';

export const CARPETAS: Record<CarpetaDemo, string> = {
  cliente: 'Documentación del cliente',
  contratos: 'Contratos y encargos',
  escritos: 'Escritos judiciales',
  comunicaciones: 'Comunicaciones',
};

export interface DocumentoDemo {
  /** Id determinista del doc en `doc_files`. */
  id: string;
  casoId: string;
  carpeta: CarpetaDemo;
  /** Nombre del archivo, con extensión .docx. */
  nombre: string;
  html: string;
  /** Días atrás en que se "subió". */
  hace: number;
}

export const carpetaId = (c: CarpetaDemo) => `demo-carpeta-${c}`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function nombre(c: ContactoDemo): string {
  return c.type === 'persona_fisica' ? `${c.nombre} ${c.apellidos}` : c.razonSocial;
}
function idFiscal(c: ContactoDemo): string {
  return c.type === 'persona_fisica' ? `${c.nifType === 'nie' ? 'NIE' : 'DNI'} ${c.nif}` : `CIF ${c.cif}`;
}
function domicilio(c: ContactoDemo): string {
  const d = c.type === 'persona_fisica' ? c.direccion : c.direccionSocial;
  return `${d.calle} ${d.numero}${d.piso ? `, ${d.piso}` : ''}, ${d.codigoPostal} ${d.municipio}`;
}

/** Bloque de contenido: párrafo, título de sección o lista. */
type Bloque = string | { h: string } | { ul: string[] } | { firma: string[] };

function html(titulo: string, bloques: Bloque[]): string {
  const cuerpo = bloques.map((b) => {
    if (typeof b === 'string') return `<p style="text-align:justify">${esc(b)}</p>`;
    if ('h' in b) return `<h3>${esc(b.h)}</h3>`;
    if ('ul' in b) return `<ul>${b.ul.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
    return `<table style="width:100%;margin-top:32px"><tr>${b.firma.map((f) => `<td style="text-align:center;padding-top:48px">______________________<br/>${esc(f)}</td>`).join('')}</tr></table>`;
  }).join('');
  return `<h1 style="text-align:center">${esc(titulo)}</h1>${cuerpo}`;
}

export function documentosDemo(empresa: string, hoy: Date): DocumentoDemo[] {
  const fecha = (offset: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + offset);
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };
  const anio = (offset: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + offset);
    return d.getFullYear();
  };
  const [maria, javier, lucia, antonio, , carlos, sophie, manuel, solaz, velazquez] = CONTACTOS;
  const docs: DocumentoDemo[] = [];
  let n = 0;
  const add = (casoKey: string, carpeta: CarpetaDemo, archivo: string, hace: number, titulo: string, bloques: Bloque[]) => {
    n++;
    docs.push({
      id: `demo-doc-${casoKey}-${String(n).padStart(2, '0')}`,
      casoId: `demo-caso-${casoKey}`,
      carpeta,
      nombre: `${archivo}.docx`,
      html: html(titulo, bloques),
      hace,
    });
  };

  const hojaEncargo = (casoKey: string, c: ContactoDemo, hace: number, objeto: string, honorarios: string) =>
    add(casoKey, 'contratos', `Hoja de encargo - ${nombre(c)}`, hace, 'HOJA DE ENCARGO PROFESIONAL', [
      `En Madrid, a ${fecha(-hace)}.`,
      { h: 'Reunidos' },
      `De una parte, ${nombre(c)}, con ${idFiscal(c)} y domicilio en ${domicilio(c)} (en adelante, el CLIENTE).`,
      `De otra parte, ${empresa}, despacho de abogados, actuando a través de su letrado responsable (en adelante, el DESPACHO).`,
      { h: 'Primera. Objeto del encargo' },
      objeto,
      { h: 'Segunda. Honorarios' },
      honorarios,
      'Los honorarios no incluyen suplidos (procurador, notaría, registros, peritos, tasas), que se facturarán aparte y previa justificación. Se solicitará provisión de fondos para atenderlos.',
      { h: 'Tercera. Obligaciones de las partes' },
      'El DESPACHO se compromete a actuar con la máxima diligencia y a mantener informado al CLIENTE de cualquier novedad relevante. El CLIENTE se obliga a facilitar la documentación y la información veraz necesaria para el encargo.',
      { h: 'Cuarta. Protección de datos' },
      'Los datos personales del CLIENTE se tratarán con la única finalidad de prestar el servicio encargado, conforme al Reglamento (UE) 2016/679 y la Ley Orgánica 3/2018.',
      { firma: ['El CLIENTE', 'El DESPACHO'] },
    ]);

  // --- Desahucio Martín Ruiz
  add('desahucio-martin', 'cliente', 'Contrato de arrendamiento - Ríos Rosas 12', 28, 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA', [
    `En Madrid, a 1 de marzo de ${anio(-28) - 2}.`,
    `ARRENDADOR: ${nombre(javier)}, con ${idFiscal(javier)}.`,
    'ARRENDATARIO: D. Álvaro Peña Castillo, con DNI 50123456K.',
    { h: 'Primera. Objeto' },
    'El arrendador cede en arrendamiento la vivienda situada en la calle Ríos Rosas 12, 2º izquierda, 28003 Madrid, para uso exclusivo de vivienda habitual del arrendatario.',
    { h: 'Segunda. Duración' },
    'El contrato se pacta por un año, prorrogable conforme a los artículos 9 y 10 de la Ley 29/1994, de Arrendamientos Urbanos.',
    { h: 'Tercera. Renta' },
    'La renta mensual es de 850 €, pagadera por meses anticipados dentro de los cinco primeros días de cada mes mediante transferencia a la cuenta designada por el arrendador.',
    { h: 'Cuarta. Fianza' },
    'El arrendatario entrega en este acto 850 € en concepto de fianza legal, equivalente a una mensualidad.',
    { h: 'Quinta. Resolución' },
    'La falta de pago de la renta será causa de resolución del contrato conforme al artículo 27.2.a) LAU.',
    { firma: ['El arrendador', 'El arrendatario'] },
  ]);
  hojaEncargo('desahucio-martin', javier, 27,
    'Interposición de demanda de juicio verbal de desahucio por falta de pago, con acumulación de la reclamación de las rentas adeudadas, respecto de la vivienda de la calle Ríos Rosas 12, 2º izquierda, de Madrid.',
    'Se fijan unos honorarios de 900 € más IVA: un 50 % a la firma del presente encargo y el 50 % restante a la celebración de la vista o, en su defecto, al dictarse el decreto que ponga fin al procedimiento.');
  add('desahucio-martin', 'comunicaciones', 'Burofax de requerimiento de pago', 25, 'BUROFAX — REQUERIMIENTO DE PAGO', [
    `Madrid, ${fecha(-25)}.`,
    'Destinatario: D. Álvaro Peña Castillo. C/ Ríos Rosas 12, 2º izquierda, 28003 Madrid.',
    `Muy señor mío: actuando en nombre y representación de ${nombre(javier)}, propietario de la vivienda que usted ocupa en calidad de arrendatario, le requiero formalmente para que en el plazo de DIEZ DÍAS abone las rentas vencidas y no satisfechas, que ascienden a 3.400 € (cuatro mensualidades de 850 €).`,
    'Le advertimos de que, de no atender este requerimiento, se interpondrá sin más aviso la correspondiente demanda de desahucio por falta de pago y reclamación de cantidad, y de que este requerimiento produce los efectos previstos en el artículo 22.4 de la Ley de Enjuiciamiento Civil respecto de la enervación de la acción.',
    'Atentamente,',
    `${empresa}`,
  ]);
  add('desahucio-martin', 'escritos', 'Demanda de juicio verbal de desahucio', 13, 'AL JUZGADO DE PRIMERA INSTANCIA DE MADRID QUE POR TURNO CORRESPONDA', [
    `${nombre(javier)}, representado por el procurador que suscribe y asistido por el letrado de ${empresa}, ante el Juzgado comparece y, como mejor proceda en Derecho, DICE:`,
    'Que por medio del presente escrito interpone DEMANDA DE JUICIO VERBAL DE DESAHUCIO POR FALTA DE PAGO Y RECLAMACIÓN DE RENTAS contra D. Álvaro Peña Castillo, en base a los siguientes',
    { h: 'Hechos' },
    'Primero. Las partes suscribieron contrato de arrendamiento de la vivienda sita en la calle Ríos Rosas 12, 2º izquierda, de Madrid, con una renta mensual de 850 €.',
    'Segundo. El demandado adeuda las cuatro últimas mensualidades, por un importe total de 3.400 €, pese a haber sido requerido fehacientemente mediante burofax.',
    { h: 'Fundamentos de Derecho' },
    'Artículos 27.2.a) de la Ley 29/1994, de Arrendamientos Urbanos, y 250.1.1º, 437 y 440 de la Ley de Enjuiciamiento Civil.',
    { h: 'Suplico' },
    'Que se tenga por presentada esta demanda, se dé traslado al demandado y, en su día, se dicte sentencia que declare resuelto el contrato, condene al demandado a desalojar la vivienda y a abonar las rentas debidas y las que se devenguen hasta el desalojo, con expresa imposición de costas.',
    `En Madrid, a ${fecha(-13)}.`,
  ]);

  // --- Desahucio Solaz Goya
  add('desahucio-solaz-goya', 'cliente', 'Contrato de arrendamiento - Goya 45 3ºA', 100, 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA', [
    `ARRENDADORA: ${nombre(solaz)}, ${idFiscal(solaz)}, representada por ${solaz.type === 'persona_juridica' ? solaz.representanteLegalNombre : ''}.`,
    'ARRENDATARIO: D. Rubén Ortiz Lara, con DNI 51234567L.',
    'Objeto: vivienda en la calle Goya 45, 3ºA, 28001 Madrid. Renta mensual: 1.300 €. Fianza: 1.300 €. Garantía adicional: aval bancario de dos mensualidades.',
    'Duración: cinco años desde la firma, conforme al artículo 9 LAU.',
    'Las partes se someten a los Juzgados y Tribunales de Madrid para cualquier controversia derivada del presente contrato.',
    { firma: ['La arrendadora', 'El arrendatario'] },
  ]);
  add('desahucio-solaz-goya', 'escritos', 'Escrito solicitando el lanzamiento', 8, 'AL JUZGADO DE PRIMERA INSTANCIA Nº 14 DE MADRID', [
    'Juicio verbal de desahucio por falta de pago.',
    `${nombre(solaz)}, parte demandante en el procedimiento de referencia, ante el Juzgado comparece y DICE:`,
    'Que habiendo adquirido firmeza la sentencia dictada en las presentes actuaciones sin que el demandado haya desalojado voluntariamente la vivienda, por medio del presente escrito SOLICITA que se lleve a efecto el lanzamiento en la fecha señalada, con apercibimiento al ocupante de que, de no desalojar, se procederá a su lanzamiento con auxilio de la fuerza pública si fuera necesario.',
    `En Madrid, a ${fecha(-8)}.`,
  ]);

  // --- Herencia García
  hojaEncargo('herencia-garcia', maria, 43,
    'Tramitación completa de la herencia de D. Ramón García Ortiz: obtención de certificados, inventario y valoración de bienes, cuaderno particional, otorgamiento de escritura de aceptación y partición, liquidación de impuestos y cambios de titularidad.',
    'Se fijan unos honorarios de 1.500 € más IVA, abonables en dos pagos del 50 %: a la firma del encargo y a la firma de la escritura de partición.');
  add('herencia-garcia', 'cliente', 'Inventario de bienes de la herencia', 20, 'INVENTARIO Y VALORACIÓN DE BIENES', [
    'Causante: D. Ramón García Ortiz. Herederos: tres hijos por partes iguales, según testamento abierto.',
    { h: 'Activo' },
    { ul: [
      'Vivienda en la calle Mayor 14, 3ºB, Madrid. Valor de referencia catastral: 312.400 €.',
      'Plaza de garaje nº 27 en el mismo edificio. Valor de referencia: 24.800 €.',
      'Cuenta corriente en entidad bancaria. Saldo a la fecha del fallecimiento: 18.230,45 €.',
      'Cuenta de ahorro. Saldo a la fecha del fallecimiento: 41.007,12 €.',
      'Vehículo turismo, matriculado en 2016. Valor según tablas de Hacienda: 6.900 €.',
    ] },
    { h: 'Pasivo' },
    { ul: ['Gastos de entierro y funeral: 4.350 €.', 'Recibo pendiente de IBI del ejercicio: 612,30 €.'] },
    'Total caudal relicto neto estimado: 398.375,27 €. Cuota de cada heredero: 132.791,76 €.',
  ]);
  add('herencia-garcia', 'comunicaciones', 'Solicitud de documentación a herederos', 41, 'SOLICITUD DE DOCUMENTACIÓN', [
    `Estimada ${maria.type === 'persona_fisica' ? maria.nombre : ''}:`,
    'Para avanzar con la tramitación de la herencia de su padre necesitamos que nos facilite la siguiente documentación:',
    { ul: [
      'DNI en vigor de los tres herederos.',
      'Certificado literal de defunción.',
      'Copia de las escrituras de la vivienda y de la plaza de garaje.',
      'Último recibo del IBI de ambos inmuebles.',
      'Certificados bancarios de saldos a fecha de fallecimiento.',
      'Permiso de circulación y ficha técnica del vehículo.',
    ] },
    'Puede enviárnosla escaneada por email o traerla al despacho. Quedamos a su disposición para cualquier duda.',
    `Un saludo cordial,\n${empresa}`,
  ]);

  // --- Divorcio Fernández
  add('divorcio-fernandez', 'contratos', 'Borrador de convenio regulador', 1, 'CONVENIO REGULADOR (BORRADOR)', [
    `En Madrid, a ${fecha(-1)}.`,
    `De una parte, ${nombre(lucia)}, con ${idFiscal(lucia)}. De otra parte, D. Daniel Ortiz Romero, con DNI 52345678M.`,
    'Ambos cónyuges, de común acuerdo, regulan los efectos de su divorcio conforme a los artículos 90 y siguientes del Código Civil:',
    { h: 'Primera. Guarda y custodia' },
    'La guarda y custodia de los dos hijos menores será compartida, por semanas alternas, con intercambio los viernes a la salida del colegio. La patria potestad será ejercida conjuntamente.',
    { h: 'Segunda. Uso de la vivienda familiar' },
    'Durante la minoría de edad de los hijos, la vivienda familiar se usará por turnos coincidentes con la custodia ("casa nido"). Los gastos ordinarios se repartirán al 50 %.',
    { h: 'Tercera. Alimentos' },
    'Cada progenitor atenderá los gastos ordinarios de los hijos durante su periodo de custodia. Ambos ingresarán 300 € mensuales en una cuenta común para gastos escolares, de salud y actividades.',
    { h: 'Cuarta. Gastos extraordinarios' },
    'Se abonarán al 50 %, previo acuerdo por escrito salvo urgencia médica.',
    { h: 'Quinta. Liquidación de la sociedad de gananciales' },
    'Se liquidará en escritura notarial independiente en el plazo de seis meses desde la sentencia de divorcio.',
    { firma: ['Lucía Fernández Sánchez', 'Daniel Ortiz Romero'] },
  ]);
  hojaEncargo('divorcio-fernandez', lucia, 2,
    'Tramitación del divorcio de mutuo acuerdo: redacción del convenio regulador, presentación de la demanda, asistencia a la ratificación y seguimiento hasta la inscripción de la sentencia en el Registro Civil.',
    'Se fijan unos honorarios de 1.200 € más IVA por la tramitación conjunta, abonables a la firma del presente encargo.');

  // --- Monitorio Navarro
  add('monitorio-navarro', 'cliente', 'Relación de facturas impagadas - Reformas Levante', 21, 'RELACIÓN DE FACTURAS IMPAGADAS', [
    `Acreedor: ${nombre(carlos)}. Deudor: Reformas Levante S.L., CIF B98765432.`,
    { ul: [
      `Factura A-${anio(-21)}-031, de 4 de marzo: 3.120,00 €.`,
      `Factura A-${anio(-21)}-044, de 2 de abril: 2.980,00 €.`,
      `Factura A-${anio(-21)}-058, de 6 de mayo: 3.410,00 €.`,
      `Factura A-${anio(-21)}-071, de 3 de junio: 2.970,00 €.`,
    ] },
    'Total adeudado: 12.480,00 €. Se adjuntan albaranes de entrega firmados por el deudor y correos electrónicos en los que reconoce la deuda.',
  ]);
  add('monitorio-navarro', 'escritos', 'Petición inicial de procedimiento monitorio', 2, 'AL JUZGADO DE PRIMERA INSTANCIA DE MADRID', [
    `${nombre(carlos)}, con ${idFiscal(carlos)}, formula PETICIÓN INICIAL DE PROCEDIMIENTO MONITORIO contra Reformas Levante S.L., con CIF B98765432, en reclamación de 12.480,00 € de principal.`,
    'La deuda deriva del suministro de materiales documentado en las facturas y albaranes que se acompañan, es dineraria, vencida, exigible y de cantidad determinada (art. 812 LEC).',
    'El deudor fue requerido extrajudicialmente mediante burofax sin que haya atendido el pago.',
    'SOLICITO que se requiera de pago al deudor para que, en el plazo de veinte días, pague al peticionario o comparezca y alegue sucintamente las razones por las que no debe la cantidad reclamada.',
    `En Madrid, a ${fecha(-2)}.`,
  ]);

  // --- Responsabilidad civil Pérez
  add('rc-perez', 'comunicaciones', 'Reclamación extrajudicial a Promociones Alcalá', 1, 'RECLAMACIÓN EXTRAJUDICIAL POR VICIOS CONSTRUCTIVOS', [
    `Madrid, ${fecha(-1)}.`,
    'A la atención de Promociones Alcalá S.A., Departamento de Posventa.',
    `En nombre de ${nombre(antonio)}, propietario de la vivienda sita en ${domicilio(antonio)}, les comunicamos que la vivienda presenta humedades por filtración en el salón y el dormitorio principal, que tienen su origen en defectos de impermeabilización de la fachada.`,
    'Dichos defectos están cubiertos por la garantía trienal de habitabilidad del artículo 17.1.b) de la Ley 38/1999, de Ordenación de la Edificación.',
    'Les requerimos para que en el plazo de quince días procedan a la reparación o asuman su coste, estimado en 9.600 € según el informe pericial que se adjuntará, con la advertencia de que, en otro caso, se ejercitarán las acciones judiciales oportunas.',
    `Atentamente,\n${empresa}`,
  ]);

  // --- Medidas Dubois
  add('medidas-dubois', 'escritos', 'Demanda de modificación de medidas', 37, 'AL JUZGADO DE PRIMERA INSTANCIA Nº 24 (FAMILIA) DE MADRID', [
    `${nombre(sophie)}, con ${idFiscal(sophie)}, interpone DEMANDA DE MODIFICACIÓN DE MEDIDAS paternofiliales contra D. Thomas Laurent, en base a los siguientes`,
    { h: 'Hechos' },
    'Primero. Las medidas vigentes fueron acordadas en sentencia de hace tres años, que estableció un régimen de visitas de fines de semana alternos y una tarde intersemanal.',
    'Segundo. El demandado ha trasladado su domicilio a Valencia, lo que hace inviable el régimen vigente y supone una alteración sustancial de las circunstancias (art. 775 LEC).',
    'Tercero. Se propone un régimen adaptado: un fin de semana de cada tres, la mitad de las vacaciones escolares y comunicación telemática diaria.',
    { h: 'Suplico' },
    'Que se dicte sentencia modificando las medidas en los términos propuestos.',
    `En Madrid, a ${fecha(-37)}.`,
  ]);

  // --- Tráfico Ortega (cerrado)
  add('trafico-ortega', 'contratos', 'Acuerdo transaccional con la aseguradora', 45, 'ACUERDO TRANSACCIONAL', [
    `En Madrid, a ${fecha(-45)}.`,
    `De una parte, ${nombre(manuel)}, con ${idFiscal(manuel)}, perjudicado en el accidente de circulación ocurrido en la autovía A-6.`,
    'De otra parte, la entidad aseguradora del vehículo responsable, representada por su tramitador de siniestros.',
    { h: 'Acuerdan' },
    'Primero. La aseguradora abona al perjudicado la cantidad de 18.500 € en concepto de indemnización total por lesiones temporales, secuelas y daños materiales, conforme al baremo de la Ley 35/2015.',
    'Segundo. El pago se realizará mediante transferencia en el plazo de diez días a la cuenta de clientes del despacho del letrado del perjudicado.',
    'Tercero. Con el cobro de dicha cantidad, el perjudicado se considera íntegramente resarcido y desiste de las acciones ejercitadas, sin imposición de costas.',
    { firma: ['El perjudicado', 'La aseguradora'] },
  ]);
  add('trafico-ortega', 'comunicaciones', 'Liquidación final al cliente', 38, 'LIQUIDACIÓN DE CUENTAS DEL EXPEDIENTE', [
    `Cliente: ${nombre(manuel)}. Expediente: Accidente de tráfico A-6.`,
    { ul: [
      'Provisión de fondos entregada: 1.000,00 €.',
      'Indemnización cobrada de la aseguradora: 18.500,00 €.',
      'Informe pericial médico: −800,00 €.',
      'Derechos de procurador: −300,00 €.',
      'Honorarios del despacho (2.000 € + IVA): −2.420,00 €.',
    ] },
    'Saldo a favor del cliente transferido a su cuenta: 15.980,00 €.',
    'Con esta liquidación se da por cerrado el expediente. Agradecemos la confianza depositada en nuestro despacho.',
  ]);

  // --- Cuotas Velázquez
  add('cuotas-velazquez', 'cliente', 'Certificado de deuda de la comunidad', 10, 'CERTIFICADO DE DEUDA', [
    `${velazquez.type === 'persona_juridica' ? velazquez.representanteLegalNombre : ''}, en calidad de presidente, y el secretario-administrador de la ${nombre(velazquez)}, CERTIFICAN:`,
    'Que en la junta de propietarios celebrada se aprobó la liquidación de la deuda del propietario de la vivienda 4ºB, que asciende a 3.240 € correspondientes a dieciocho cuotas ordinarias de 180 €.',
    'Que dicho acuerdo fue notificado al propietario deudor en la forma prevista en el artículo 9 de la Ley de Propiedad Horizontal, sin que conste el pago.',
    'Y para que conste a los efectos del artículo 21 LPH, firman el presente certificado.',
    { firma: ['El presidente', 'El secretario-administrador'] },
  ]);

  // --- Rentas Solaz Atocha
  add('rentas-solaz-atocha', 'cliente', 'Contrato de arrendamiento de local - Atocha 80', 50, 'CONTRATO DE ARRENDAMIENTO DE LOCAL DE NEGOCIO', [
    `ARRENDADORA: ${nombre(solaz)}, ${idFiscal(solaz)}.`,
    'ARRENDATARIA: Moda Urbana Atocha S.L., con CIF B87001122.',
    'Objeto: local comercial en la calle Atocha 80, planta baja, de 120 m², destinado a tienda de ropa.',
    'Renta: 1.200 € mensuales más IVA, actualizable anualmente según el IPC. Fianza: dos mensualidades.',
    'Duración: cinco años. Régimen: artículos 29 y siguientes de la Ley de Arrendamientos Urbanos (uso distinto de vivienda).',
    { firma: ['La arrendadora', 'La arrendataria'] },
  ]);
  hojaEncargo('rentas-solaz-atocha', solaz, 49,
    'Reclamación de las rentas adeudadas por la arrendataria del local de la calle Atocha 80 mediante procedimiento monitorio y, en caso de oposición, el juicio que corresponda.',
    'Se aplican las condiciones de la iguala vigente: 600 € más IVA por procedimiento, más un 10 % de lo efectivamente recobrado.');

  return docs;
}
