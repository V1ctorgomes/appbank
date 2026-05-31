import { getClientsForSelect } from "@/actions/sales";
import { SaleForm } from "./sale-form";

export default async function NovaVendaPage() {
  const clients = await getClientsForSelect();
  return <SaleForm clients={clients} />;
}
