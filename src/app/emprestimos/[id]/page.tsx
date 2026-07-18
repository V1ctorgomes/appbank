import { notFound } from "next/navigation";
import { getLoan } from "@/actions/loans";
import { LoanDetail } from "./loan-detail";

export default async function EmprestimoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loan = await getLoan(id);

  if (!loan) notFound();

  return <LoanDetail loan={loan} />;
}
