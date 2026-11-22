import { CatalogView } from "#features/operations/presentation/catalog/page-view.tsx";
import { requireActor } from "#server/auth.ts";
import { readOperations } from "#server/container.ts";

export default async function CatalogPage() {
  await requireActor("read_operations");
  const reading = await readOperations();
  return <CatalogView reading={reading} />;
}
