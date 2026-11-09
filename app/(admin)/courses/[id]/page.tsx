'use client';

import { useParams } from 'next/navigation';
import { CourseForm } from '@/components/CourseForm';

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  return <CourseForm key={id} courseId={id} />;
}
