export type FixtureCase = { id: string; target: string; created_at: string; status: "fixture-ready" };
type Store = Pick<Storage, "getItem" | "setItem">;
export function loadCases(storage: Pick<Store, "getItem">, key: string, target: string): FixtureCase[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 100 || !data.every((row) => row && row.target === target && row.status === "fixture-ready" && typeof row.id === "string" && typeof row.created_at === "string")) throw new Error("Saved test data is invalid. Clear this site's test storage to reset.");
  return data.map(row => ({id: row.id, target, status: "fixture-ready", created_at: row.created_at}));
}
export function addCase(storage: Store, key: string, target: string, supplied: string): FixtureCase[] {
  if (supplied !== target) throw new Error("Only the prefilled synthetic fixture is allowed. Live collection is disabled.");
  const cases = loadCases(storage, key, target);
  if (cases.length >= 100) throw new Error("Test storage is full.");
  const next: FixtureCase[] = [{ id: "fixture-" + crypto.randomUUID(), target, created_at: new Date().toISOString(), status: "fixture-ready" }, ...cases];
  storage.setItem(key, JSON.stringify(next));
  return next;
}
