'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Toggle,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { useAdmin } from '@/components/AdminShell';
import { CategoryIcon, categoryAccent } from '@/components/CategoryIcon';
import { CategoryDialog } from '@/components/CategoryDialog';
import type { Category } from '@/lib/types';
import { friendlyError } from '@/lib/utils';

type Row = Category & { courseCount: number };

export default function CategoriesPage() {
  const toast = useToast();
  const { isFullAdmin } = useAdmin();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const sb = getSupabase();
    const [catRes, courseRes] = await Promise.all([
      sb.from('categories').select('*').order('sort_order').order('name'),
      sb.from('courses').select('category_id'),
    ]);
    if (catRes.error || courseRes.error) {
      setError((catRes.error ?? courseRes.error)!.message);
      setLoading(false);
      return;
    }
    const counts = new Map<string, number>();
    ((courseRes.data ?? []) as { category_id: string }[]).forEach((c) =>
      counts.set(c.category_id, (counts.get(c.category_id) ?? 0) + 1),
    );
    setRows(((catRes.data ?? []) as Category[]).map((c) => ({ ...c, courseCount: counts.get(c.id) ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(row: Row, value: boolean) {
    const { error: err } = await getSupabase().from('categories').update({ is_active: value }).eq('id', row.id);
    if (err) return toast(friendlyError(err), 'error');
    setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, is_active: value } : r)));
    toast(value ? 'Category is now visible in the app.' : 'Category hidden from the app.');
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((r, i) => ({ ...r, sort_order: i + 1 }));
    setRows(renumbered);
    const sb = getSupabase();
    const changed = renumbered.filter((r, i) => r.sort_order !== rows.find((o) => o.id === r.id)?.sort_order || i < 0);
    const results = await Promise.all(
      changed.map((r) => sb.from('categories').update({ sort_order: r.sort_order }).eq('id', r.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast(friendlyError(failed.error), 'error');
      load();
    }
  }

  function askDelete(row: Row) {
    setToDelete(row);
    setMoveTo(rows.find((r) => r.id !== row.id)?.id ?? '');
  }

  async function doDelete(moveCourses: boolean) {
    if (!toDelete) return;
    setBusy(true);
    const sb = getSupabase();
    if (moveCourses && toDelete.courseCount > 0) {
      const mv = await sb.from('courses').update({ category_id: moveTo }).eq('category_id', toDelete.id);
      if (mv.error) {
        toast(friendlyError(mv.error), 'error');
        setBusy(false);
        return;
      }
    }
    const del = await sb.from('categories').delete().eq('id', toDelete.id);
    setBusy(false);
    if (del.error) {
      toast(friendlyError(del.error), 'error');
      return;
    }
    toast('Category deleted.');
    setToDelete(null);
    load();
  }

  async function deactivateInstead() {
    if (!toDelete) return;
    await toggleActive(toDelete, false);
    setToDelete(null);
  }

  const hasCourses = (toDelete?.courseCount ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Categories"
        description="These are the topics shown on the Explore screen of the app."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Icon name="plus" size={16} /> Add category
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="layout-grid"
            title="No categories yet"
            description="Add a category so you can organise courses."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                <div className="flex flex-col">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="!h-6 !w-6">
                    <Icon name="arrow-up" size={14} />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="!h-6 !w-6">
                    <Icon name="arrow-down" size={14} />
                  </IconButton>
                </div>

                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${categoryAccent(r.icon_name)}1F` }}
                >
                  <CategoryIcon name={r.icon_name} size={30} />
                </div>

                <div className="min-w-[160px] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    {!r.is_active && <Badge tone="gray">Hidden</Badge>}
                  </div>
                  <div className="text-[12px] text-ink-muted">
                    /{r.slug} &middot; {r.courseCount} {r.courseCount === 1 ? 'course' : 'courses'}
                  </div>
                </div>

                <Toggle checked={r.is_active} label="Active" onChange={(v) => toggleActive(r, v)} />

                <div className="flex items-center gap-1">
                  <IconButton
                    label="Edit"
                    onClick={() => {
                      setEditing(r);
                      setDialogOpen(true);
                    }}
                  >
                    <Icon name="pencil" size={17} />
                  </IconButton>
                  {isFullAdmin && (
                    <IconButton label="Delete" onClick={() => askDelete(r)} className="hover:!bg-danger/10 hover:!text-danger">
                      <Icon name="trash-2" size={17} />
                    </IconButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!isFullAdmin && !loading && (
        <p className="t-caption mt-3">Only users with the &quot;admin&quot; role can delete categories.</p>
      )}

      <CategoryDialog
        open={dialogOpen}
        category={editing}
        nextSortOrder={(rows.at(-1)?.sort_order ?? 0) + 1}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />

      {/* Delete: no courses */}
      <ConfirmDialog
        open={toDelete !== null && !hasCourses}
        title="Delete this category?"
        message={
          <>
            <strong>{toDelete?.name}</strong> has no courses and will be removed from the app.
          </>
        }
        confirmLabel="Delete category"
        danger
        loading={busy}
        onConfirm={() => doDelete(false)}
        onClose={() => setToDelete(null)}
      />

      {/* Delete: has courses -> move them first (courses are never deleted silently) */}
      <Modal
        open={toDelete !== null && hasCourses}
        onClose={() => setToDelete(null)}
        title="This category has courses"
        footer={
          <>
            <Button variant="ghost" onClick={deactivateInstead} disabled={busy}>
              Hide instead
            </Button>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={!moveTo}
              className="!bg-danger hover:!bg-[#d93a25]"
              onClick={() => doDelete(true)}
            >
              Move &amp; delete
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-6 text-ink-soft">
          <strong>{toDelete?.name}</strong> has {toDelete?.courseCount}{' '}
          {toDelete?.courseCount === 1 ? 'course' : 'courses'}. Courses are never deleted along with a category. Move
          them to another category first, or just hide this category from the app.
        </p>
        <div className="mt-4">
          <div className="mb-1.5 text-[13px] font-semibold">Move courses to</div>
          <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {rows
              .filter((r) => r.id !== toDelete?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        </div>
      </Modal>
    </>
  );
}
