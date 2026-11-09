import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClipboardList, UserCheck, Wrench, CircleCheck, Archive } from 'lucide-react';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// Generate portable PNGs from the app's Lucide React icon set.
const output = new URL('../../backend/src/assets/email/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [name, Icon] of Object.entries({ open: ClipboardList, assigned: UserCheck, progress: Wrench, resolved: CircleCheck, closed: Archive })) {
  for (const [tone, color] of Object.entries({ active: '#0D3B6E', pending: '#8B9BB0' })) {
    const svg = renderToStaticMarkup(React.createElement(Icon, { size: 64, strokeWidth: 1.6, color }));
    await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(`${name}-${tone}.png`, output)));
  }
}
console.log('Generated 10 Lucide React email icons.');
