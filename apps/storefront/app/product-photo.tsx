'use client';

import { useState } from 'react';

/**
 * The product photo on a storefront card or detail page.
 *
 * This is the biggest single change to how the shop looks: the card used to render the product's
 * first letter inside a square, so a page of products was a grid of initials. A photo is the fastest
 * recognition cue a shopper has, and it is what every comparable storefront leads with.
 *
 * When there is no photo — the common case until a catalogue is photographed — the letter is what
 * comes back, so nothing is left blank and the grid keeps its shape. A photo that fails to load
 * behaves the same way, which matters because a merchant-supplied URL rot.
 *
 * `width`/`height` are set on every image so the browser reserves the box before the bytes arrive;
 * without them a long catalogue visibly re-flows as each photo lands.
 */
export function ProductPhoto({ product, variant = 'card' }: { product: { name: string; imageUrl?: string | null }; variant?: 'card' | 'detail' }) {
  const [failed, setFailed] = useState(false);
  const source = product.imageUrl?.trim();
  const initials = product.name.trim().slice(0, 1).toUpperCase() || '?';

  if (!source || failed) {
    // `detail` keeps its own class because the detail page reserves a taller block, and a letter
    // centred in that block reads as a deliberate placeholder rather than as an empty panel.
    return variant === 'detail'
      ? <div className="productDetailVisual" aria-hidden="true">{initials}</div>
      : <div className="productImage" aria-hidden="true">{initials}</div>;
  }

  return variant === 'detail'
    ? <div className="productDetailVisual productDetailPhoto"><img src={source} alt={product.name} width={640} height={480} decoding="async" onError={() => setFailed(true)} /></div>
    : <div className="productImage productImagePhoto"><img src={source} alt={product.name} width={400} height={400} loading="lazy" decoding="async" onError={() => setFailed(true)} /></div>;
}
