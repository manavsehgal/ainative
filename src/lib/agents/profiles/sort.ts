export function sortProfilesByName<T extends { name: string }>(
  profiles: T[]
): T[] {
  return [...profiles].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
