# Coursly Admin

Web admin panel for Coursly (Next.js 15, TypeScript, Tailwind, Supabase).
Design follows the Notion-inspired green design system.

## What it does
- **Courses:** add / edit / publish / unpublish / archive / delete, poster upload (auto-resized), tags,
  learning outcomes, featured + trending, "verified free" check, live preview of how it looks in the app.
- **Categories:** add / edit / delete / reorder / show-hide, icon picker (31 full-color icons).
  A category with courses cannot be deleted silently: you must move its courses first (or hide it).
- **Settings:** edit About Us, Privacy Policy, DMCA, Copyright, Contact Us (sections), plus support email,
  community link, Play Store link and share message.
- **Dashboard:** real counts only (published courses, categories, featured, trending, views, link clicks).

## Security
- Email/password login for admins only. No sign-up page.
- Every page needs a Supabase session; the database (Row Level Security) re-checks every read/write.
- Roles: `admin` can delete; `editor` can add/edit but not delete (enforced in the database).
- No service-role key anywhere. Only the public anon key is used.

## One-time setup (Windows PowerShell)

1. In Supabase > SQL Editor run, in order (skip any you already ran):
   `supabase/migrations/0001_schema.sql`, `0002_rls_storage.sql`, `0003_admin_content.sql`,
   then `supabase/seed/001_categories.sql` and `002_site_pages.sql`.
2. Supabase > Authentication > Users > **Add user** (tick "Auto confirm user").
3. Make that user an admin (SQL Editor):
   ```sql
   insert into public.admin_users (user_id, role)
   select id, 'admin' from auth.users where email = 'YOU@EXAMPLE.COM';
   ```
4. Run the panel:
   ```powershell
   cd admin
   copy .env.example .env.local     # then fill in URL + anon key
   npm install
   npm run dev                      # http://localhost:3000
   ```
Requires Node.js 18.18 or newer (`node -v`).

## Deploy
Any Node host works (for example Vercel). Set the two `NEXT_PUBLIC_SUPABASE_*` variables there.

## What the mobile app reads
| Table | Used for |
|---|---|
| `categories` | Explore screen (only `is_active`), order = `sort_order`, icon = `icon_name` |
| `courses` | Home / lists / details (only `status = 'published'`) |
| `site_pages` | About Us, Privacy Policy, DMCA, Copyright, Contact Us |
| `app_settings` | support_email, community_url, play_store_url, share_message |
