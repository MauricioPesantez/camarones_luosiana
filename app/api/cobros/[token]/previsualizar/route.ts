import { previewPayment } from "@/lib/payment-preview";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return previewPayment(request, await params);
}
