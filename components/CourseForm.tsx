'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Field,
  IconButton,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Textarea,
  Toggle,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { useAdmin } from '@/components/AdminShell';
import { CoursePreview } from '@/components/CoursePreview';
import { PosterCropper } from '@/components/PosterCropper';
import type { Category, Course, CourseStatus } from '@/lib/types';
import {
  LANGUAGE_SUGGESTIONS,
  SKILL_LEVELS,
  SLUG_RE,
  formatDate,
  friendlyError,
  isHttpsUrl,
  posterUrl,
  slugify,
} from '@/lib/utils';

interface FormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  short_description: string;
  description: string;
  external_url: string;
  provider_name: string;
  category_id: string;
  language: string;
  skill_level: string;
  duration_text: string;
  learning_outcomes: string[];
  tags: string[];
  source_note: string;
  is_verified_free: boolean;
  verified_at: string | null;
  is_featured: boolean;
  is_trending: boolean;
  status: CourseStatus;
  poster_path: string | null;
  published_at: string | null;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  slugTouched: false,
  short_description: '',
  description: '',
  external_url: '',
  provider_name: '',
  category_id: '',
  language: '',
  skill_level: '',
  duration_text: '',
  learning_outcomes: [],
  tags: [],
  source_note: '',
  is_verified_free: false,
  verified_at: null,
  is_featured: false,
  is_trending: false,
  status: 'draft',
  poster_path: null,
  published_at: null,
};

function validate(f: FormState, publish: boolean, hasPoster: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  const title = f.title.trim();
  if (title.length < 3) e.title = 'Enter a title (at least 3 characters).';
  else if (title.length > 150) e.title = 'Title can be at most 150 characters.';
  if (!f.slug || !SLUG_RE.test(f.slug)) e.slug = 'Use lowercase letters, numbers and hyphens only.';
  if (!f.category_id) e.category_id = 'Choose a category.';
  if (!isHttpsUrl(f.external_url)) e.external_url = 'Enter a valid link that starts with https://';
  if (f.short_description.length > 200) e.short_description = 'Keep it within 200 characters.';
  if (publish) {
    if (!f.short_description.trim()) e.short_description = 'A short description is needed to publish.';
    if (!f.description.trim()) e.description = 'A full description is needed to publish.';
    if (!hasPoster) e.poster = 'Upload a poster to publish.';
    if (!f.is_verified_free) e.is_verified_free = 'Confirm that this course is genuinely free before publishing.';
  }
  return e;
}

