import { notFound } from "next/navigation";
import { getClient } from "@/actions/clients";
import { EditClientForm } from "./edit-client-form";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) notFound();

  return <EditClientForm client={client} />;
}
