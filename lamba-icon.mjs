#!/usr/bin/env node
// lamba icon: make an app icon from painted art, and look at any icon the way Lamba shows it.
//   node lamba-icon.mjs art.png [my-app] [--out icon.svg]     painted art (a square picture, 1024 x 1024 is best) as the app's icon.svg
//   node lamba-icon.mjs --look [my-app]                         my-app-icon-look.png (next to the folder): the icon at 48, 120 and 512 px in Lamba's rounded tile
// The icon standard (https://lamba.tv/devs/docs/assets/#required-the-icon): a full-bleed rich background, ONE descriptive scene that says what the app
// does, soft light and shadow, 2 or 3 colours, no words, clear at 48 px and rich at 512 px. Most icons are drawn as SVG by hand or by your AI (the
// skill's templates/icon-template.svg shows the layers); this helper is for art painted elsewhere.
// What art.png becomes: icon.svg, a 120 x 120 square. The art fills it edge to edge (cropped to a square from its middle, never stretched), with a soft light
// from the top and a gentle shade at the edges like every Lamba icon. With ffmpeg on this computer (or ffmpeg-static) the art is made a 384 px JPEG first,
// so the icon stays light on phones (about 20 to 40 KB); without it the art goes in as it is.
// --look needs Playwright (npm install && npx playwright install chromium, the same as lamba-test.mjs).
//   node lamba-check.mjs my-app    warns when an icon is flat, one bare glyph, has words, too many colours, lines that vanish small, or is heavy.
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, extname, basename, dirname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const named = args.filter((a, i) => !a.startsWith("-") && !["--out"].includes(args[i - 1]));
const say = (...a) => console.log(...a);
export const ICON_PX = 384, ICON_MAX = 50000;

if (args.includes("--look")) await look(named[0] ? resolve(named[0]) : process.cwd());
else make();

function make() {
  const pic = named[0], dir = named[1] ? resolve(named[1]) : existsSync("lamba.json") ? process.cwd() : null;
  if (!pic || !existsSync(pic)) {
    say("lamba icon: give a square picture of painted art (png, jpg or webp) that shows what the app does, filling the picture edge to edge:\n  node lamba-icon.mjs art.png my-app\n"
      + "Or draw the icon as SVG (templates/icon-template.svg in the skill shows the layers), then look at it:\n  node lamba-icon.mjs --look my-app");
    process.exit(2);
  }
  const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }, type = MIME[extname(pic).toLowerCase()];
  if (!type) { say("lamba icon: a png, jpg or webp picture please (" + basename(pic) + ")"); process.exit(2); }
  let bytes = readFileSync(pic), mime = type, made = false;
  const FF = ffmpeg();
  if (FF) {
    const tmp = mkdtempSync(join(tmpdir(), "lamba-icon-")), out = join(tmp, "p.jpg");
    try {
      execFileSync(FF, ["-y", "-loglevel", "error", "-i", pic, "-vf", "scale=" + ICON_PX + ":" + ICON_PX + ":force_original_aspect_ratio=increase,crop=" + ICON_PX + ":" + ICON_PX, "-frames:v", "1", "-q:v", "3", out]);
      bytes = readFileSync(out); mime = "image/jpeg"; made = true;
    } catch (e) {}
    rmSync(tmp, { recursive: true, force: true });
  }
  // the art edge to edge (slice: cropped from the middle, never stretched), a soft light from the top, a gentle shade at the edges
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 120">'
    + '<defs><radialGradient id="l" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs>'
    + '<image width="120" height="120" preserveAspectRatio="xMidYMid slice" xlink:href="data:' + mime + ';base64,' + bytes.toString("base64") + '"/>'
    + '<rect width="120" height="120" fill="url(#l)"/><rect width="120" height="120" fill="url(#v)"/></svg>\n';
  const out = resolve(opt("--out") || (dir ? join(dir, "icon.svg") : "icon.svg"));
  writeFileSync(out, svg);
  say("lamba icon: wrote " + out + " (" + Math.round(svg.length / 1024) + " KB): the art edge to edge" + (made ? ", a " + ICON_PX + " px copy" : "") + ", with a soft light and shade.");
  if (svg.length > ICON_MAX) say("It is over " + Math.round(ICON_MAX / 1000) + " KB: run it with ffmpeg on this computer (brew install ffmpeg, or npm i ffmpeg-static) so the art is made smaller.");
  say("Now look at it small: node lamba-icon.mjs --look" + (dir ? " " + basename(dir) : "") + ". At 48 px you must still see what the app does. In lamba.json: \"icon\": \"icon.svg\".");
}

function ffmpeg() {
  const ok = b => { try { execFileSync(b, ["-version"], { stdio: "ignore" }); return true; } catch (e) { return false; } };
  if (ok("ffmpeg")) return "ffmpeg";
  try { const b = createRequire(join(process.cwd(), "x.js"))("ffmpeg-static"); if (b && ok(b)) return b; } catch (e) {}
  return null;
}

// the icon as Lamba shows it: a rounded tile (about 22% corners) at 48, 120 and 512 px, on a light and a dark page
async function look(dir) {
  let icon = join(dir, "icon.svg");
  try { const m = JSON.parse(readFileSync(join(dir, "lamba.json"), "utf8")); if (typeof m.icon === "string") icon = join(dir, m.icon); } catch (e) {}
  if (!existsSync(icon)) { say("lamba icon: no icon at " + icon + ". Run it with your app's folder: node lamba-icon.mjs --look my-app"); process.exit(2); }
  let chromium;
  try { ({ chromium } = createRequire(join(process.cwd(), "x.js"))("playwright")); } catch (e) {
    say("lamba icon: --look needs Playwright, like lamba-test.mjs: npm install && npx playwright install chromium"); process.exit(2);
  }
  const uri = "data:image/svg+xml;base64," + readFileSync(icon).toString("base64"), tile = px => '<img src="' + uri + '" style="width:' + px + "px;height:" + px + "px;border-radius:" + Math.round(px * 0.225) + 'px">';
  const row = bg => '<div style="display:flex;gap:28px;align-items:flex-end;padding:28px;background:' + bg + '">' + tile(48) + tile(120) + tile(512) + "</div>";
  const b = await chromium.launch({ args: ["--mute-audio", "--use-mock-keychain", "--password-store=basic"] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  await p.setContent('<!doctype html><body style="margin:0;width:max-content">' + row("#f2f2f4") + row("#1c1c1e") + "</body>");
  await p.waitForTimeout(200);
  const app = resolve(dir), out = join(dirname(app), basename(app) + "-icon-look.png");   // next to the app's folder, never inside it
  await p.screenshot({ path: out, fullPage: true }); await b.close();
  say("lamba icon: wrote " + out + ": your icon at 48, 120 and 512 px, on light and dark. Open it and ask: at 48 px, can you tell what the app does?");
}
