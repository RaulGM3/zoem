export interface Invoice {
  id: string;
  number: string;
  client: string;
  project?: string;
  amount: number;
  vat: number;
  total: number;
  status: 'pagada' | 'pendiente' | 'vencida' | 'borrador';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
}
