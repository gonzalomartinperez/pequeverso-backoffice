import { UsageView } from "#features/operations/presentation/usage/page-view.tsx";
import { requireActor } from "#server/auth.ts";
import { readOperations } from "#server/container.ts";

export default async function UsagePage() {
  await requireActor("read_operations");
  const reading = await readOperations();
  return <UsageView reading={reading} />;
}
