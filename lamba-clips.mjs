#!/usr/bin/env node
// lamba clips: record your app's clips for its page on Lamba TV, from the simulator, with nothing to film by hand.
//   node lamba-clips.mjs [my-app] [--seconds 10] [--script steps.json] [--headed]
// It needs, once, in this folder: npm install && npx playwright install chromium   (Playwright, and ffmpeg-static when
// the computer has no ffmpeg of its own)
// What it does:
//   1. opens the app in the real simulator (the one inside lamba-test.mjs, next to this script): the screen, the Host's
//      phone and Players, served from this computer
//   2. plays a short session on the phones: the taps in --script, else random taps on their buttons, the bigger ones
//      more often, and records it
//   (the app is recorded with no frame or mat, so the clips show its own picture)
//   3. writes six or more clips, one for each part of the room (the app page shows them in a row, grouped by who they show),
//      in the exact format an app page wants (540 x 920, H.264, <seconds> s, no sound, each with its
//      -poster.webp, the clip's first frame). The phone is the real Lamba remote (the preview, the sheet and its tiles), captured at
//      exactly 390 x 844 and cut to its own rounded glass, never a page around it, so there are no white edges; the screen is its
//      picture edge to edge:
//        clips/<id>-start.mp4      role together: the room as the app starts (the whole screen picture, 16:9, never cropped, with a phone over its lower right)
//        clips/<id>-screen.mp4     role screen: the whole screen picture, full frame, on a soft gradient of the app's tint (lamba.json "tint")
//        clips/<id>-host.mp4       role host: the Host's phone, big (the real Lamba remote, its preview and tiles)
//        clips/<id>-player.mp4     role player: a Player's phone, big (an app with Players)
//        clips/<id>-together.mp4   role together: the screen with a phone over its corner, no words in the picture (the page shows the caption)
//        clips/<id>-moment.mp4     role screen: a later moment of the same play, full frame
//        clips/<id>-late.mp4       role host (an app with no Players): the Host's phone, later
//        clips/<id>-settings.mp4   role host, an app with settings of its own: the Host chooses, the screen changes
//   4. lists them in lamba.json "clips" and removes the starter's placeholder clips.
// Then look at each poster, and write captions in lamba.json that say what each clip shows.
//
// --script steps.json: a list played in a loop, for a session that shows the app at its best, e.g.
//   [{ "phone": "g1", "tap": "#answer-2" }, { "wait": 900 }, { "phone": "g2", "tap": ".go" }, { "phone": "owner", "tap": "#next" }]
//   phone: "g1", "g2", "g3" (Players) or "owner" (the Host); tap: a CSS selector on that phone's page; wait: milliseconds.
//   Or an object { "setup": [steps run once before recording], "steps": [...], "once": true (play the steps once, then hold the last picture instead of looping) }.
//   A step may also carry "upload": "path/to/file" (a file the tap's picker gets; the path is relative to where you run this) or "text": "typed into the tap's field".
//   --tag later names a recording's clips <id>-later-screen and so on (a live scenario's rig.record). --kinds start,screen,host,player,together,moment records only those (default: all of them; the player clip only for an app with Players).
//   --name my-clip --caption "words" records ONE clip, clips/my-clip.mp4 with its poster, and leaves lamba.json alone. --players "Alex Morgan,Jamie Parker", --host "Taylor Brooks" and --guests 3 set the people.
//   --live scenario.mjs --base http://127.0.0.1:8771  records against the real worker, the real screen page and the real Lamba remote (a local `wrangler dev`, Chrome, ffmpeg and Lamba's repository's tests/sdk-room.mjs),
//   for what the simulator cannot show; scenario.mjs exports default async rig => { ...; await rig.record(async () => { ...the clip... }) } (see docs/sdk/ASSETS.md).
//   A tap whose element is not on that phone right now is skipped at once, so list the keys of every part of the app (the lobby's Ready, each round's move).
import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, unlinkSync } from "node:fs";
import { join, resolve, relative, basename, dirname, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { inflateRawSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, "lamba-clips.mjs"));
// the starter kit's placeholder clips, by their SHA-256 (the kit's build fills these in from Lamba's check)
const PLACEHOLDERS = ["5bbbd22bc3f4b056ee767a62b8ec885c6766ba38d5e57b72da4918b33e459ce0","da6fe1d5a1acee53eb96995e6e9fd43f7a7e3f0de7ecbf6d0ed3627338e33287","13dc9b09054f1df551795c2eedb74307376ac0b115a174710f497c9a9cab69f2","f58064faa1a5f2806878f48c785d194532ac89c824b04feec76673bf8d65ef05"];
const args = process.argv.slice(2), flag = f => args.includes(f);
const opt = k => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const MAIN = opt("--main"), ONE = opt("--name"), ONECAP = opt("--caption"), HEADED = flag("--headed"), SECONDS = Math.max(6, Math.min(14, +opt("--seconds") || 10)), SCRIPT = opt("--script");
const named = args.filter((a, i) => !a.startsWith("-") && !["--seconds", "--script", "--main", "--name", "--caption", "--kinds", "--tiles", "--group", "--tag", "--players", "--host", "--guests", "--live", "--base"].includes(args[i - 1]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const say = (...a) => console.log(...a);
const W = 540, H = 920, BG = "0x141416", FPS = 30;

// ---------- what it needs ----------
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { say("lamba clips: Playwright is not installed here. Run this once in this folder, then run lamba clips again:\n  npm install && npx playwright install chromium"); process.exit(2); }
function ffmpeg() {
  const has264 = bin => { try { return /libx264/.test(execFileSync(bin, ["-hide_banner", "-encoders"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch (e) { return false; } };
  if (has264("ffmpeg")) return "ffmpeg";
  try { const bin = require("ffmpeg-static"); if (bin && has264(bin)) return bin; } catch (e) {}
  return null;
}
const FF = ffmpeg();
if (!FF) { say("lamba clips: ffmpeg is needed to make H.264 clips. Run this once in this folder, then run lamba clips again:\n  npm i ffmpeg-static"); process.exit(2); }

// ---------- the simulator: the one inside lamba-test.mjs, or Lamba's repository ----------
const SIM = (() => { const f = join(HERE, "lamba-test.mjs"); if (!existsSync(f)) return null; const m = readFileSync(f, "utf8").match(/^const SIM = "([A-Za-z0-9+/=]+)";/m); return m ? m[1] : null; })();
const REPO = SIM ? null : [join(HERE, ".."), HERE].find(d => existsSync(join(d, "shell/sdk/lamba.js")) && existsSync(join(d, "devs/simulator/sim.js")));
if (!SIM && !REPO) { say("lamba clips: lamba-test.mjs (it carries the simulator) is not next to this script. Get the starter kit again: https://lamba.tv/devs/kit/starter.zip"); process.exit(2); }
const FILES = SIM ? (() => { const o = JSON.parse(inflateRawSync(Buffer.from(SIM, "base64")).toString("utf8")); for (const k in o) o[k] = Buffer.from(o[k], "base64"); return o; })() : null;
if (!SIM && !PLACEHOLDERS.length) { const m = readFileSync(join(REPO, "worker/check.js"), "utf8").match(/PLACEHOLDER_CLIPS = \[([^\]]*)\]/); if (m) PLACEHOLDERS.push(...[...m[1].matchAll(/"([0-9a-f]{64})"/g)].map(x => x[1])); }
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf", ".zip": "application/zip", ".mp4": "video/mp4" };
function file(p) {
  if (FILES) return FILES[p] || null;
  const f = join(REPO, p);
  if (!f.startsWith(REPO + sep) || !existsSync(f) || !statSync(f).isFile()) return null;
  return readFileSync(f);
}
function serve() {
  const server = createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "");
    if (p === "" || p.endsWith("/")) p += "index.html";
    if (/(^|\/)\.\.?(\/|$)/.test(p)) { r.writeHead(404); r.end(); return; }
    let b = file(p);
    if (!b && !extname(p)) { p += "/index.html"; b = file(p); }
    if (!b) { r.writeHead(404, { "content-type": "text/plain" }); r.end("not found"); return; }
    r.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); r.end(b);
  });
  return new Promise(res => server.listen(0, "127.0.0.1", () => res(server)));
}

// ---------- the app's folder, as a zip (as lamba-test.mjs opens it) ----------
const SKIP = n => n === "node_modules" || n.startsWith(".") || n === "lamba-test-shots";
function walk(dir) { const out = []; const go = d => { for (const n of readdirSync(d)) { const f = join(d, n); if (SKIP(n)) continue; if (statSync(f).isDirectory()) go(f); else out.push(relative(dir, f).split(sep).join("/")); } }; go(dir); return out.sort(); }
const CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipOf(dir, prefix, patch) {
  const parts = [], central = []; let at = 0; const paths = walk(dir);
  for (const rel of paths) {
    let data = readFileSync(join(dir, rel)); if (patch && rel === "lamba.json") data = patch(data); const name = Buffer.from(prefix + rel, "utf8"), c = crc(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt32LE(c, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt16LE(0x800, 8); e.writeUInt32LE(c, 16); e.writeUInt32LE(data.length, 20); e.writeUInt32LE(data.length, 24); e.writeUInt16LE(name.length, 28); e.writeUInt32LE(at, 42);
    parts.push(h, name, data); central.push(e, name); at += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(paths.length, 8); end.writeUInt16LE(paths.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat(parts.concat([cd, end]));
}

// ---------- driving the simulator ----------
const rigFrame = (p, rig) => p.frames().find(f => { try { return new URL(f.url()).searchParams.get("rig") === rig && /\/devs\/simulator\/(tv|phone)\.html/.test(f.url()); } catch (e) { return false; } });
async function sealed(p, rig, view, ms) {   // the app's own page inside a rig, in that view
  const end = Date.now() + (ms || 10000);
  while (Date.now() < end) {
    const r = rigFrame(p, rig);
    if (r) for (const f of p.frames()) if (f.parentFrame() === r && f.url() === "about:srcdoc") { const v = await f.evaluate(() => window.Lamba && Lamba.screen && Lamba.screen.view).catch(() => null); if (v === view || (Array.isArray(view) && view.includes(v))) return f; }
    await wait(150);
  }
  return null;
}
const box = async (p, sel) => { const b = await p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }).catch(() => null); return b && b.w > 20 && b.h > 20 ? b : null; };
const showRig = async (p, rig) => { await p.evaluate(r => { const i = [...document.querySelectorAll(".sim-phone")].findIndex(x => x.dataset.rig === r), t = document.querySelectorAll("#who button")[i]; if (t) t.click(); }, rig); await new Promise(r => setTimeout(r, 250)); };   // one phone shows at a time: the Remote control's Host | Player switch picks it
// every phone at exactly 390 x 844 (a phone's real size, as lamba-test takes it): the real remote page unscaled, no bezel, no radius, no shadow: what is captured is the remote and nothing else
async function realSize(p) {
  await p.evaluate(() => { SIM.still = true; for (const g of document.querySelectorAll(".sim-phone .sim-glass")) { const f = g.querySelector("iframe"); g.style.cssText += ";width:390px;height:844px;margin:0;border-radius:0;box-shadow:none;background:#000"; if (f) { f.style.width = "390px"; f.style.height = "844px"; f.style.transform = "none"; } } dispatchEvent(new Event("resize")); });
  await wait(700);
}
const glass = rig => 'figure.sim-phone[data-rig="' + rig + '"] .sim-glass';

// one tap on a phone: a step of the script, else something on screen chosen at random (bigger things more often)
// a phone not in the picture has no layout (the simulator shows one phone at a time), so it is pressed from inside its page:
// shown = no hidden attribute, display or visibility on the element or its parents, not disabled; then el.click()
// (sel: a CSS selector, or "*" for a random key that is shown; no eval, the sealed pages forbid it)
const PRESS_UNSEEN = sel => {
  const shown = e => { if (!e || e.disabled) return false; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const st = getComputedStyle(x); if (x.hidden || x.getAttribute("aria-hidden") === "true" || st.display === "none" || st.visibility === "hidden") return false; } return true; };
  const e = sel === "*" ? (l => l[Math.floor(Math.random() * l.length)])([...document.querySelectorAll("button, [role=button], [data-tap]")].filter(shown)) : document.querySelector(sel);
  if (!shown(e)) return false;
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 };   // as a finger does: down, up, then the click
  e.dispatchEvent(new PointerEvent("pointerdown", o)); e.dispatchEvent(new PointerEvent("pointerup", o)); e.click(); return true; };
const PRESSED = {};   // presses on each phone, said at the end, so a script that matched nothing (or a Player never pressed) shows
async function tapRandom(f, shown = true, who = "") {
  if (!shown) { if (await f.evaluate(PRESS_UNSEEN, "*").catch(() => false)) PRESSED[who] = (PRESSED[who] || 0) + 1; return; }
  const t = await f.evaluate(() => {
    const ok = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width >= 24 && r.height >= 24 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && s.visibility !== "hidden" && s.pointerEvents !== "none" && !el.disabled && !el.closest("[hidden],[aria-hidden=true]"); };
    const all = [...document.querySelectorAll("button, [role=button], input[type=range], canvas, [data-tap]")].filter(ok);
    if (!all.length) return null;
    const w = all.map(el => { const r = el.getBoundingClientRect(); return Math.sqrt(r.width * r.height) * (/\bl-main\b/.test(el.className) ? 3 : 1); });
    let n = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < all.length - 1 && (n -= w[i]) > 0) i++;
    const el = all[i];
    if (el.type === "range") { const lo = +el.min || 0, hi = el.max === "" ? 100 : +el.max; el.value = String(lo + Math.random() * (hi - lo)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return { done: true }; }
    el.setAttribute("data-lamba-clips", "1"); const r = el.getBoundingClientRect();
    return { canvas: el.tagName === "CANVAS", w: r.width, h: r.height };
  }).catch(() => null);
  if (!t) return;
  PRESSED[who] = (PRESSED[who] || 0) + 1; if (t.done) return;
  const position = t.canvas ? { x: t.w * (0.2 + Math.random() * 0.6), y: t.h * (0.2 + Math.random() * 0.6) } : undefined;
  await f.click("[data-lamba-clips]", { force: true, timeout: 1500, position }).catch(() => {});
  await f.evaluate(() => { const e = document.querySelector("[data-lamba-clips]"); if (e) e.removeAttribute("data-lamba-clips"); }).catch(() => {});
}
// play for ms: the script's steps in a loop, else a tap every second or so, on each player's phone in turn (the phone
// in the picture more often)
let PAGE = null;   // the simulator's page (file pickers open on it)
// a step with "host": a tap on the Host's real remote (its tiles, its sheet), by CSS selector, in the page the Host's phone shows; "rdump": true lists what is there
async function remoteStep(s) {
  const rf = rigFrame(PAGE, "owner"); if (!rf) return false;
  if (s.rdump) { say("remote: " + await rf.evaluate(() => [...document.querySelectorAll("button,[role=button],input")].filter(e => e.getClientRects().length).map(e => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "") + (e.getAttribute("aria-label") ? "[aria-label=" + e.getAttribute("aria-label") + "]" : "") + " | " + (e.textContent || "").trim().slice(0, 24)).join("\n  ")).catch(e => String(e))); return true; }
  const ok = await rf.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.disabled || !e.getClientRects().length) return false; e.scrollIntoView({ block: "nearest", inline: "center" }); e.click(); return true; }, s.host).catch(() => false);
  if (ok) PRESSED.owner = (PRESSED.owner || 0) + 1; return ok;
}
async function pressStep(phones, main, s) {   // one step with a tap; true when pressed
  if (s.host || s.rdump) return remoteStep(s);
  const who = s.phone || main, f = phones[who]; if (!f || !s.tap) return false;
  if (s.upload) PAGE.once("filechooser", fc => fc.setFiles(resolve(s.upload)).catch(() => {}));
  if (who === main) { if (!await f.isVisible(s.tap).catch(() => false) || !await f.click(s.tap, { force: true, timeout: 1500 }).then(() => true, () => false)) return false; }
  else if (!await f.evaluate(PRESS_UNSEEN, s.tap).catch(() => false)) return false;
  if (s.text) await f.fill(s.tap, s.text).catch(() => {});
  PRESSED[who] = (PRESSED[who] || 0) + 1; return true;
}
async function setup(phones, main, list) {
  for (const s of list || []) {
    if (s.wait) { await wait(+s.wait); continue; }
    if (s.tvdump) { const f = await sealed(PAGE, "tv", "screen", 2000); say("tv: " + await f.evaluate(() => document.body.className + " | html=" + document.documentElement.className + " | idle=" + getComputedStyle(document.getElementById("idle")).display + " | bg=" + getComputedStyle(document.body).backgroundColor + " | " + document.body.innerText.slice(0, 80).replace(/\n/g, " / ")).catch(e => String(e))); continue; }
    if (s.dump) { const f = phones[s.phone || main]; say("dump " + (s.phone || main) + ":\n" + (await f.evaluate(() => [...document.querySelectorAll("button,[role=button],input")].filter(e => e.getClientRects().length).map(e => e.tagName + " " + (e.className || "") + " " + [...e.attributes].filter(a => /^data-|aria-label|id|type/.test(a.name)).map(a => a.name + "=" + a.value).join(" ") + " | " + (e.textContent || "").trim().slice(0, 30)).join("\n")).catch(e => String(e)))); continue; }
    const end = Date.now() + (+s.within || 15000);   // keep trying until the key is there
    while (!await pressStep(phones, main, s) && Date.now() < end) await wait(300);
  }
}
async function play(phones, main, steps, ms, once) {
  const end = Date.now() + ms;
  if (steps && once) { for (const s of steps) { if (s.wait) await wait(+s.wait); else { await pressStep(phones, main, s); await wait(250); } } await wait(Math.max(0, end - Date.now())); return; }
  if (steps) {
    for (let i = 0; Date.now() < end; i = (i + 1) % steps.length) {
      const s = steps[i];
      if (s.wait) { await wait(Math.min(+s.wait || 0, end - Date.now())); continue; }
      if (s.host || s.rdump) { await remoteStep(s); await wait(250); continue; }
      const who = s.phone || main, f = phones[who]; if (!f || !s.tap) { await wait(100); continue; }   // a key not on that phone now is skipped at once, so one script covers every screen of the app
      if (who === main) { if (!await f.isVisible(s.tap).catch(() => false) || !await f.click(s.tap, { force: true, timeout: 1500 }).then(() => true, () => false)) { await wait(100); continue; } }
      else if (!await f.evaluate(PRESS_UNSEEN, s.tap).catch(() => false)) { await wait(100); continue; }
      PRESSED[who] = (PRESSED[who] || 0) + 1;   // the other Players' phones are not in the picture: pressed from inside their page
      await wait(250);
    }
    return;
  }
  const order = Object.keys(phones); let k = 0;
  while (Date.now() < end) {
    const who = Math.random() < 0.55 ? main : order[k++ % order.length];
    if (phones[who]) await tapRandom(phones[who], who === main, who);
    await wait(Math.min(700 + Math.random() * 700, Math.max(0, end - Date.now())));
  }
}

