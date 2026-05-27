import type { XDispatchModuleManifest } from './types';

export function compareSemverLike(current: string, min: string): boolean {
  const normalize = (v: string): number[] =>
    v
      .replace(/^v/i, '')
      .replace(/[^0-9.]/g, '.')
      .split('.')
      .filter(Boolean)
      .map((x) => Number.parseInt(x, 10))
      .filter((x) => Number.isFinite(x));

  const left = normalize(current);
  const right = normalize(min);
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

export function isModuleManifest(value: unknown): value is XDispatchModuleManifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.version === 'string' &&
    (v.kind === 'bundled' || v.kind === 'external')
  );
}