/** Add (no courseId) or edit (courseId) a course. */
export function CourseForm({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { isFullAdmin } = useAdmin();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<Blob | null>(null); // opens the crop dialog
  const [posterOriginal, setPosterOriginal] = useState<Blob | null>(null); // for re-cropping
  const originalPoster = useRef<string | null>(null);

  const [tagDraft, setTagDraft] = useState('');
  const [outcomeDraft, setOutcomeDraft] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const catsRes = await sb.from('categories').select('*').order('sort_order');
      if (cancelled) return;
      if (catsRes.error) {
        setLoadError(catsRes.error.message);
        setLoading(false);
        return;
      }
      setCats((catsRes.data ?? []) as Category[]);

      if (courseId) {
        const res = await sb.from('courses').select('*').eq('id', courseId).maybeSingle();
        if (cancelled) return;
        if (res.error || !res.data) {
          setLoadError(res.error?.message ?? 'This course was not found.');
          setLoading(false);
          return;
        }
        const c = res.data as Course;
        originalPoster.current = c.poster_path;
        setForm({
          title: c.title,
          slug: c.slug,
          slugTouched: true,
          short_description: c.short_description ?? '',
          description: c.description ?? '',
          external_url: c.external_url,
          provider_name: c.provider_name ?? '',
          category_id: c.category_id,
          language: c.language ?? '',
          skill_level: c.skill_level ?? '',
          duration_text: c.duration_text ?? '',
          learning_outcomes: c.learning_outcomes ?? [],
          tags: c.tags ?? [],
          source_note: c.source_note ?? '',
          is_verified_free: c.is_verified_free,
          verified_at: c.verified_at,
          is_featured: c.is_featured,
          is_trending: c.is_trending,
          status: c.status,
          poster_path: c.poster_path,
          published_at: c.published_at,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    return () => {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
    };
  }, [posterPreview]);

  const category = cats.find((c) => c.id === form.category_id);
  const posterSrc = posterPreview ?? posterUrl(form.poster_path);
  const skillLabel = SKILL_LEVELS.find((s) => s.value === form.skill_level)?.label;
  const isPublished = form.status === 'published';

  function onPickPoster(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((e) => ({ ...e, poster: 'Use a JPG, PNG or WebP image.' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((e) => ({ ...e, poster: 'That image is too large (max 10 MB).' }));
      return;
    }
    setPosterOriginal(file);
    setCropSource(file); // crop dialog opens
  }

  /** Crop dialog "Use this crop" */
  function applyCrop(blob: Blob) {
    setPosterBlob(blob);
    setPosterPreview(URL.createObjectURL(blob));
    setCropSource(null);
    setErrors((e) => {
      const { poster: _poster, ...rest } = e;
      return rest;
    });
  }

  /** Re-adjust the current poster (the original file if just picked, else the saved one). */
  async function adjustPoster() {
    if (posterOriginal) {
      setCropSource(posterOriginal);
      return;
    }
    const url = posterUrl(form.poster_path);
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      setCropSource(await res.blob());
    } catch {
      toast("Couldn't load the current poster for editing. Upload the image again to crop it.", 'error');
    }
  }

  function addTag(raw: string) {
    const parts = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    setForm((f) => ({ ...f, tags: Array.from(new Set([...f.tags, ...parts])).slice(0, 20) }));
    setTagDraft('');
  }

  function addOutcome() {
    const v = outcomeDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, learning_outcomes: [...f.learning_outcomes, v].slice(0, 12) }));
    setOutcomeDraft('');
  }

  async function save(target: CourseStatus) {
    const errs = validate(form, target === 'published', Boolean(posterBlob || form.poster_path));
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast('Please fix the highlighted fields.', 'error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    const sb = getSupabase();
    let uploaded: string | null = null;
    try {
      if (posterBlob) {
        const path = `courses/${crypto.randomUUID()}.webp`;
        const up = await sb.storage
          .from('course-posters')
          .upload(path, posterBlob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
        if (up.error) throw up.error;
        uploaded = path;
      }

      const empty = (v: string) => (v.trim() === '' ? null : v.trim());
      const payload = {
        title: form.title.trim(),
        slug: form.slug,
        short_description: empty(form.short_description),
        description: empty(form.description),
        poster_path: uploaded ?? form.poster_path,
        external_url: form.external_url.trim(),
        provider_name: empty(form.provider_name),
        category_id: form.category_id,
        language: empty(form.language),
        skill_level: form.skill_level || null,
        duration_text: empty(form.duration_text),
        learning_outcomes: form.learning_outcomes,
        tags: form.tags,
        source_note: empty(form.source_note),
        is_verified_free: form.is_verified_free,
        verified_at: form.is_verified_free ? form.verified_at ?? new Date().toISOString() : null,
        is_featured: form.is_featured,
        is_trending: form.is_trending,
        status: target,
        published_at: form.published_at,
      };

      const res = courseId
        ? await sb.from('courses').update(payload).eq('id', courseId)
        : await sb.from('courses').insert(payload);
      if (res.error) throw res.error;

      // Replaced poster: remove the old file (best effort).
      if (uploaded && originalPoster.current) {
        await sb.storage.from('course-posters').remove([originalPoster.current]);
      }

      toast(
        target === 'published'
          ? isPublished
            ? 'Changes saved.'
            : 'Course published.'
          : target === 'draft'
            ? 'Saved as draft.'
            : 'Course archived.',
      );
      router.push('/courses');
    } catch (e) {
      if (uploaded) await sb.storage.from('course-posters').remove([uploaded]);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCourse() {
    if (!courseId) return;
    setSaving(true);
    const sb = getSupabase();
    const { error } = await sb.from('courses').delete().eq('id', courseId);
    if (error) {
      toast(friendlyError(error), 'error');
      setSaving(false);
      return;
    }
    if (originalPoster.current) await sb.storage.from('course-posters').remove([originalPoster.current]);
    toast('Course deleted.');
    router.push('/courses');
  }

  const activeCats = useMemo(() => cats.filter((c) => c.is_active || c.id === form.category_id), [cats, form.category_id]);

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBanner message={loadError} />;

  return (
    <>
      <Link href="/courses" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-ink">
        <Icon name="chevron-left" size={14} /> Back to courses
      </Link>
      <PageHeader
        title={courseId ? 'Edit course' : 'Add course'}
        description={
          courseId
            ? `Status: ${form.status}${form.published_at ? ` · first published ${formatDate(form.published_at)}` : ''}`
            : 'Fill in the details, preview it on the right, then publish.'
        }
        actions={
          courseId ? <Badge tone={isPublished ? 'green' : form.status === 'draft' ? 'amber' : 'gray'}>{form.status}</Badge> : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Basics */}
          <Card className="space-y-4 p-5">
            <h2 className="t-h3">Basics</h2>
            <Field label="Title" required error={errors.title}>
              <Input
                value={form.title}
                invalid={!!errors.title}
                maxLength={150}
                placeholder="e.g. Python for Beginners"
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, title: v, slug: f.slugTouched ? f.slug : slugify(v) }));
                }}
              />
            </Field>
            <Field label="Slug" required error={errors.slug} hint="Used in the course address. Created automatically from the title.">
              <Input
                value={form.slug}
                invalid={!!errors.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value), slugTouched: true }))}
              />
            </Field>
            <Field label="Category" required error={errors.category_id}>
              <Select
                value={form.category_id}
                invalid={!!errors.category_id}
                onChange={(e) => set('category_id', e.target.value)}
              >
                <option value="">Choose a category</option>
                {activeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Short description"
              required={form.status === 'published'}
              error={errors.short_description}
              hint={`${form.short_description.length}/200 - shown on course cards.`}
            >
              <Textarea
                rows={2}
                maxLength={200}
                invalid={!!errors.short_description}
                value={form.short_description}
                onChange={(e) => set('short_description', e.target.value)}
              />
            </Field>
            <Field label="Full description" error={errors.description} hint="Shown on the course details screen.">
              <Textarea
                rows={7}
                invalid={!!errors.description}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </Card>

          {/* Poster */}
          <Card className="space-y-4 p-5">
            <h2 className="t-h3">Poster</h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex aspect-video w-56 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper-warm">
                {posterSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterSrc} alt="Poster preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-ink-faint">
                    <Icon name="image" size={26} />
                    <span className="text-[12px]">No poster yet</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-4 text-[14px] font-semibold transition-colors duration-100 hover:bg-paper-warm">
                    <Icon name="upload" size={16} />
                    {posterSrc ? 'Replace poster' : 'Upload poster'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        onPickPoster(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {posterSrc && (
                    <Button variant="secondary" onClick={adjustPoster}>
                      <Icon name="pencil" size={16} /> Crop / center
                    </Button>
                  )}
                </div>
                <p className="text-[12px] text-ink-muted">
                  JPG, PNG or WebP. You can crop, zoom and center it to 16:9 before saving.
                </p>
                {errors.poster && <p className="text-[12px] text-danger">{errors.poster}</p>}
              </div>
            </div>
          </Card>

          {/* Link & free verification */}
          <Card className="space-y-4 p-5">
            <h2 className="t-h3">Course link &amp; free verification</h2>
            <Field label="External course link" required error={errors.external_url} hint="The original website where the course is available. Must start with https://">
              <Input
                type="url"
                value={form.external_url}
                invalid={!!errors.external_url}
                placeholder="https://..."
                onChange={(e) => set('external_url', e.target.value)}
              />
            </Field>
            <Field label="Source note" hint="Where you found it / how you verified it is free (only you can see this).">
              <Input value={form.source_note} onChange={(e) => set('source_note', e.target.value)} />
            </Field>
            <div className={errors.is_verified_free ? 'rounded-md border border-danger/40 bg-[#FDECE9] p-3' : 'rounded-md bg-green-100/60 p-3'}>
              <Toggle
                checked={form.is_verified_free}
                onChange={(v) => set('is_verified_free', v)}
                label="I have verified this course is genuinely free"
                description="Not just a free trial, a paid preview or a payment-gated offer. Required to publish."
              />
              {errors.is_verified_free && <p className="mt-2 text-[12px] text-danger">{errors.is_verified_free}</p>}
            </div>
          </Card>

          {/* Details */}
          <Card className="space-y-4 p-5">
            <h2 className="t-h3">Details</h2>
            <p className="-mt-2 text-[12px] text-ink-muted">Only fill in what you have verified. Empty fields are not shown in the app.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provider name">
                <Input value={form.provider_name} onChange={(e) => set('provider_name', e.target.value)} />
              </Field>
              <Field label="Duration">
                <Input
                  value={form.duration_text}
                  placeholder="e.g. 4h 30m"
                  onChange={(e) => set('duration_text', e.target.value)}
                />
              </Field>
              <Field label="Language">
                <Input
                  list="language-suggestions"
                  value={form.language}
                  onChange={(e) => set('language', e.target.value)}
                />
                <datalist id="language-suggestions">
                  {LANGUAGE_SUGGESTIONS.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
              <Field label="Skill level">
                <Select value={form.skill_level} onChange={(e) => set('skill_level', e.target.value)}>
                  <option value="">Not specified</option>
                  {SKILL_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="What you'll learn" hint="Press Enter to add each point.">
              <div className="space-y-2">
                {form.learning_outcomes.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-paper-soft px-3 py-2">
                    <Icon name="check" size={16} className="shrink-0 text-green-600" />
                    <span className="min-w-0 flex-1 text-[14px]">{o}</span>
                    <IconButton
                      label="Remove"
                      onClick={() => set('learning_outcomes', form.learning_outcomes.filter((_, j) => j !== i))}
                    >
                      <Icon name="x" size={16} />
                    </IconButton>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={outcomeDraft}
                    placeholder="e.g. Build a small project"
                    onChange={(e) => setOutcomeDraft(e.target.value)}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOutcome();
                      }
                    }}
                  />
                  <Button variant="secondary" onClick={addOutcome}>
                    Add
                  </Button>
                </div>
              </div>
            </Field>

            <Field label="Tags" hint="Used by search. Press Enter or comma to add.">
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line px-2 py-1.5 focus-within:border-green-600 focus-within:ring-4 focus-within:ring-green-100">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[12px] font-semibold text-green-700">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => set('tags', form.tags.filter((x) => x !== t))}
                      className="text-green-700 hover:text-ink"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.includes(',')) addTag(v);
                    else setTagDraft(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagDraft);
                    }
                  }}
                  onBlur={() => addTag(tagDraft)}
                  placeholder={form.tags.length ? '' : 'python, beginner...'}
                  className="min-w-[120px] flex-1 bg-transparent px-1 text-[14px] outline-none"
                />
              </div>
            </Field>
          </Card>

          {/* Visibility */}
          <Card className="space-y-4 p-5">
            <h2 className="t-h3">Home screen curation</h2>
            <Toggle
              checked={form.is_featured}
              onChange={(v) => set('is_featured', v)}
              label="Featured"
              description="Shown in the Featured Courses section (only while published)."
            />
            <Toggle
              checked={form.is_trending}
              onChange={(v) => set('is_trending', v)}
              label="Trending"
              description="Shown in Trending Courses, ranked by real views and clicks."
            />
          </Card>

          {/* Actions */}
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
            {isPublished ? (
              <>
                <Button loading={saving} onClick={() => save('published')}>
                  Save changes
                </Button>
                <Button variant="secondary" disabled={saving} onClick={() => save('draft')}>
                  Unpublish
                </Button>
              </>
            ) : (
              <>
                <Button loading={saving} onClick={() => save('published')}>
                  <Icon name="rocket" size={16} /> Publish
                </Button>
                <Button variant="secondary" disabled={saving} onClick={() => save('draft')}>
                  Save draft
                </Button>
              </>
            )}
            {courseId && form.status !== 'archived' && (
              <Button variant="ghost" disabled={saving} onClick={() => save('archived')}>
                Archive
              </Button>
            )}
            <div className="flex-1" />
            {courseId && isFullAdmin && (
              <Button variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
                <Icon name="trash-2" size={16} /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="t-h3 mb-3">Preview</h2>
          <CoursePreview
            title={form.title}
            shortDescription={form.short_description}
            description={form.description}
            categoryName={category?.name ?? ''}
            iconName={category?.icon_name ?? 'book-open'}
            posterSrc={posterSrc}
            skillLabel={skillLabel}
            duration={form.duration_text.trim() || undefined}
            outcomes={form.learning_outcomes}
          />
        </aside>
      </div>

      {cropSource && (
        <PosterCropper source={cropSource} onApply={applyCrop} onClose={() => setCropSource(null)} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this course?"
        message="This permanently deletes the course and its poster. To just hide it, use Unpublish or Archive instead."
        confirmLabel="Delete course"
        danger
        loading={saving}
        onConfirm={deleteCourse}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
