import { notFound } from "next/navigation";
import { getSale, getClientsForSelect } from "@/actions/sales";
import { EditSaleForm } from "./edit-sale-form";

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, clients] = await Promise.all([getSale(id), getClientsForSelect()]);

  if (!sale) notFound();

  return <EditSaleForm sale={sale} clients={clients} />;
}
