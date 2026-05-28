// Regenerates logo-pack/ (PNG marks, tiles, lockups, favicons) and the extension icon
// from the scan-eye brand mark. Run: node scripts/gen-logo-pack.mjs
// Glyph PNGs/tiles -> sharp (librsvg). Wordmark lockups -> headless Chrome + embedded Geist.
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "logo-pack");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONT = join(ROOT, "node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2");

const A = "#7cb0ff", B = "#4e7cef";
const DARK = "#07070a", LIGHT = "#ffffff", TEXT_LIGHT = "#f3f3f6", TEXT_DARK = "#0a0a0b";
const T = { r: 0, g: 0, b: 0, alpha: 0 };

const BRACKETS =
  `<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>` +
  `<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>`;
const EYE = `<path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>`;
const glyph = (pupil) => `${BRACKETS}<circle cx="12" cy="12" r="1" fill="${pupil}" stroke="none"/>${EYE}`;

const markSVG = (px, sw, id) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="url(#${id})" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="${id}" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${B}"/></linearGradient></defs>${glyph(B)}</svg>`;

// Transparent, tight-cropped mark for the extension toolbar icon — fills the
// canvas (no tile) so it adapts to light/dark Chrome toolbars.
const extIconSVG = (px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="2 2 20 20" fill="none" stroke="url(#eg)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="eg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${B}"/></linearGradient></defs>${glyph(B)}</svg>`;

const monoSVG = (px, sw, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${glyph(color)}</svg>`;

const tileSVG = (px, bg) => {
  const gly = px * 0.56, off = (px - gly) / 2, s = gly / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><defs><linearGradient id="tg" x1="0" y1="0" x2="${px}" y2="${px}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${B}"/></linearGradient></defs><rect width="${px}" height="${px}" rx="${px * 0.22}" fill="${bg}"/><g transform="translate(${off} ${off}) scale(${s})" fill="none" stroke="url(#tg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph(B)}</g></svg>`;
};

const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size, { fit: "contain", background: T }).png().toBuffer();

async function main() {
  for (const d of ["svg", "mark", "mark-on-dark", "mark-on-light", "lockup", "favicon"]) {
    mkdirSync(join(OUT, d), { recursive: true });
  }

  // --- source SVGs ---
  writeFileSync(join(OUT, "svg/uatchit-mark.svg"), markSVG(512, 1.6, "g") + "\n");
  writeFileSync(join(OUT, "svg/uatchit-mark-mono.svg"), monoSVG(512, 1.6, B) + "\n");

  // --- transparent mark PNGs ---
  for (const sz of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    writeFileSync(join(OUT, `mark/uatchit-mark-${sz}.png`), await png(markSVG(sz, 1.6, "g"), sz));
  }

  // --- tiles ---
  for (const sz of [256, 512, 1024]) {
    writeFileSync(join(OUT, `mark-on-dark/uatchit-mark-dark-${sz}.png`), await png(tileSVG(sz, DARK), sz));
    writeFileSync(join(OUT, `mark-on-light/uatchit-mark-light-${sz}.png`), await png(tileSVG(sz, LIGHT), sz));
  }

  // --- favicons ---
  writeFileSync(join(OUT, "favicon/favicon-32.png"), await png(markSVG(32, 2, "g"), 32));
  writeFileSync(join(OUT, "favicon/apple-touch-icon-180.png"), await png(tileSVG(180, DARK), 180));
  writeFileSync(join(OUT, "favicon/icon.svg"), readFileSync(join(ROOT, "apps/web/src/app/icon.svg")));

  // --- extension icon (transparent full-bleed mark, no tile) ---
  writeFileSync(join(ROOT, "apps/extension/assets/icon.png"), await png(extIconSVG(512), 512));

  // --- lockups (Chrome + Geist) ---
  const fontB64 = readFileSync(FONT).toString("base64");
  const profile = mkdtempSync(join(tmpdir(), "uatchit-chrome-"));
  const lockupHTML = (textColor) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${fontB64}) format('woff2');font-weight:500;font-style:normal;}
html,body{margin:0;padding:0;background:transparent;}
.wrap{display:inline-flex;align-items:center;gap:20px;padding:70px;}
.wm{font-family:'Geist';font-weight:500;font-size:104px;letter-spacing:-0.02em;color:${textColor};line-height:1;}
svg{display:block;}
</style></head><body><div class="wrap">${markSVG(112, 1.7, "lk")}<span class="wm">uatchit</span></div></body></html>`;

  const shoot = (html, name) => {
    const htmlPath = join(profile, `${name}.html`);
    const outPath = join(profile, `${name}.png`);
    writeFileSync(htmlPath, html);
    try {
      execFileSync(CHROME, [
        "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--no-first-run", "--no-default-browser-check", "--disable-extensions",
        "--disable-background-networking", "--disable-sync",
        `--user-data-dir=${profile}`, "--force-device-scale-factor=2",
        "--window-size=1300,460", "--default-background-color=00000000",
        "--virtual-time-budget=3000", `--screenshot=${outPath}`, `file://${htmlPath}`,
      ], { stdio: "ignore", timeout: 25000, killSignal: "SIGKILL" });
    } catch (e) {
      // headless=new sometimes won't exit even after writing the screenshot — tolerate
      // the timeout as long as the PNG actually landed.
      if (!existsSync(outPath)) throw e;
    }
    return outPath;
  };

  const lightTextRaw = shoot(lockupHTML(TEXT_LIGHT), "light");
  const darkTextRaw = shoot(lockupHTML(TEXT_DARK), "dark");

  // trim transparent margins -> tight transparent lockups
  const lightTrim = await sharp(lightTextRaw).trim().png().toBuffer();
  const darkTrim = await sharp(darkTextRaw).trim().png().toBuffer();
  writeFileSync(join(OUT, "lockup/uatchit-lockup-light.png"), lightTrim); // light text, for dark bgs
  writeFileSync(join(OUT, "lockup/uatchit-lockup-dark.png"), darkTrim);   // dark text, for light bgs

  const pad = async (buf, bg) => {
    const m = await sharp(buf).metadata();
    const p = Math.round(m.height * 0.42);
    return sharp(buf).flatten({ background: bg }).extend({ top: p, bottom: p, left: p, right: p, background: bg }).png().toBuffer();
  };
  writeFileSync(join(OUT, "lockup/uatchit-lockup-on-dark.png"), await pad(lightTrim, DARK));
  writeFileSync(join(OUT, "lockup/uatchit-lockup-on-light.png"), await pad(darkTrim, LIGHT));

  console.log("logo-pack generated at", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
