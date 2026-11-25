import { paginaCobro } from "@/lib/cobro-page";

export default async function CobrarOrdenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  return paginaCobro(await params, (await searchParams).origen === "lista");
}
