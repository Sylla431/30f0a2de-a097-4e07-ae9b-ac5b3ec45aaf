/** Normalise un nom de quartier pour comparaison insensible à la casse/accents */
export function normalizeQuartier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Vérifie si une entité correspond au quartier sélectionné (ou tous si null) */
export function matchesQuartier(
  quartier: string | null | undefined,
  commune: string | null | undefined,
  selected: string | null
): boolean {
  if (!selected) return true;

  const target = normalizeQuartier(selected);
  const candidates = [quartier, commune].filter(Boolean) as string[];

  return candidates.some((value) => {
    const normalized = normalizeQuartier(value);
    return (
      normalized === target ||
      normalized.includes(target) ||
      target.includes(normalized)
    );
  });
}
