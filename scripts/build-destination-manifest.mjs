/**
 * Generates src/features/destinations/image-manifest.generated.ts by scanning
 * public/destinations/.
 *
 * Why generate rather than configure: adding a destination image should be
 * dropping a file, not editing code. Files are named by IATA code — AGP.jpg,
 * LON.webp — and the lookup happens automatically. Nothing in the application
 * has to know which destinations have artwork.
 *
 * Runs in prebuild, so the manifest can never drift from what's on disk. It also
 * warns about any image lacking a licence record in credits.json, because an
 * unattributed file is a problem you want to hear about while you still remember
 * where it came from.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, parse } from 'node:path';

const DIR = 'public/destinations';
const OUT = 'src/features/destinations/image-manifest.generated.ts';
const PAY_DIR = 'public/payment';
const PAY_OUT = 'src/lib/payment-marks.generated.ts';
/* Photographs. SVG is deliberately absent — a destination card wants a raster
   photo, and an SVG here would almost certainly be a mistaken file. */
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/* Card marks are vector by nature, so this set differs. */
const MARK_EXTENSIONS = new Set(['.svg', '.png', '.webp']);

const files = existsSync(DIR)
  ? readdirSync(DIR).filter((name) => EXTENSIONS.has(parse(name).ext.toLowerCase()))
  : [];

const credits = existsSync(join(DIR, 'credits.json'))
  ? JSON.parse(readFileSync(join(DIR, 'credits.json'), 'utf8'))
  : {};

const entries = [];
const uncredited = [];

for (const file of files) {
  const code = parse(file).name.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    console.warn(
      `  skipped ${file} — filename must be a three-letter IATA code, e.g. AGP.jpg`,
    );
    continue;
  }
  if (!credits[code]) uncredited.push(code);
  entries.push({ code, path: `/destinations/${file}` });
}

entries.sort((a, b) => a.code.localeCompare(b.code));

const body = `/* GENERATED FILE — do not edit.
 *
 * Written by scripts/build-destination-manifest.mjs from the contents of
 * public/destinations/. To add a destination image, drop a file named after the
 * IATA code (AGP.jpg) into that folder and add a licence line to credits.json.
 * Regenerated on every build.
 */

export const DESTINATION_IMAGES: Readonly<Record<string, string>> = {
${entries.map((entry) => `  ${entry.code}: '${entry.path}',`).join('\n')}
};
`;

writeFileSync(OUT, body);

if (uncredited.length > 0) {
  console.warn(
    `\n  No licence record for: ${uncredited.join(', ')}` +
      `\n  Add them to ${DIR}/credits.json — see the README in that folder.\n`,
  );
}

console.log(
  entries.length === 0
    ? 'No destination images found (cards will use the no-photo layout).'
    : `Destination manifest: ${entries.length} image${entries.length === 1 ? '' : 's'}.`,
);

/* ---- Payment marks -------------------------------------------------------
 * Same drop-a-file pattern. Card brand marks are trademarks and must come from
 * each network's own brand centre — they cannot be redrawn or approximated, so
 * the footer falls back to a text badge until real files are present rather than
 * shipping something that looks like a logo and isn't.
 */
const payFiles = existsSync(PAY_DIR)
  ? readdirSync(PAY_DIR).filter((name) =>
      MARK_EXTENSIONS.has(parse(name).ext.toLowerCase()),
    )
  : [];

const payEntries = payFiles
  .map((file) => ({ key: parse(file).name.toLowerCase(), path: `/payment/${file}` }))
  .sort((a, b) => a.key.localeCompare(b.key));

writeFileSync(
  PAY_OUT,
  `/* GENERATED FILE — do not edit.
 *
 * Written by scripts/build-destination-manifest.mjs from public/payment/.
 * Drop e.g. visa.svg, mastercard.svg, amex.svg into that folder. Files must be the
 * official marks from each network's brand centre — see public/payment/README.md.
 */

export const PAYMENT_MARKS: Readonly<Record<string, string>> = {
${payEntries.map((entry) => `  '${entry.key}': '${entry.path}',`).join('\n')}
};
`,
);

console.log(
  payEntries.length === 0
    ? 'No payment marks found (footer will use text badges).'
    : `Payment marks: ${payEntries.map((entry) => entry.key).join(', ')}.`,
);
