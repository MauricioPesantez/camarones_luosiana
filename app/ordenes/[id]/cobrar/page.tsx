import { paginaCobro } from "@/lib/cobro-page";

export default async function CobrarPorIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return paginaCobro(await params, true);
}
