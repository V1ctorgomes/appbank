import { getCategories } from "@/actions/categories";
import { getPortalUrl } from "@/lib/portal-url";
import { requireAuth } from "@/lib/auth-utils";
import { CategoriesManager } from "./categories-manager";

export default async function ConfiguracoesPage() {
  const [categories, user] = await Promise.all([getCategories(), requireAuth()]);
  const portalUrl = getPortalUrl();
  return (
    <CategoriesManager
      categories={categories}
      portalUrl={portalUrl}
      userId={user.id}
    />
  );
}
