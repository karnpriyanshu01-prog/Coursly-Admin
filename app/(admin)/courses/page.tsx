'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Toggle,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { useAdmin } from '@/components/AdminShell';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { Category, Course, CourseStatus } from '@/lib/types';
import { formatDate, friendlyError, posterUrl } from '@/lib/utils';

type Row = Pick<
  Course,
  'id' | 'title' | 'status' | 'is_featured' | 'is_trending' | 'poster_path' | 'category_id' | 'view_count' | 'click_count' | 'updated_at'
>;
type CatLite = Pick<Category, 'id' | 'name' | 'icon_name' | 'is_active'>;

const PAGE_SIZE = 15;

export default function CoursesPage() {
  const toast = useToast();
  const { isFullAdmin } = useAdmin();

  const [cats, setCats] = useState<CatLite[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [flag, setFlag] = useState('');

  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce the search box (avoids a database call on every key press).
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    (async () => {
      const { data } = await getSupabase()
        .from('categories')
        .select('id,name,icon_name,is_active')
        .order('sort_order');
      setCats((data ?? []) as CatLite[]);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = getSupabase()
      .from('courses')
      .select(
        'id,title,status,is_featured,is_trending,poster_path,category_id,view_count,click_count,updated_at',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (status) q = q.eq('status', status);
    if (category) q = q.eq('category_id', category);
    if (flag === 'featured') q = q.eq('is_featured', true);
    if (flag === 'trending') q = q.eq('is_trending', true);
    const s = search.replace(/[%,()*]/g, ' ').trim();
    if (s) q = q.or(`title.ilike.%${s}%,provider_name.ilike.%${s}%`);

    const { data, count, error: err } = await q;
    if (err) setError(err.message);
    else {
      setRows((data ?? []) as Row[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, status, category, flag, search]);

  useEffect(() => {
    load();
  }, [load]);

  const catOf = (id: string) => cats.find((c) => c.id === id);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function updateCourse(row: Row, patch: Partial<Course>, okMessage: string) {
    const { error: err } = await getSupabase().from('courses').update(patch).eq('id', row.id);
    if (err) {
      toast(friendlyError(err), 'error');
      return;
    }
    patchRow(row.id, patch as Partial<Row>);
    toast(okMessage);
  }

  const setRowStatus = (row: Row, next: CourseStatus) =>
    updateCourse(
      row,
      { status: next },
      next === 'published' ? 'Course published.' : next === 'archived' ? 'Course archived.' : 'Course moved to drafts.',
    );

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const sb = getSupabase();
    const { error: err } = await sb.from('courses').delete().eq('id', toDelete.id);
    if (err) {
      toast(friendlyError(err), 'error');
    } else {
      if (toDelete.poster_path) await sb.storage.from('course-posters').remove([toDelete.poster_path]);
      toast('Course deleted.');
      setToDelete(null);
      load();
    }
    setDeleting(false);
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE + rows.length);
  const hasFilters = Boolean(search || status || category || flag);

  return (
    <>
      <PageHeader
        title="Courses"
        description="Add, edit, publish and curate the courses shown in the app."
        actions={
          <Link href="/courses/new">
            <Button>
              <Icon name="plus" size={16} /> Add course
            </Button>
          </Link>
        }
      />

      <Card className="mb-4 p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_150px_180px_150px]">
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-3 text-ink-faint" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or provider"
              className="pl-9"
              aria-label="Search courses"
            />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={flag} onChange={(e) => { setFlag(e.target.value); setPage(0); }} aria-label="Curation">
            <option value="">All courses</option>
            <option value="featured">Featured</option>
            <option value="trending">Trending</option>
          </Select>
        </div>
      </Card>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="book-open"
            title={hasFilters ? 'No courses match these filters' : 'No courses yet'}
            description={hasFilters ? 'Try clearing a filter or searching for something else.' : 'Add your first free course to see it in the app.'}
            action={
              hasFilters ? undefined : (
                <Link href="/courses/new">
                  <Button>
                    <Icon name="plus" size={16} /> Add course
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const cat = catOf(r.category_id);
              const img = posterUrl(r.poster_path);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-green-800 to-green-900">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CategoryIcon name={cat?.icon_name ?? 'book-open'} size={26} />
                    )}
                  </div>

                  <div className="min-w-[180px] flex-1">
                    <Link href={`/courses/${r.id}`} className="line-clamp-1 font-semibold hover:text-green-700">
                      {r.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                      <Badge tone={r.status === 'published' ? 'green' : r.status === 'draft' ? 'amber' : 'gray'}>
                        {r.status}
                      </Badge>
                      <span>{cat?.name ?? 'Unknown category'}</span>
                      <span>&middot; {r.view_count} views</span>
                      <span>&middot; {r.click_count} clicks</span>
                      <span className="hidden sm:inline">&middot; {formatDate(r.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Toggle
                      checked={r.is_featured}
                      label="Featured"
                      onChange={(v) => updateCourse(r, { is_featured: v }, v ? 'Marked as featured.' : 'Removed from featured.')}
                    />
                    <Toggle
                      checked={r.is_trending}
                      label="Trending"
                      onChange={(v) => updateCourse(r, { is_trending: v }, v ? 'Marked as trending.' : 'Removed from trending.')}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {r.status === 'published' ? (
                      <IconButton label="Unpublish (move to drafts)" onClick={() => setRowStatus(r, 'draft')}>
                        <Icon name="eye-off" size={17} />
                      </IconButton>
                    ) : (
                      <IconButton label="Publish" onClick={() => setRowStatus(r, 'published')}>
                        <Icon name="rocket" size={17} />
                      </IconButton>
                    )}
                    {r.status !== 'archived' && (
                      <IconButton label="Archive" onClick={() => setRowStatus(r, 'archived')}>
                        <Icon name="archive" size={17} />
                      </IconButton>
                    )}
                    <Link href={`/courses/${r.id}`}>
                      <IconButton label="Edit">
                        <Icon name="pencil" size={17} />
                      </IconButton>
                    </Link>
                    {isFullAdmin && (
                      <IconButton label="Delete" onClick={() => setToDelete(r)} className="hover:!bg-danger/10 hover:!text-danger">
                        <Icon name="trash-2" size={17} />
                      </IconButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-ink-muted">
          <span>
            Showing {from}-{to} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <Icon name="chevron-left" size={14} /> Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => setPage((p) => p + 1)}>
              Next <Icon name="chevron-right" size={14} />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this course?"
        message={
          <>
            <strong>{toDelete?.title}</strong> will be permanently deleted, along with its poster. If you only want to
            hide it from the app, use Unpublish or Archive instead.
          </>
        }
        confirmLabel="Delete course"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
