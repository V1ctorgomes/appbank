import { notFound } from "next/navigation";
import { getRental } from "@/actions/rentals";
import { RentalDetail } from "./rental-detail";

export default async function AluguelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) notFound();
  return <RentalDetail rental={rental} />;
}
