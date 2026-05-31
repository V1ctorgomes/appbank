import { notFound } from "next/navigation";
import { getSale } from "@/actions/sales";
import { SaleDetail } from "./sale-detail";

export default async function VendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await getSale(id);

  if (!sale) notFound();

  return <SaleDetail sale={sale} />;
}
