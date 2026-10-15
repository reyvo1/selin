'use client';

import { Package } from 'lucide-react';
import { useState } from 'react';

/**
 * The visual anchor of a product card.
 *
 * A photograph is the fastest recognition cue a shopper or cashier has, so the card leads with one
 * when the catalogue has it. When it does not — or when the URL is dead, or the till is offline and
 * the host is unreachable — the card falls back to the icon it has always shown, so a missing photo
 * can never leave a hole in the grid or stop the item being sellable.
 *
 * Three details are deliberate:
 *
 *   - The box is a fixed 4:3 with `object-fit: cover`, so a portrait photo and a landscape photo
 *     occupy the same height and the grid keeps its rhythm.
 *   - `width`/`height` are set on the element. Without them the browser reserves nothing, each image
 *     shoves the rows below it as it loads, and the grid visibly re-flows — the exact failure the
 *     research on card layouts calls out as reading as "broken" regardless of polish.
 *   - `loading="lazy"` keeps a long catalogue from painting a hundred photos at once. Photos are the
 *     heaviest thing in a card, and a till that stalls while scrolling is a till that misses sales.
 *
 * The broken-image case is handled in React rather than by an `onerror` attribute, because the whole
 * point is that a failed load must leave the icon behind instead of the browser's torn-page glyph.
 */
export function ProductMedia({ product, eager = false }: { product: { name: string; imageUrl?: string | null }; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const source = product.imageUrl?.trim();

  if (!source || failed) {
    return (
      <div className="productIcon" aria-hidden="true">
        <Package size={24} strokeWidth={1.7} />
      </div>
    );
  }

  return (
    <div className="productMedia">
      <img
        src={source}
        alt={product.name}
        width={320}
        height={240}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
