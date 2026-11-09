'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Button, Field, Input, Modal, Textarea, Toggle, useToast } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CATEGORY_ICONS, ICON_KEYS } from '@/lib/category-icons';
import type { Category } from '@/lib/types';
import { SLUG_RE, cn, friendlyError, slugify } from '@/lib/utils';

interface Props {
  open: boolean;
  /** null = create a new category */
  category: Category | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Add / edit a category, including its icon. */
export function CategoryDialog({ open, category, nextSortOrder, onClose, onSaved }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState('book-open');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setSlug(category?.slug ?? '');
    setSlugTouched(Boolean(category));
    setIcon(category?.icon_name ?? 'book-open');
    setDescription(category?.description ?? '');
    setActive(category?.is_active ?? true);
    setErrors({});
  }, [open, category]);

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a category name.';
    if (!slug || !SLUG_RE.test(slug)) e.slug = 'Use lowercase letters, numbers and hyphens only.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const payload = {
      name: name.trim(),
      slug,
      icon_name: icon,
      description: description.trim() || null,
      is_active: active,
    };
    const sb = getSupabase();
    const res = category
      ? await sb.from('categories').update(payload).eq('id', category.id)
      : await sb.from('categories').insert({ ...payload, sort_order: nextSortOrder });
    setSaving(false);

    if (res.error) {
      toast(friendlyError(res.error), 'error');
      return;
    }
    toast(category ? 'Category updated.' : 'Category added.');
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={category ? 'Edit category' : 'Add category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            <Input
              value={name}
              invalid={!!errors.name}
              maxLength={60}
              placeholder="e.g. Photography"
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug" required error={errors.slug} hint="Used in links. Auto-filled from the name.">
            <Input
              value={slug}
              invalid={!!errors.slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
            />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 text-[13px] font-semibold">Icon</div>
          <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-8">
            {ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                title={CATEGORY_ICONS[key].label}
                aria-label={CATEGORY_ICONS[key].label}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md border transition-colors duration-100',
                  icon === key
                    ? 'border-green-600 bg-green-100 ring-2 ring-green-200'
                    : 'border-transparent hover:bg-paper-warm',
                )}
              >
                <CategoryIcon name={key} size={30} />
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted">Selected: {CATEGORY_ICONS[icon]?.label ?? icon}</p>
        </div>

        <Field label="Description" hint="Optional.">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Toggle
          checked={active}
          onChange={setActive}
          label="Active"
          description="Inactive categories are hidden from the app."
        />
      </div>
    </Modal>
  );
}
