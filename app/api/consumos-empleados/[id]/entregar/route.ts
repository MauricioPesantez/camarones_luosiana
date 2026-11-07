import { consumptionAction } from '@/app/api/consumos-empleados/action';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return consumptionAction(request, id, 'entregar');
}
