import { notFound } from "next/navigation";
import { getRental } from "@/actions/rentals";
import { getClientsForSelect } from "@/actions/sales";
import { EditRentalForm } from "./edit-rental-form";

export default async function EditarAluguelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [rental, clients] = await Promise.all([
    getRental(id),
    getClientsForSelect(),
  ]);
  if (!rental) notFound();

  return (
    <EditRentalForm
      clients={clients}
      rental={{
        id: rental.id,
        clientId: rental.clientId,
        vehicleDescription: rental.vehicleDescription,
        plate: rental.plate,
        notes: rental.notes,
        totalValue: Number(rental.totalValue),
        vehicleCost: rental.vehicleCost != null ? Number(rental.vehicleCost) : null,
      }}
    />
  );
}
