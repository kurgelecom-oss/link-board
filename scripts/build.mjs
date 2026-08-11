// Builds the client bundle to a content-hashed filename and points index.html at
// it. The hash is derived from the bundle bytes, so the build is deterministic:
// unchanged source produces the same filename and leaves index.html untouched.
//
// Why fingerprinting rather than just no-cache on the bundle: the failure that
// started this was a device (the Samsung Flip panel) serving a stale copy of the
// site. A hashed filename makes the bad state unreachable — new HTML can only
// ever ask for the bundle it was built with, so there is no version of events in
// which an old bundle runs against new HTML.
import * as esbuild from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets');
const INDEX = path.join(ROOT, 'index.html');

const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/app.js')],
    bundle: true,
    format: 'iife',          // classic script: the panel must never need module support
    target: 'chrome58',
    write: false,
    outfile: 'app.legacy.js',
});

const code = Buffer.from(result.outputFiles[0].contents);
const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 10);
const filename = `app.legacy.${hash}.js`;

fs.mkdirSync(OUT_DIR, { recursive: true });

// Drop superseded bundles so the deploy doesn't accumulate every past build.
for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^app\.legacy\.[0-9a-f]+\.js$/.test(f) && f !== filename) {
        fs.unlinkSync(path.join(OUT_DIR, f));
    }
}

fs.writeFileSync(path.join(OUT_DIR, filename), code);

const html = fs.readFileSync(INDEX, 'utf8');
const updated = html.replace(/src="\/[^"]*app\.legacy[^"]*\.js"/, `src="/assets/${filename}"`);
if (updated === html && !html.includes(`/assets/${filename}`)) {
    throw new Error('build: could not find the app.legacy script tag to rewrite in index.html');
}
if (updated !== html) fs.writeFileSync(INDEX, updated);

console.log(`built assets/${filename} (${(code.length / 1024).toFixed(1)}kb)`);
console.log(updated !== html ? 'index.html updated' : 'index.html already current');
