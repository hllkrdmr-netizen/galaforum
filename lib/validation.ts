import type { CreateTopicInput } from '../types/forum';
import { CATEGORY_BY_SLUG } from '../constants/categories';

export const TOPIC_TITLE_MIN = 5;
export const TOPIC_TITLE_MAX = 140;
export const POST_BODY_MIN = 10;
export const POST_BODY_MAX = 10_000;

export type TopicValidationErrors = Partial<Record<keyof CreateTopicInput, string>>;

export function validateTopicInput(input: CreateTopicInput): TopicValidationErrors {
  const errors: TopicValidationErrors = {};
  if (!input.categorySlug || !CATEGORY_BY_SLUG[input.categorySlug]) {
    errors.categorySlug = 'Bir kategori seç.';
  }
  const title = input.title.trim();
  if (title.length < TOPIC_TITLE_MIN) errors.title = `Başlık en az ${TOPIC_TITLE_MIN} karakter olmalı.`;
  else if (title.length > TOPIC_TITLE_MAX) errors.title = `Başlık en fazla ${TOPIC_TITLE_MAX} karakter olabilir.`;
  const body = input.body.trim();
  if (body.length < POST_BODY_MIN) errors.body = `Mesaj en az ${POST_BODY_MIN} karakter olmalı.`;
  else if (body.length > POST_BODY_MAX) errors.body = `Mesaj en fazla ${POST_BODY_MAX} karakter olabilir.`;
  return errors;
}

export function hasErrors(errors: TopicValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}
