'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { Badge, Button, Card, ErrorBanner, LoadingBlock, PageHeader } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import type { Course } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Stats {
  published: number;
  drafts: number;
  categories: number;
  activeCategories: number;
  featured: number;
  trending: number;
  views: number;
  clicks: number;
}

type Recent = Pick<Course, 'id' | 'title' | 'status' | 'updated_at'>;

const head = { count: 'exact' as const, head: true };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const sb = getSupabase();
    const [pub, draft, cats, activeCats, feat, trend, metrics, recentRes] = await Promise.all([
      sb.from('courses').select('id', head).eq('status', 'published'),
      sb.from('courses').select('id', head).eq('status', 'draft'),
      sb.from('categories').select('id', head),
      sb.from('categories').select('id', head).eq('is_active', true),
      sb.from('courses').select('id', head).eq('status', 'published').eq('is_featured', true),
      sb.from('courses').select('id', head).eq('status', 'published').eq('is_trending', true),
      sb.from('courses').select('view_count,click_count').eq('status', 'published'),
      sb.from('courses').select('id,title,status,updated_at').order('updated_at', { ascending: false }).limit(6),
    ]);

    const firstError = [pub, draft, cats, activeCats, feat, trend, metrics, recentRes].find((r) => r.error);
    if (firstError?.error) {
      setError(firstError.error.message);
      return;
    }

    const rows = (metrics.data ?? []) as { view_count: number; click_count: number }[];
    setStats({
      published: pub.count ?? 0,
      drafts: draft.count ?? 0,
      categories: cats.count ?? 0,
      activeCategories: activeCats.count ?? 0,
      featured: feat.count ?? 0,
      trending: trend.count ?? 0,
      views: rows.reduce((sum, r) => sum + (r.view_count ?? 0), 0),
      clicks: rows.reduce((sum, r) => sum + (r.click_count ?? 0), 0),
    });
    setRecent((recentRes.data ?? []) as Recent[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards: { label: string; value: number; icon: IconName; hint?: string }[] = stats
    ? [
        { label: 'Published courses', value: stats.published, icon: 'book-open', hint: `${stats.drafts} drafts` },
        { label: 'Categories', value: stats.categories, icon: 'layout-grid', hint: `${stats.activeCategories} active` },
        { label: 'Featured courses', value: stats.featured, icon: 'star' },
        { label: 'Trending courses', value: stats.trending, icon: 'flame' },
        { label: 'Course views', value: stats.views, icon: 'eye', hint: 'Published courses' },
        { label: 'Link clicks', value: stats.clicks, icon: 'mouse-pointer-click', hint: '"Open Free Course" taps' },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A quick look at what is live in the Coursly app."
        actions={
          <Link href="/courses/new">
            <Button>
              <Icon name="plus" size={16} /> Add course
            </Button>
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!stats && !error && <LoadingBlock />}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {cards.map((c) => (
              <Card key={c.label} className="p-4 md:p-5">
                <div className="flex items-center gap-2 text-ink-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 text-green-600">
                    <Icon name={c.icon} size={16} />
                  </span>
                  <span className="t-caption">{c.label}</span>
                </div>
                <div className="mt-3 text-[26px] font-bold leading-8 tracking-[-0.625px]">
                  {c.value.toLocaleString('en-IN')}
                </div>
                {c.hint && <div className="mt-0.5 text-[12px] text-ink-muted">{c.hint}</div>}
              </Card>
            ))}
          </div>

          <h2 className="t-h2 mb-3 mt-10">Recently updated</h2>
          <Card>
            {recent.length === 0 ? (
              <div className="p-6 text-center text-ink-muted">No courses yet. Add your first course!</div>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/courses/${c.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-100 hover:bg-paper-soft"
                    >
                      <span className="min-w-0 truncate font-medium">{c.title}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Badge tone={c.status === 'published' ? 'green' : c.status === 'draft' ? 'amber' : 'gray'}>
                          {c.status}
                        </Badge>
                        <span className="hidden text-[12px] text-ink-muted sm:inline">{formatDate(c.updated_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
