import { CategoryIcon } from './CategoryIcon';
import { Card } from './ui';

interface Props {
  title: string;
  shortDescription: string;
  description: string;
  categoryName: string;
  iconName: string;
  posterSrc: string | null;
  skillLabel?: string;
  duration?: string;
  outcomes: string[];
}

function Pill({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        'inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ' +
        (strong ? 'bg-green-100 text-green-700' : 'bg-paper-warm text-ink-soft')
      }
    >
      {children}
    </span>
  );
}

function Poster({ src, iconName, className }: { src: string | null; iconName: string; className: string }) {
  return (
    <div
      className={
        'flex items-center justify-center overflow-hidden bg-gradient-to-br from-green-800 to-green-900 ' + className
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <CategoryIcon name={iconName} size={40} />
      )}
    </div>
  );
}

/** Shows roughly how the course will look in the mobile app. */
export function CoursePreview(p: Props) {
  const title = p.title.trim() || 'Course title';
  return (
    <div className="space-y-4">
      <div>
        <div className="t-caption mb-2">Card in lists</div>
        <Card className="flex gap-3 p-3">
          <Poster src={p.posterSrc} iconName={p.iconName} className="h-[88px] w-[88px] shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[15px] font-semibold leading-5">{title}</div>
            <div className="mt-0.5 text-[12px] font-semibold text-green-600">{p.categoryName || 'Category'}</div>
            <div className="mt-1 line-clamp-2 text-[12px] leading-4 text-ink-muted">
              {p.shortDescription.trim() || 'Short description appears here.'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill strong>FREE</Pill>
              {p.skillLabel && <Pill>{p.skillLabel}</Pill>}
              {p.duration && <Pill>{p.duration}</Pill>}
            </div>
          </div>
        </Card>
      </div>

      <div>
        <div className="t-caption mb-2">Details screen</div>
        <Card className="overflow-hidden">
          <Poster src={p.posterSrc} iconName={p.iconName} className="aspect-video w-full" />
          <div className="p-4">
            <div className="flex gap-1.5">
              <Pill strong>FREE COURSE</Pill>
              <Pill>{p.categoryName || 'Category'}</Pill>
            </div>
            <div className="mt-2 text-[18px] font-bold leading-6 tracking-[-0.25px]">{title}</div>
            <p className="mt-2 line-clamp-4 text-[13px] leading-5 text-ink-soft">
              {p.description.trim() || 'The full description appears here.'}
            </p>
            {p.outcomes.length > 0 && (
              <ul className="mt-3 space-y-1">
                {p.outcomes.slice(0, 3).map((o, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                    <span className="text-green-600">&#10003;</span>
                    <span className="line-clamp-1">{o}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 rounded-md bg-green-600 py-2.5 text-center text-[14px] font-semibold text-white">
              Open Free Course
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
