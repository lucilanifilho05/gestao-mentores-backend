import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br'];

export function sanitizeTaskDescription(value?: string | null): string | null {
  if (!value) return null;

  const sanitized = sanitizeHtml(value.trim(), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();

  const textOnly = sanitizeHtml(sanitized, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .trim();

  return textOnly ? sanitized : null;
}
