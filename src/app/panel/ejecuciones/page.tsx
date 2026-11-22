import { RunsView } from "#features/operations/presentation/runs/page-view.tsx";
import { requireActor } from "#server/auth.ts";
import { readOperations } from "#server/container.ts";

export default async function RunsPage() {
  await requireActor("read_operations");
  const reading = await readOperations();
  return <RunsView reading={reading} />;
}
