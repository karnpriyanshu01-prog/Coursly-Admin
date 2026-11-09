import { CATEGORY_ICONS } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

export function categoryAccent(iconName: string): string {
  return CATEGORY_ICONS[iconName]?.accent ?? '#14832B';
}

/** Full-color category icon (same artwork as the mobile app). */
export function CategoryIcon({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const def = CATEGORY_ICONS[name] ?? CATEGORY_ICONS['book-open'];
  return (
    <span
      className={cn('inline-block shrink-0 [&>svg]:h-full [&>svg]:w-full', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: def.svg }}
    />
  );
}
