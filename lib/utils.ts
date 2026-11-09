export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** "Fitness & Gym" -> "fitness-and-gym" (matches the database slug rule). */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Public URL of a poster in the `course-posters` bucket. */
export function posterUrl(path?: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/course-posters/${path}` : null;
}

interface MaybeDbError {
  code?: string;
  message?: string;
}

/** Turns Supabase/Postgres errors into messages an admin can act on. */
export function friendlyError(e: unknown): string {
  const err = (e ?? {}) as MaybeDbError;
  const msg = err.message ?? 'Something went wrong.';
  if (err.code === '23505') return 'That slug is already used by another item. Please change the slug.';
  if (err.code === '23503') return 'This item is still being used by other records.';
  if (msg.includes('courses_publish_requirements'))
    return 'To publish, a course needs a poster, a short and full description, and "Verified free" ticked.';
  if (msg.includes('external_url')) return 'The course link must start with https://';
  if (err.code === '42501' || msg.toLowerCase().includes('row-level security'))
    return "You don't have permission to do this.";
  return msg;
}

export const LANGUAGE_SUGGESTIONS = ['English', 'Hindi', 'Nepali', 'Hinglish'];

export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'All levels' },
];
