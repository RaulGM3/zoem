export interface CalendarEvent {
  id: string;
  title: string;
  client: string;
  type: 'reunion' | 'llamada' | 'entrega' | 'recordatorio';
  date: string;
  time: string;
  duration: string;
  status: 'confirmada' | 'pendiente' | 'cancelada';
  description?: string;
}
