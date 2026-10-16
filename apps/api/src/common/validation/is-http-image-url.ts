import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/** Long enough for a signed CDN path, short enough that a card never ships a megabyte of URL. */
export const MAX_IMAGE_URL_LENGTH = 2048;

const HTTP_ONLY = /^https?:\/\//i;

/**
 * Is this a plain http(s) image reference that a browser can load without leaking anything?
 *
 * A photo URL arrives from an operator form and is rendered straight into an `<img src>`, which makes
 * it attacker-influenced markup-adjacent input. Three schemes are refused rather than sanitised:
 *
 *   - `javascript:` executes in the page instead of loading an image.
 *   - `data:` carries inline content, and an SVG data URL is a script vector.
 *   - `blob:` and `file:` reference the operator's own machine, not a shareable catalogue asset.
 *
 * Credentials embedded in the authority (`https://user:pass@host`) are refused because a product
 * card is shown to every cashier and to the public storefront, so a URL that works only for whoever
 * typed it is a broken image plus a leaked secret in the page source.
 *
 * A `data:` URL is deliberately NOT supported. It would sidestep the host allow-list entirely, and a
 * photo pasted as a data URL is also the single largest contributor to a slow product grid.
 *
 * The value is stored and returned as text only. Nothing here fetches the URL, so this validator
 * cannot be used to reach an internal host from the API.
 */
export function isHttpImageUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_URL_LENGTH) return false;
  if (!HTTP_ONLY.test(trimmed)) return false;
  // Whitespace inside a URL is ambiguous across parsers and is a classic filter-bypass shape.
  if (/[\s<>"]/.test(trimmed)) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  // A query string is where a signed, expiring CDN token ends up. Those break the moment the card
  // is cached, and they put a credential in the DOM for anyone who opens the inspector.
  if (parsed.search) return false;
  return Boolean(parsed.hostname);
}

/**
 * class-validator decorator wrapping {@link isHttpImageUrl}.
 *
 * An empty string is treated as "no photo" rather than as an invalid URL, because a form that submits
 * an untouched optional text field should clear the photo, not fail the save with a validation error
 * the operator cannot act on.
 */
export function IsHttpImageUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isHttpImageUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown): boolean => (value === '' ? true : isHttpImageUrl(value)),
        defaultMessage: (args: ValidationArguments): string =>
          `${args.property} harus berupa URL http/https tanpa kredensial, tanpa spasi, dan tanpa query string`,
      },
    });
  };
}
