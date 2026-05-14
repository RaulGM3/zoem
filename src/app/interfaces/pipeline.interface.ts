export interface PipelineDeal {
  id: string;
  cliente: string;
  etapa: 'Lead' | 'Calificado' | 'Propuesta' | 'Negociación' | 'Ganado';
  importe: number;
  probabilidad: number;
  diasEnEtapa: number;
  proximaAccion: string;
}