// the Host's own view while a clip plays: the real remote's sheet open (the live copy of the screen on top, the row of tiles under it), the app's action tiles tapped, then one setting chosen and sent, over and over
async function hostDrawer(rf, end, openOnly) {
  const ONLY = opt("--tiles") ? new RegExp(opt("--tiles"), "i").source : "";   // --tiles "^(Colour|Glow)": only the setting tiles whose name matches are used
  if (!rf) return;
  await rf.evaluate(() => { const g = document.querySelector(".g-grab"); if (g && /^Show/.test(g.getAttribute("aria-label") || "")) g.click(); }).catch(() => {}); await wait(900);
  if (openOnly) return;
  const SKIP = /^(Try as a player|Frame|Brightness|Effects|Schedule|Sound|Music)/;
  for (let i = 0; Date.now() < end - 900; i++) {
    const did = await rf.evaluate(([i, only]) => {
      const tiles = [...document.querySelectorAll(".g-tile")].filter(b => b.getClientRects().length && !b.disabled), acts = tiles.filter(b => b.classList.contains("sdk-act") && !/^(Pause|Stop|End|Skip|Reset|Restart|Clear|Delete|Leave|Cancel)/i.test(b.getAttribute("aria-label") || b.textContent)), sets = tiles.filter(b => !b.classList.contains("sdk-act") && !/^(Try as a player|Frame|Brightness|Effects|Schedule|Sound|Music)/.test(b.getAttribute("aria-label") || b.textContent) && (!only || new RegExp(only, "i").test(b.getAttribute("aria-label") || b.textContent)));
      const el = acts.length && (i % 2 === 0 || !sets.length) ? acts[Math.floor(i / 2) % acts.length] : sets[Math.floor(i / 2) % sets.length];
      if (!el) return ""; el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); el.click(); return el.classList.contains("sdk-act") ? "act" : "set";
    }, [i, ONLY]).catch(() => "");
    await wait(900);
    if (did === "set") {   // a setting panel: pick the next choice, send it, go back
      await rf.evaluate(i => { const on = document.querySelector("button.on"), c = on ? [...on.parentElement.querySelectorAll("button")].filter(b => b.getClientRects().length) : []; if (c.length) c[i % c.length].click(); }, i).catch(() => {});
      await wait(700);
      await rf.evaluate(() => { const s = [...document.querySelectorAll("button")].find(b => /^Send to /i.test(b.textContent) && b.offsetWidth > 0 && !b.disabled); if (s) s.click(); }).catch(() => {}); await wait(900);
      await rf.evaluate(() => { const b = document.querySelector(".g-back"); if (b && b.offsetWidth) b.click(); }).catch(() => {}); await wait(700);
    }
  }
}

