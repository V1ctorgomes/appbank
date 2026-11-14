import { getClientsForSelect } from "@/actions/sales";
import { RentalForm } from "./rental-form";

export default async function NovoAluguelPage() {
  const clients = await getClientsForSelect();
  return <RentalForm clients={clients} />;
}
