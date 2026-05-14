export interface RegistroHora {
  id: string;
  fecha: string;
  cliente: string;
  proyecto: string;
  descripcion: string;
  horas: number;
  importe: number;
  estadoFacturacion: 'facturado' | 'pendiente' | 'no_facturable';
}