// the simulator's own screen, frame by frame (Chrome's screencast, sharp JPEGs to a folder): only while a clip plays
function camera(p, cdp, tmp) {
  let cur = null, n = 0;
  cdp.on("Page.screencastFrame", f => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    if (!cur) return;
    const file = join(tmp, String(++n).padStart(6, "0") + ".jpg"); writeFileSync(file, Buffer.from(f.data, "base64"));
    cur.push({ file, t: f.metadata.timestamp || Date.now() / 1000 });
  });
  return {
    async start() { cur = []; await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 }); const end = Date.now() + 3000; while (!cur.length && Date.now() < end) await wait(30); return cur.length ? cur[0].t : Date.now() / 1000; },
    async stop() { const got = cur; await cdp.send("Page.stopScreencast").catch(() => {}); cur = null; return got || []; }
  };
}
// the simulator, bigger: the phones as tall as a clip, the stage at the top of the window (the page's own sizes otherwise)
const BIG = "(function(){if(window!==top||!/\\/devs\\/simulator\\//.test(location.pathname))return;var s=document.createElement('style');"
  + "s.textContent='.dv-wrap:has(.sim){max-width:none!important}.dv-head,.dv-foot{display:none!important}.sim-top{display:none!important}.sim-ph{display:none!important}';"
  + "document.addEventListener('DOMContentLoaded',function(){document.head.appendChild(s)});})();";

