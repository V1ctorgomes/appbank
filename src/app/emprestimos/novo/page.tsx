import { getClientsForSelect } from "@/actions/sales";
import { LoanForm } from "./loan-form";

export default async function NovoEmprestimoPage() {
  const clients = await getClientsForSelect();
  return <LoanForm clients={clients} />;
}
