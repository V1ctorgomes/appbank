import { getCategories } from "@/actions/categories";
import { CategoriesManager } from "./categories-manager";

export default async function ConfiguracoesPage() {
  const categories = await getCategories();
  return <CategoriesManager categories={categories} />;
}