// the clips show the app's own picture, so the copy the simulator plays has no frame or mat (lamba.json "frame": "none"; the file on disk is not changed)
const noFrame = buf => { try { const m = JSON.parse(buf.toString("utf8")); m.frame = "none"; return Buffer.from(JSON.stringify(m)); } catch (e) { return buf; } };

// ---------- live mode: the real worker, the real screen page and the real Lamba remote (for apps the simulator cannot show yet, like a deck) ----------
//   node lamba-clips.mjs apps/my-app --live scenario.mjs --base http://127.0.0.1:8771 --name my-clip --caption "..." --seconds 10
// The worker is a local preview (wrangler dev). scenario.mjs exports default async rig => { ... await rig.record(async () => { ...what the clip shows... }) }.
// rig: wait(ms), host (the Host's remote: page, app() = the app's frame on it), players [{ name, page, app() }], tv (the screen page, tvApp() its app frame),
//      setting(obj), add({ name, ... }) a Player, shot(file) a picture of the stage, record(fn).
async function recordLive(dir, browser, tmp) {
  const BASE = (opt("--base") || "http://127.0.0.1:8771").replace(/\/$/, ""), TVBASE = BASE.replace("127.0.0.1", "localhost");
  process.env.BASE = BASE;
  const m = JSON.parse(readFileSync(join(dir, "lamba.json"), "utf8")), id = m.id || basename(dir);
  const R = await import(new URL("../tests/sdk-room.mjs", import.meta.url).href), { sock, rid, secret } = R;
  const scenario = (await import(resolve(opt("--live")))).default;
  const rm = rid(), key = secret(), code = secret(), nameOf = opt("--host") || "Alex Morgan";
  const tvs = sock("/link/" + rm + "?role=tv&key=" + key); await tvs.opened; await tvs.first("show");
  tvs.send({ t: "power", on: true }); tvs.send({ t: "setup", code }); await wait(150);
  const own = sock("/link/" + rm + "?role=phone&code=" + code + "&lamba=dev:alice&d=" + "d".repeat(22)), welcome = await own.first("welcome", 7000); const hostKey = welcome && welcome.key; if (process.env.CLIPS_DEBUG) say("welcome " + JSON.stringify(welcome).slice(0, 200));
  const setting = async v => { own.send({ t: "set", app: id, s: v }); await wait(500); };
  await setting({}); own.send({ t: "app", app: id }); await wait(300); tvs.ws.close();
  // two real pages, as a screen and a phone are: the screen (1600 x 900) and the Host's phone (390 x 844, twice as sharp), each recorded on its own and laid out together in cut()
  const PHONE = Object.assign({}, require("playwright").devices["iPhone 13"], { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [], tvCtx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }), tvPage = await tvCtx.newPage(), hostCtx = await browser.newContext(PHONE), p = await hostCtx.newPage();
  const tmpT = join(tmp, "t"), tmpP = join(tmp, "p"); mkdirSync(tmpT); mkdirSync(tmpP);
  const camT = camera(tvPage, await tvCtx.newCDPSession(tvPage), tmpT), camP = camera(p, await hostCtx.newCDPSession(p), tmpP);
  tvPage.on("pageerror", e => errors.push("screen: " + e.message)); p.on("pageerror", e => errors.push("host: " + e.message));
  await tvPage.goto(BASE + "/?tv=0"); await tvPage.evaluate(([i, k]) => { localStorage.clear(); localStorage.setItem("lf-screen", JSON.stringify({ id: i, key: k })); localStorage.setItem("lf-device", "tv"); localStorage.setItem("lf-paired", "1"); localStorage.setItem("lf-on", "1"); }, [rm, key]);
  await tvPage.goto(BASE + "/?tv=1"); await wait(3500);
  await tvPage.evaluate(() => { for (const i of ["fsHint", "tvmNote"]) { const h = document.getElementById(i); if (h) h.style.display = "none"; } document.documentElement.style.cursor = "none"; });
  await p.goto(BASE + "/remote/login");
  await p.evaluate(([i, k, n]) => { localStorage.setItem("lf-lamba", JSON.stringify({ token: "dev:alice", until: Date.now() + 36e5, user: { email: "alice@test.local", name: n } })); localStorage.setItem("lf-key-" + i, k); localStorage.setItem("lf-screens", JSON.stringify([{ id: i, name: "Living room" }])); localStorage.setItem("lf-current", i); }, [rm, hostKey, nameOf]);
  await p.goto(BASE + "/remote/?pair=" + rm + "&open=" + id); await wait(2500);
  const hostApp = () => p.frames().find(f => /\/remote\/app\?app=/.test(f.url())), tvApp = () => tvPage.frames().find(f => new RegExp(id + "/tv\\.html").test(f.url()));
  const players = [], moments = [];
  const rig = {
    page: p, tvPage, id, wait, own, setting, hostApp, tvApp, host: { page: p, app: hostApp }, players, errors,
    async until(fn, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await Promise.resolve().then(fn).catch(() => null); if (v) return v; await wait(150); } return null; },
    async add(name) {
      let v = null; for (let i = 0; i < 3 && !v; i++) { own.send({ t: "vinvite" }); v = await own.first("vinvite", 10000); }
      const c = await browser.newContext(PHONE), pg = await c.newPage();
      pg.on("pageerror", e => errors.push(name + ": " + e.message));
      await pg.goto(BASE + "/remote/login"); await pg.evaluate(nm => localStorage.setItem("lf-me", nm), name);
      await pg.goto(BASE + "/?visit=" + rm + "&inv=" + v.code);
      const b = pg.getByText("That's me"); if (await b.waitFor({ timeout: 6000 }).then(() => 1, () => 0)) await b.click().catch(() => {});
      const pl = { name, page: pg, app: () => pg.frames().find(f => /\/remote\/app\?app=/.test(f.url())) || pg.mainFrame() }; players.push(pl); return pl;
    },
    async shot(file, which) { await (which === "tv" ? tvPage : p).screenshot({ path: file }); },
    // one call = one moment of the play, which makes up to four clips at once: the screen, the Host's phone, a Player's phone (when rig.add made one) and the room together.
    // rig.record(fn) is the first moment (clips <id>-screen, -host, -player, -together); rig.record(fn, "later") the next (<id>-later-screen, ...). Six clips need two moments, or one and the settings.
    async record(fn, tag) {
      const pl = players[0], camQ = pl ? camera(pl.page, await pl.page.context().newCDPSession(pl.page), (mkdirSync(join(tmp, "q" + (moments.length)), { recursive: true }), join(tmp, "q" + moments.length))) : null;
      const t0 = await camT.start(), p0 = await camP.start(), q0 = camQ ? await camQ.start() : 0, from = Math.max(t0, p0, q0);
      await fn(); const rest = from + SECONDS + 0.5 - Date.now() / 1000; if (rest > 0) await wait(rest * 1000);
      const win = { from, to: Date.now() / 1000, frames: await camT.stop(), pframes: await camP.stop(), qframes: camQ ? await camQ.stop() : null, tv: { x: 0, y: 0, w: 1600, h: 900 }, ph: { x: 0, y: 0, w: 390, h: 844 }, tvScale: 1 };
      tag = tag || opt("--tag"); const kinds = (opt("--kinds") || "").split(",").filter(Boolean), keep = k => !kinds.length || kinds.includes(k);
      const pre = tag ? tag + "-" : "", cap = w => (tag ? tag.replace(/^./, c => c.toUpperCase()) + ": " : "") + CAPTION[w];
      if (keep("screen")) moments.push(Object.assign({}, win, { kind: "screen", name: pre + "screen", role: "screen", cap: cap("screen") }));
      if (keep("host")) moments.push(Object.assign({}, win, { kind: "phone", name: pre + "host", role: "host", cap: cap("host") }));
      if (win.qframes && keep("player")) moments.push(Object.assign({}, win, { kind: "phone", pframes: win.qframes, name: pre + "player", role: "player", cap: cap("player") }));
      if (keep("together")) moments.push(Object.assign({}, win, { kind: "play", name: pre + "together", role: "together", cap: cap("together") }));
    }
  };
  await scenario(rig);
  await tvCtx.close(); await hostCtx.close();
  if (!moments.length) throw new Error("the scenario never called rig.record");
  return { id, m, windows: moments, errors };
}
async function record(dir, base, browser, tmp) {
  const m = JSON.parse(readFileSync(join(dir, "lamba.json"), "utf8")), id = m.id || basename(dir);
  const pl = m.players || {}, guestsN = opt("--guests") ? Math.max(1, Math.min(5, +opt("--guests"))) : m.guests ? Math.max(1, Math.min(3, pl.max || 1, Math.max(2, pl.min || 1))) : 0;
  const who = (opt("--players") ? "&players=" + encodeURIComponent(opt("--players")) : "") + (opt("--host") ? "&host=" + encodeURIComponent(opt("--host")) : "");   // the people's names
  const sc0 = SCRIPT ? JSON.parse(readFileSync(resolve(SCRIPT), "utf8")) : null, steps = sc0 && !Array.isArray(sc0) ? sc0.steps : sc0, once = !!(sc0 && sc0.once), setupSteps = sc0 && sc0.setup;
  if (steps && (!Array.isArray(steps) || !steps.length)) throw new Error("--script: a list of steps, like [{ \"phone\": \"g1\", \"tap\": \"#go\" }, { \"wait\": 800 }]");
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1700 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(BIG);
  const p = await ctx.newPage(); PAGE = p; const cam = camera(p, await ctx.newCDPSession(p), tmp);
  const errors = []; p.on("pageerror", e => errors.push(e.message));
  await p.goto(base + "/devs/simulator/" + (guestsN ? "?guests=" + guestsN + "&join=skip" + who : ""));   // (join=skip: the Players are in the app at once, not on Lamba's join steps)
  await p.waitForSelector("#zipBtn", { timeout: 15000 });
  await p.setInputFiles("#zipInput", { name: id + ".zip", mimeType: "application/zip", buffer: zipOf(dir, id + "/", noFrame) });
  if (!await sealed(p, "tv", "screen", 15000)) throw new Error("the screen page never said hello: run node lamba-test.mjs " + basename(dir) + " and fix what it says first");
  const rigs = guestsN ? Array.from({ length: guestsN }, (x, i) => "g" + (i + 1)) : ["owner"], phones = {};
  for (const r of rigs) if (r !== "owner") phones[r] = await sealed(p, r, "guest", 10000);
  phones.owner = await sealed(p, "owner", ["controller", "preview"], guestsN ? 4000 : 10000) || phones.owner;   // (an app with no Players has no controller view of its own: the Host's phone shows its small picture and its tiles)
  const main = MAIN || rigs[0];

  if (!phones[main] && process.env.CLIPS_DEBUG) { for (const fr of p.frames()) say("frame " + fr.url().slice(0, 110) + " parent=" + (fr.parentFrame() ? fr.parentFrame().url().slice(0, 80) : "-") + " view=" + await fr.evaluate(() => window.Lamba && Lamba.screen && Lamba.screen.view).catch(() => "?")); }
  if (!phones[main]) throw new Error("the phone page never said hello on " + (guestsN ? "a Player's phone" : "the Host's phone"));
  const top = async () => { await p.evaluate(() => { const s = document.getElementById("stage"); if (s) scrollTo(0, s.getBoundingClientRect().top + scrollY); }); await wait(1500); };
  await showRig(p, main); await realSize(p); await top();
  await showRig(p, main); if (setupSteps) await setup(phones, main, setupSteps);
  const windows = [];
  // the parts of the room, each recorded for SECONDS in turn: [name, layout, whose phone is shown, role]
  // (the Host's own clip is recorded last, from its settings: that reloads the simulator)
  const SPECS = guestsN
    ? [["start", "play", "g1", "together"], ["screen", "screen", "g1", "screen"], ["player", "phone", "g1", "player"], ["together", "play", "g1", "together"], ["moment", "screen", "g1", "screen"]]
    : [["start", "play", "owner", "together"], ["screen", "screen", "owner", "screen"], ["together", "play", "owner", "together"], ["moment", "screen", "owner", "screen"], ["later", "screen", "owner", "screen"]];
  if (setupSteps) await setup(phones, SPECS[0][2], setupSteps);   // the lobby, the joining: out of the clips (setup runs once, before the first)
  const want = ONE ? ["together"] : (opt("--kinds") || "").split(",").filter(Boolean);
  for (const [name, layout, rig0, role] of SPECS) {
    if (want.length && !want.includes(name) && !(ONE && name === "together")) continue;
    const rig = MAIN === "owner" && layout === "play" ? "owner" : rig0;
    await showRig(p, rig); const tv = await box(p, "#tvScreen"), ph = await box(p, glass(rig));
    if (process.env.CLIPS_SHOT) say(name + ": showing " + await p.evaluate(() => { const s = document.querySelector("#who [aria-selected=true]"); return s && s.getAttribute("aria-label") + " | glass boxes " + [...document.querySelectorAll(".sim-phone")].map(x => x.dataset.rig + ":" + Math.round(x.getBoundingClientRect().height)).join(","); }));
    if (!tv || !ph) throw new Error("the simulator's screen or phone is not on screen");
    const from = await cam.start(), until = Date.now() + SECONDS * 1000 + 500;
    await Promise.all([play(phones, rig, steps, SECONDS * 1000 + 500, once), guestsN ? null : hostDrawer(rigFrame(p, "owner"), until, !!steps)]);   // (no Players: the Host's own tiles are what plays)
    if (process.env.CLIPS_SHOT) await p.screenshot({ path: process.env.CLIPS_SHOT + "-" + name + ".png" });
    windows.push({ kind: layout, name, role, from, to: Date.now() / 1000, frames: await cam.stop(), tv, ph });
  }
  // settings of its own: the Host's drawer open at the first setting with pictures to choose, each choice sent to the screen
  const fields = (m.settings || {}).fields || {}, pick = q => q && q.setting && ["choice", "switch", "colour"].includes((fields[q.setting] || {}).type);
  const g = ((m.settings || {}).groups || []).find(x => x && x.key && Array.isArray(x.parts) && x.parts.some(pick) && (!opt("--group") || x.key === opt("--group")));
  const wantHost = !ONE && (!want.length || want.includes("host") || want.includes("settings"));
  if (g && wantHost) {
    const part = g.parts.find(pick);
    await p.goto(base + "/devs/simulator/?app=local" + (guestsN ? "&guests=" + guestsN + "&join=skip" : "") + "&g=" + encodeURIComponent(g.key) + "&p=" + encodeURIComponent(part.setting));
    const host = await (async () => { const end = Date.now() + 10000; while (Date.now() < end) { const f = rigFrame(p, "owner"); if (f && await f.$(".ctl-strip button").catch(() => null)) return f; await wait(200); } return null; })();
    await sealed(p, "tv", "screen", 10000);
    for (const r of rigs) if (r !== "owner") phones[r] = await sealed(p, r, "guest", 6000);
    await showRig(p, "owner"); await realSize(p); await top();
    await showRig(p, "owner"); const tv = await box(p, "#tvScreen"), ph = await box(p, glass("owner"));
    if (setupSteps && (host && tv && ph)) await setup(phones, "g1" in phones ? "g1" : "owner", setupSteps);   // (the simulator started again: the lobby once more)
    if (host && tv && ph) {
      const n = await host.evaluate(() => document.querySelectorAll(".ctl-strip button").length).catch(() => 0), from = await cam.start(), end = Date.now() + SECONDS * 1000 + 500;
      const playing = steps ? play(phones, "g1" in phones ? "g1" : "owner", steps, SECONDS * 1000 + 500, once) : null;   // (the Players play on while the Host chooses)
      for (let i = 1; Date.now() < end && n; i++) {
        await host.evaluate(i => { const b = document.querySelectorAll(".ctl-strip button")[i]; if (b) { b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); b.click(); } }, i % n).catch(() => {});
        await wait(700);
        await host.evaluate(() => { const s = [...document.querySelectorAll("button")].find(b => /^Send to /i.test(b.textContent) && b.offsetWidth > 0 && !b.disabled); if (s) s.click(); }).catch(() => {});
        if (guestsN && !steps && phones[main]) await tapRandom(phones[main], false, main);   // (the Host's phone is the one in the picture here)
        await wait(Math.min(1500, Math.max(0, end - Date.now())));
      }
      await playing;
      windows.push({ kind: "phone", name: "host", role: "host", from, to: Date.now() / 1000, frames: await cam.stop(), tv, ph });
    }
  }
  else if (wantHost) {   // no setting with pictures to choose: the Host's phone as it is, its sheet open, its action tiles tapped
    await showRig(p, "owner"); const tv = await box(p, "#tvScreen"), ph = await box(p, glass("owner"));
    if (tv && ph) { const from = await cam.start(), until = Date.now() + SECONDS * 1000 + 500; await Promise.all([play(phones, "owner", steps, SECONDS * 1000 + 500, once), hostDrawer(rigFrame(p, "owner"), until)]); windows.push({ kind: "phone", name: "host", role: "host", from, to: Date.now() / 1000, frames: await cam.stop(), tv, ph }); }
  }
  await ctx.close();
  return { id, m, windows, errors };
}

