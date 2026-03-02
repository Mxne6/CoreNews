export type AmbiguousGroup = {
  groupId: string;
  ambiguous: boolean;
  articles: Array<{
    id: string;
    normalizedTitle: string;
  }>;
};

export type ResolvedGroup = AmbiguousGroup & {
  canonicalTitle: string;
  merged: boolean;
  fallbackReason?: "llm_unavailable";
};

export type AmbiguityResolverClient = {
  resolveGroup: (
    group: AmbiguousGroup,
  ) => Promise<{ canonicalTitle: string; merged: boolean }>;
};

function fallback(group: AmbiguousGroup): ResolvedGroup {
  return {
    ...group,
    canonicalTitle: group.articles[0]?.normalizedTitle ?? "untitled event",
    merged: false,
    fallbackReason: "llm_unavailable",
  };
}

async function resolveWithRetry(
  group: AmbiguousGroup,
  client: AmbiguityResolverClient,
  maxAttempts = 3,
): Promise<ResolvedGroup> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await client.resolveGroup(group);
      if (result.canonicalTitle.trim().length > 0) {
        return {
          ...group,
          canonicalTitle: result.canonicalTitle,
          merged: result.merged,
        };
      }
    } catch {
      // Keep retrying until max attempts reached.
    }
  }

  return fallback(group);
}

export async function resolveAmbiguousGroups(
  groups: AmbiguousGroup[],
  client: AmbiguityResolverClient,
): Promise<ResolvedGroup[]> {
  const resolved: ResolvedGroup[] = [];

  for (const group of groups) {
    if (!group.ambiguous) {
      resolved.push({
        ...group,
        canonicalTitle: group.articles[0]?.normalizedTitle ?? "untitled event",
        merged: true,
      });
      continue;
    }

    resolved.push(await resolveWithRetry(group, client));
  }

  return resolved;
}
