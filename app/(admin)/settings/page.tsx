'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  IconButton,
  Input,
  LoadingBlock,
  PageHeader,
  Textarea,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import type { PageSection, SitePage } from '@/lib/types';
import { cn, formatDate, friendlyError, isEmail, isHttpsUrl } from '@/lib/utils';

const TABS = [
  { key: 'links', label: 'App links' },
  { key: 'about', label: 'About Us' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'dmca', label: 'DMCA' },
  { key: 'copyright', label: 'Copyright' },
  { key: 'contact', label: 'Contact Us' },
] as const;

export default function SettingsPage() {
  const [tab, setTab] = useState<string>('links');
  return (
    <>
      <PageHeader
        title="Settings"
        description="Edit what the app shows on its Profile / Settings screens."
      />
      <div className="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex gap-1 rounded-lg bg-white p-1 shadow-card ring-1 ring-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-[14px] transition-colors duration-100 ease-in-out',
                tab === t.key ? 'bg-green-100 font-semibold text-green-700' : 'font-medium text-ink-soft hover:bg-black/5',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'links' ? <LinksEditor /> : <PageEditor key={tab} pageKey={tab} />}
    </>
  );
}

/* ---------------- App links ---------------- */
const LINK_FIELDS = [
  { key: 'support_email', label: 'Support email', hint: 'Used by "Contact Us" in the app.', placeholder: 'support@yourdomain.com' },
  { key: 'community_url', label: 'Community link', hint: 'WhatsApp / Telegram / Discord invite (https).', placeholder: 'https://chat.whatsapp.com/...' },
  { key: 'play_store_url', label: 'Play Store link', hint: 'Used by "Rate App" and "Share App" after you publish.', placeholder: 'https://play.google.com/store/apps/details?id=...' },
] as const;

function LinksEditor() {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await getSupabase().from('app_settings').select('key,value');
    if (err) setError(err.message);
    else setValues(Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value])));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const val = (k: string) => values[k] ?? '';

  async function save() {
    const e: Record<string, string> = {};
    if (val('support_email') && !isEmail(val('support_email'))) e.support_email = 'Enter a valid email address.';
    if (val('community_url') && !isHttpsUrl(val('community_url'))) e.community_url = 'Link must start with https://';
    if (val('play_store_url') && !isHttpsUrl(val('play_store_url'))) e.play_store_url = 'Link must start with https://';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const rows = ['support_email', 'community_url', 'play_store_url', 'share_message'].map((key) => ({
      key,
      value: val(key).trim(),
    }));
    const { error: err } = await getSupabase().from('app_settings').upsert(rows, { onConflict: 'key' });
    setSaving(false);
    if (err) return toast(friendlyError(err), 'error');
    toast('Settings saved.');
  }

  if (loading) return <LoadingBlock />;
  return (
    <>
      {error && <ErrorBanner message={error} onRetry={load} />}
      <Card className="max-w-2xl space-y-4 p-5">
        {LINK_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]}>
            <Input
              value={val(f.key)}
              invalid={!!errors[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </Field>
        ))}
        <Field label="Share message" hint='Text people send when they tap "Share App". The Play Store link is added automatically.'>
          <Textarea rows={3} value={val('share_message')} onChange={(e) => setValues((v) => ({ ...v, share_message: e.target.value }))} />
        </Field>
        <div className="pt-1">
          <Button loading={saving} onClick={save}>
            Save settings
          </Button>
        </div>
      </Card>
    </>
  );
}

/* ---------------- Page content ---------------- */
function PageEditor({ pageKey }: { pageKey: string }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await getSupabase().from('site_pages').select('*').eq('key', pageKey).maybeSingle();
    if (err) setError(err.message);
    else if (data) {
      const p = data as SitePage;
      setTitle(p.title);
      setSections(Array.isArray(p.sections) ? p.sections : []);
      setUpdatedAt(p.updated_at);
    } else {
      setTitle(TABS.find((t) => t.key === pageKey)?.label ?? pageKey);
      setSections([]);
    }
    setLoading(false);
  }, [pageKey]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (i: number, p: Partial<PageSection>) =>
    setSections((cur) => cur.map((s, j) => (j === i ? { ...s, ...p } : s)));

  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= sections.length) return;
    setSections((cur) => {
      const next = [...cur];
      [next[i], next[t]] = [next[t], next[i]];
      return next;
    });
  }

  async function save() {
    if (!title.trim()) {
      setTitleError('Enter a page title.');
      return;
    }
    setTitleError(null);
    const cleaned = sections
      .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
      .filter((s) => s.heading || s.body);

    setSaving(true);
    const { data, error: err } = await getSupabase()
      .from('site_pages')
      .upsert({ key: pageKey, title: title.trim(), sections: cleaned }, { onConflict: 'key' })
      .select('updated_at')
      .single();
    setSaving(false);
    if (err) return toast(friendlyError(err), 'error');
    setSections(cleaned);
    setUpdatedAt((data as { updated_at: string } | null)?.updated_at ?? null);
    toast('Page saved. The app will show it the next time it loads.');
  }

  if (loading) return <LoadingBlock />;

  return (
    <>
      {error && <ErrorBanner message={error} onRetry={load} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <Field label="Page title" required error={titleError ?? undefined}>
              <Input value={title} invalid={!!titleError} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            {updatedAt && <p className="t-caption mt-3">Last updated {formatDate(updatedAt)}</p>}
          </Card>

          {sections.map((s, i) => (
            <Card key={i} className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="t-caption">Section {i + 1}</span>
                <div className="flex gap-1">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="arrow-up" size={16} />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="arrow-down" size={16} />
                  </IconButton>
                  <IconButton
                    label="Remove section"
                    className="hover:!bg-danger/10 hover:!text-danger"
                    onClick={() => setSections((cur) => cur.filter((_, j) => j !== i))}
                  >
                    <Icon name="trash-2" size={16} />
                  </IconButton>
                </div>
              </div>
              <Field label="Heading">
                <Input value={s.heading} onChange={(e) => patch(i, { heading: e.target.value })} />
              </Field>
              <Field label="Text">
                <Textarea rows={6} value={s.body} onChange={(e) => patch(i, { body: e.target.value })} />
              </Field>
            </Card>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSections((cur) => [...cur, { heading: '', body: '' }])}>
              <Icon name="plus" size={16} /> Add section
            </Button>
            <Button loading={saving} onClick={save}>
              <Icon name="save" size={16} /> Save page
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="t-caption mb-2">Preview</div>
          <Card className="p-5">
            <div className="text-[18px] font-bold tracking-[-0.25px]">{title || 'Page title'}</div>
            <div className="mt-4 space-y-4">
              {sections.length === 0 && <p className="text-[13px] text-ink-muted">No sections yet.</p>}
              {sections.map((s, i) => (
                <div key={i}>
                  {s.heading && <div className="text-[15px] font-semibold">{s.heading}</div>}
                  {s.body && <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-ink-soft">{s.body}</p>}
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
