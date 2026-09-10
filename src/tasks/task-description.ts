import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'img'];
const MAX_IMAGES = 5;

export function sanitizeTaskDescription(value?: string | null): string | null {
  if (!value) return null;

  let imageCount = 0;
  const sanitized = sanitizeHtml(value.trim(), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      img: ['src', 'alt', 'title', 'loading', 'referrerpolicy'],
    },
    allowedSchemesByTag: {
      img: ['https'],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
  })
    .trim()
    .replace(/<img\b[^>]*>/gi, (image) => {
      const alt = image.match(/\salt="([^"]+)"/i)?.[1]?.trim();
      const src = image.match(/\ssrc="([^"]+)"/i)?.[1]?.trim();
      if (!alt || !src?.startsWith('https://')) return '';
      imageCount += 1;
      return imageCount <= MAX_IMAGES ? image : '';
    });

  const hasImage = /<img\b/i.test(sanitized);

  const textOnly = sanitizeHtml(sanitized, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .trim();

  return textOnly || hasImage ? sanitized : null;
}
