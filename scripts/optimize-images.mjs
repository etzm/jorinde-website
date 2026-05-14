// One-shot image optimizer: convert JPG/PNG → WebP, max 1400px wide, q75.
// Deletes the source file after successful conversion.
// Idempotent: skips files that are already .webp.
// Originals are safe in Bilder_Website/.

import sharp from "sharp";
import { readdir, stat, unlink } from "node:fs/promises";
import { join, extname, basename } from "node:path";

const TARGETS = [
	"public/images/projekte",
	"public/images/preview",
];
const MAX_WIDTH = 1400;
const WEBP_QUALITY = 75;

let before = 0;
let after = 0;
let count = 0;

for (const dir of TARGETS) {
	let entries;
	try {
		entries = await readdir(dir);
	} catch {
		console.warn(`skip ${dir}: not found`);
		continue;
	}
	for (const name of entries) {
		const ext = extname(name).toLowerCase();
		if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;
		const path = join(dir, name);
		const stem = basename(name, ext);
		const out = join(dir, stem + ".webp");
		const beforeSize = (await stat(path)).size;

		try {
			const meta = await sharp(path).metadata();
			const resize = meta.width && meta.width > MAX_WIDTH
				? { width: MAX_WIDTH }
				: null;
			let pipe = sharp(path);
			if (resize) pipe = pipe.resize(resize);
			await pipe
				.webp({ quality: WEBP_QUALITY, effort: 6 })
				.toFile(out);
			const afterSize = (await stat(out)).size;
			await unlink(path);
			before += beforeSize;
			after += afterSize;
			count++;
			const saved = ((1 - afterSize / beforeSize) * 100).toFixed(0);
			console.log(`${name} → ${stem}.webp  ${(beforeSize/1024).toFixed(0)} → ${(afterSize/1024).toFixed(0)} KB  (-${saved}%)`);
		} catch (err) {
			console.error(`fail ${path}:`, err.message);
		}
	}
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
const pct = before > 0 ? ((1 - after / before) * 100).toFixed(0) : "0";
console.log(`\nProcessed ${count} files. Total ${mb(before)} MB → ${mb(after)} MB  (-${pct}%)`);
