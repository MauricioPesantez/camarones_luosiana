import { previewPayment } from "@/lib/payment-preview";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return previewPayment(request, await params);
}