// ---------- the clips: cut out, laid out at 540 x 920, H.264 ----------
const even = n => Math.max(2, Math.round(n / 2) * 2);
// a PNG made in the browser: the phone's rounded glass as a mask (white inside), and its soft shadow (black, blurred)
async function pngs(browser, pw, ph, tmp) {
  const pg = await browser.newPage();
  const r = Math.round(pw * 0.11), pad = 48, bz = 7;   // a phone's corner: 11% of its width, and a slim dark bezel (7 px) around the glass
  const out = await pg.evaluate(({ pw, ph, r, pad, bz }) => {
    const rr = (x, y, w, h, c) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    const m = document.createElement("canvas"); m.width = pw; m.height = ph; const mc = m.getContext("2d"); mc.fillStyle = "#000"; mc.fillRect(0, 0, pw, ph); mc.fillStyle = "#fff"; rr(0, 0, pw, ph, mc); mc.fill();
    const s = document.createElement("canvas"); s.width = pw + 2 * pad; s.height = ph + 2 * pad; const sc = s.getContext("2d"); sc.filter = "blur(16px)"; sc.fillStyle = "rgba(0,0,0,.55)"; rr(pad, pad, pw, ph, sc); sc.fill();
    const b = document.createElement("canvas"); b.width = pw + 2 * bz; b.height = ph + 2 * bz; const bc = b.getContext("2d");   // the bezel: a ring around the glass, #1a1a1e with a fine lighter outer edge
    const ring = (x, y, w, h, rad) => { bc.moveTo(x + rad, y); bc.arcTo(x + w, y, x + w, y + h, rad); bc.arcTo(x + w, y + h, x, y + h, rad); bc.arcTo(x, y + h, x, y, rad); bc.arcTo(x, y, x + w, y, rad); bc.closePath(); };
    bc.beginPath(); ring(0, 0, b.width, b.height, r + bz); ring(bz, bz, pw, ph, r); bc.fillStyle = "#1a1a1e"; bc.fill("evenodd");
    bc.beginPath(); ring(0.6, 0.6, b.width - 1.2, b.height - 1.2, r + bz - 0.6); bc.strokeStyle = "rgba(255,255,255,.22)"; bc.lineWidth = 1.2; bc.stroke();
    return { mask: m.toDataURL("image/png").split(",")[1], shadow: s.toDataURL("image/png").split(",")[1], bezel: b.toDataURL("image/png").split(",")[1] };
  }, { pw, ph, r, pad, bz });
  await pg.close();
  const mask = join(tmp, "mask-" + pw + "x" + ph + ".png"), shadow = join(tmp, "shadow-" + pw + "x" + ph + ".png"), bezel = join(tmp, "bezel-" + pw + "x" + ph + ".png");
  writeFileSync(mask, Buffer.from(out.mask, "base64")); writeFileSync(shadow, Buffer.from(out.shadow, "base64")); writeFileSync(bezel, Buffer.from(out.bezel, "base64"));
  return { mask, shadow, bezel, pad, bz };
}
// the ground: a soft gradient of the app's tint over the whole clip, and (first clip) the caption in the free area at the left
async function groundPng(browser, tint, caption, tmp, side) {
  const pg = await browser.newPage();
  const b64 = await pg.evaluate(({ W, H, tint, caption, side }) => {
    const mix = (hex, t, to) => { const n = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), m = to === "w" ? 255 : 0; return "rgb(" + n.map(c => Math.round(c + (m - c) * t)).join(",") + ")"; };
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, mix(tint, 0.16, "w")); g.addColorStop(1, mix(tint, 0.6, "b")); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = x.createRadialGradient(W * 0.2, H * 0.62, 10, W * 0.2, H * 0.62, W * 0.9); r.addColorStop(0, "rgba(255,255,255,.10)"); r.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = r; x.fillRect(0, 0, W, H);
    if (caption && side) {
      x.fillStyle = "#fff"; x.font = "650 25px system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"; x.textBaseline = "top";
      const words = caption.split(" "), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (x.measureText(t).width > side.w && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
      const lh = 31, y0 = side.y - (lines.length * lh) / 2; lines.forEach((l, i) => x.fillText(l, side.x, y0 + i * lh));
    }
    return c.toDataURL("image/png").split(",")[1];
  }, { W, H, tint, caption, side });
  await pg.close();
  const f = join(tmp, "ground-" + (caption ? "c" : "n") + ".png"); writeFileSync(f, Buffer.from(b64, "base64")); return f;
}
async function cut(browser, w, out, tmp, m) {
  // the frames as they came, each shown until the next one (ffmpeg's concat list)
  const concatOf = (frames, name) => {
    const fr = frames.filter(f => f.t >= w.from - 0.05).map((f, i) => i ? f : { file: f.file, t: Math.min(f.t, w.from) });   // (each picture shown until the next one; both pages start together)
    if (!fr.length) throw new Error("no picture was recorded");
    const list = join(tmp, name), L = [];
    fr.forEach((f, i) => { L.push("file '" + f.file.replace(/'/g, "'\\''") + "'"); L.push("duration " + Math.max(0.001, ((i + 1 < fr.length ? fr[i + 1].t : Math.max(w.to, f.t + 0.04)) - f.t)).toFixed(4)); });
    L.push("file '" + fr[fr.length - 1].file.replace(/'/g, "'\\''") + "'");
    writeFileSync(list, L.join("\n") + "\n"); return list;
  };
  const list = concatOf(w.frames, "list-" + w.kind + ".txt"), plist = w.pframes ? concatOf(w.pframes, "plist-" + w.kind + ".txt") : null, PV = plist ? "[5:v]" : "[0:v]";
  // exact boxes, no bezel and no page around them: the phone is 390 x 844 (its own glass), the screen is its picture
  const crop = (b, e = 1) => "crop=" + (Math.floor(b.w) - 2 * e) + ":" + (Math.floor(b.h) - 2 * e) + ":" + (Math.ceil(b.x) + e) + ":" + (Math.ceil(b.y) + e);   // inside the box: one pixel for the phone, 4 for the screen (its corners are rounded 12 px, and the page shows white behind a rounded corner)
  const tint = /^#[0-9a-fA-F]{6}$/.test((m || {}).tint || "") ? m.tint : "#3a3d48";
  let pw, ph, x, y, base, ground, only = null;
  const capOf = w.cap || (ONECAP && w.kind === "play" ? ONECAP : CAPTION[w.name || w.kind]) || "";
  if (w.kind === "screen") {   // the screen on its own: the WHOLE picture (16:9, never cropped) edge to edge, in the middle of the clip, its words under it
    const th = even(W * 9 / 16), y0 = Math.round((H - th) / 2) - 36; pw = 250; ph = even(pw * w.ph.h / w.ph.w);
    ground = await groundPng(browser, tint, "", tmp, null);   // no words in the picture: the app page shows the caption above each clip (said once)
    only = "[0:v]fps=" + FPS + "," + crop(w.tv, 4) + ",scale=" + W + ":" + th + ":flags=lanczos,setsar=1,format=yuv420p[sc];[3:v][sc]overlay=0:" + y0 + ",format=yuv420p[v]";
  } else if (w.kind === "phone") {   // the phone, big, centred on the tint's soft gradient
    ph = even(H - 2 * 28); pw = even(ph * w.ph.w / w.ph.h); x = (W - pw) / 2; y = 28;
    ground = await groundPng(browser, tint, "", tmp, null);
    base = "[3:v]null[base]";
  } else {   // the WHOLE screen picture (16:9, never cropped) edge to edge across the top; the phone at a natural size over its lower right by a fifth of its height, clear of the centre
    const th = even(W * 9 / 16);
    pw = 250; ph = even(pw * w.ph.h / w.ph.w); x = W - pw - 12; y = w.pframes ? th + 22 : th - Math.round(ph * 0.2);   // (a live recording keeps the whole phone clear of the screen)
    ground = await groundPng(browser, tint, "", tmp, null);   // no words in the picture (the page shows the caption)
    base = "[0:v]fps=" + FPS + "," + crop(w.tv, 4) + ",scale=" + W + ":" + th + ":flags=lanczos,setsar=1,format=yuv420p[sc];[3:v][sc]overlay=0:0[base]";
  }
  const g = await pngs(browser, pw, ph, tmp), pad = g.pad;
  const filter = only || base + ";" + PV + "fps=" + FPS + "," + crop(w.ph) + ",scale=" + pw + ":" + ph + ":flags=lanczos,setsar=1,format=yuva420p[p0];"
    + "[1:v]scale=" + pw + ":" + ph + ",format=gray[m];[p0][m]alphamerge[phone];"
    + "[base][2:v]overlay=" + (x - pad) + ":" + (y - pad + 12) + ":format=auto[b2];[b2][phone]overlay=" + x + ":" + y + ":format=auto[b3];[b3][4:v]overlay=" + (x - g.bz) + ":" + (y - g.bz) + ":format=auto,format=yuv420p[v]";
  execFileSync(FF, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-loop", "1", "-framerate", String(FPS), "-i", g.mask, "-loop", "1", "-framerate", String(FPS), "-i", g.shadow,
    "-loop", "1", "-framerate", String(FPS), "-i", ground, "-loop", "1", "-framerate", String(FPS), "-i", g.bezel,
    ...(plist ? ["-f", "concat", "-safe", "0", "-i", plist] : []), "-filter_complex", filter, "-map", "[v]", "-t", String(SECONDS), "-r", String(FPS),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "slow", "-an", "-movflags", "+faststart", out]);
}
// the poster: the clip's first frame, as webp (Chromium writes it)
async function poster(browser, mp4, out) {
  const png = out + ".png";
  execFileSync(FF, ["-y", "-loglevel", "error", "-i", mp4, "-frames:v", "1", png]);
  const pg = await browser.newPage();
  const b64 = await pg.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; c.getContext("2d").drawImage(i, 0, 0); return c.toDataURL("image/webp", 0.82).split(",")[1]; }, "data:image/png;base64," + readFileSync(png).toString("base64"));
  await pg.close(); unlinkSync(png);
  writeFileSync(out, Buffer.from(b64, "base64"));
}
const CAPTION = { start: "How the room starts", screen: "The screen, full frame", host: "The Host's phone", player: "A Player's phone", together: "The room together: screen and phone", moment: "A later moment of the same play", later: "Later still", peak: "The best moment", late: "The Host's phone, a little later", settings: "Settings, live on the screen", play: "The room together", phone: "On a phone" };
const ROLE_OF = { start: "together", screen: "screen", host: "host", player: "player", together: "together", moment: "screen", later: "screen", peak: "screen", late: "host", settings: "host", play: "together", phone: "player" };

// lamba.json's "clips", changed in place (the rest of the file as it was)
function listClips(dir, clips) {
  const f = join(dir, "lamba.json"), t = readFileSync(f, "utf8"), line = JSON.stringify(clips).replace(/","/g, "\", \"").replace(/\],\[/g, "], [");
  const i = t.search(/"clips"\s*:\s*\[/);
  if (i < 0) { writeFileSync(f, t.replace(/\n?\}\s*$/, ",\n \"clips\": " + line + "\n}\n")); return; }
  let j = t.indexOf("[", i), d = 0, s = false;
  for (; j < t.length; j++) { const c = t[j]; if (s) { if (c === "\\") j++; else if (c === '"') s = false; continue; } if (c === '"') s = true; else if (c === "[") d++; else if (c === "]" && --d === 0) break; }
  writeFileSync(f, t.slice(0, t.indexOf("[", i)) + line + t.slice(j + 1));
}

// ---------- the command ----------
let dirs = named.map(a => resolve(a));
if (!dirs.length) {
  const here = process.cwd();
  dirs = existsSync(join(here, "lamba.json")) ? [here] : readdirSync(here).filter(n => !SKIP(n) && existsSync(join(here, n, "lamba.json"))).map(n => join(here, n));
  if (dirs.length !== 1) { say("lamba clips: name your app's folder: node lamba-clips.mjs my-app"); process.exit(2); }
}
const dir = dirs[0];
if (!existsSync(join(dir, "lamba.json"))) { say("lamba clips: " + dir + " has no lamba.json (choose your app's own folder)"); process.exit(2); }
const tmp = mkdtempSync(join(tmpdir(), "lamba-clips-"));
const server = await serve(), base = "http://127.0.0.1:" + server.address().port;
let browser;
try { browser = await chromium.launch({ headless: !HEADED, args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"], ...(opt("--live") ? { channel: "chrome", args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights"] } : {}) }); }
catch (e) { say("lamba clips: Chromium is not installed for Playwright. Run: npx playwright install chromium"); server.close(); process.exit(2); }
let R;
try { say("lamba clips: recording " + basename(dir) + (opt("--live") ? " live" : " in the simulator (about " + Math.round(SECONDS * 3 + 15) + " s)")); R = opt("--live") ? await recordLive(dir, browser, tmp) : await record(dir, base, browser, tmp); }
catch (e) { say("lamba clips: stopped: " + (e && e.message ? e.message.split("\n")[0] : e)); await browser.close(); server.close(); rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
mkdirSync(join(dir, "clips"), { recursive: true });
const made = [];
try {
  for (const w of R.windows) {
    const name = ONE || R.id + "-" + (w.name || w.kind), mp4 = join(dir, "clips", name + ".mp4"), webp = join(dir, "clips", name + "-poster.webp");
    await cut(browser, w, mp4, tmp, R.m); await poster(browser, mp4, webp);
    made.push({ name, mp4, webp, caption: ONECAP || w.cap || CAPTION[w.name || w.kind], role: w.role || ROLE_OF[w.name || w.kind] });
  }
} catch (e) { say("lamba clips: making the clips stopped: " + String(e && (e.stderr && String(e.stderr).trim().split("\n").pop() || e.message) || e).split("\n")[0]); }
await browser.close(); server.close(); rmSync(tmp, { recursive: true, force: true });
if (ONE) { for (const x of made) say("wrote " + x.mp4); process.exit(0); }
if (made.length < (opt("--kinds") ? 1 : 3)) { say("lamba clips: fewer than " + (opt("--kinds") ? 1 : 3) + " clips were made, so lamba.json is as it was. Run it again, or with --headed to watch."); process.exit(1); }
// the starter's placeholders out (Lamba refuses an upload with them), and the clips listed before that are not these kept after them
const sha = f => createHash("sha256").update(readFileSync(f)).digest("hex"), removed = [];
for (const n of readdirSync(join(dir, "clips"))) { const f = join(dir, "clips", n); if (statSync(f).isFile() && PLACEHOLDERS.includes(sha(f))) { unlinkSync(f); removed.push("clips/" + n); } }
const kept = (Array.isArray(R.m.clips) ? R.m.clips : []).filter(c => Array.isArray(c) && !made.some(x => x.name === c[0]) && existsSync(join(dir, "clips", c[0] + ".mp4")) && existsSync(join(dir, "clips", c[0] + "-poster.webp")));
listClips(dir, made.map(x => [x.name, x.caption, x.role]).concat(kept));
say("\nWritten in " + relative(process.cwd(), join(dir, "clips")) + ", each 540 x 920, H.264, " + SECONDS + " s:");
for (const x of made) say("  " + relative(process.cwd(), x.mp4) + " (" + Math.round(statSync(x.mp4).size / 1024) + " KB) and " + basename(x.webp));
if (removed.length) say("Removed the starter's placeholders: " + removed.join(", "));
if (kept.length) say("Kept your own clips after these: " + kept.map(c => c[0]).join(", "));
{ const k = Object.keys(PRESSED).sort(); say("Presses while recording: " + (k.length ? k.map(x => (x === "owner" ? "the Host " : "Player " + x.slice(1) + " ") + PRESSED[x]).join(", ") : "none (check the selectors in --script)")); }
if (R.errors.length) say("Errors in a page while recording (run node lamba-test.mjs): " + [...new Set(R.errors)].slice(0, 3).join(" | "));
if (made.length + kept.length < 6) say("Lamba wants 6 clips or more (the screen, the Host's phone, a Player's phone, the room together, and two more moments): record the rest, for instance with --name and --caption, or run it again without --kinds.");
say("Next: look at each -poster.webp, and write captions in lamba.json \"clips\" that say what each clip shows (60 letters at most).");
