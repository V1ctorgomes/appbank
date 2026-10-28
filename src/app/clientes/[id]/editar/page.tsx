import { notFound } from "next/navigation";
import { getClientForEdit } from "@/actions/clients";
import { EditClientForm } from "./edit-client-form";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientForEdit(id);

  if (!client) notFound();

  return <EditClientForm client={client} />;
}
