import { notFound, redirect } from "next/navigation";
import { getLoan } from "@/actions/loans";
import { getClientsForSelect } from "@/actions/sales";
import { EditLoanForm } from "./edit-loan-form";

export default async function EditarEmprestimoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [loan, clients] = await Promise.all([getLoan(id), getClientsForSelect()]);

  if (!loan) notFound();

  if (loan.payments.length > 0 || loan.status !== "ACTIVE") {
    redirect(`/emprestimos/${id}`);
  }

  return (
    <EditLoanForm
      clients={clients}
      loan={{
        id: loan.id,
        clientId: loan.clientId,
        principal: loan.principal,
        interestRate: loan.interestRate,
        paymentDay: loan.paymentDay,
        billingStartMonth: loan.billingStartMonth,
        loanDate: loan.loanDate,
        notes: loan.notes,
      }}
    />
  );
}
