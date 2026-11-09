export type CourseStatus = 'draft' | 'published' | 'archived';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon_name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  poster_path: string | null;
  external_url: string;
  provider_name: string | null;
  category_id: string;
  language: string | null;
  skill_level: string | null;
  duration_text: string | null;
  learning_outcomes: string[];
  tags: string[];
  is_verified_free: boolean;
  source_note: string | null;
  verified_at: string | null;
  is_featured: boolean;
  is_trending: boolean;
  view_count: number;
  click_count: number;
  trending_score: number;
  status: CourseStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageSection {
  heading: string;
  body: string;
}

export interface SitePage {
  key: string;
  title: string;
  sections: PageSection[];
  updated_at: string;
}

export type AdminRole = 'admin' | 'editor';
