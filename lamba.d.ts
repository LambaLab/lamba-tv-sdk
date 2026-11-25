// Types for window.Lamba, the SDK every Lamba app page loads (shell/sdk/lamba.js, vocabulary v1):
//   <script src="../../shell/sdk/lamba.js"></script>
// For editors and AI coding agents only: Lamba apps are plain JavaScript with no build step (the screen page must run on Chrome 61, so ES5: no
// ?. or ??). Reference it from a script with:  /// <reference path="lamba.d.ts" />
// The docs: https://lamba.tv/devs/docs/sdk/ . tests/sdk-schema.test.mjs checks that every part of window.Lamba is here.

/** Which copy of a page this is (https://lamba.tv/devs/docs/how-it-works/). */
type View = "screen" | "preview" | "picture" | "part" | "guest";
/** The Host's tap on one of the app's action tiles (lamba.json actions), heard by the screen page: Lamba.on("action", fn). */
interface LambaAction { type: "action"; key: string }
/** Who holds this copy: the big screen, the owner's phone, or a guest's phone. */
type Role = "tv" | "owner" | "guest";
/** Where a message from the screen goes: every phone ("" or "all"), the owner's phones, every guest, or one player ("v0"). */
/** "guests": every seated guest (players and visitors); "players": players only; "visitors": visitors only; "v3": one of them. */
type To = "" | "all" | "phones" | "guests" | "players" | "visitors" | string;
/** One setting's value: a choice id, a switch, a number, text, a list of ids, or a colour "#rrggbb". */
type SettingValue = string | number | boolean | string[] | { [id: string]: { x: number; y: number; s: number; r: number } } | { tubes: { c: number; p: number[]; z: 0 | 1 }[]; names: string[] };
type Permission = "sound" | "camera" | "motion" | "country" | "microphone" | "video" | "ink" | "desktop";
type PermissionState = "granted" | "prompt" | "denied";

interface LambaScreen {
  /** "tv", "web" (a page on a computer) or "phone". */
  kind: "tv" | "web" | "phone" | "";
  view: View | "";
  /** The frame's size in CSS pixels. */
  w: number;
  h: number;
  /** True on the copy of the screen on the owner's phone (and on a computer Player's, beside their page). */
  preview: boolean;
  /** A Player's or Host's page: "phone" or "computer", what the person holds. */
  device?: "phone" | "computer";
  /** A computer's page: true while the screen's live copy sits beside the page (a wide window); false in a narrow one, which has the phone's layout. */
  mirror?: boolean;
  /** In view "part": which part of the settings drawer to draw (lamba.json { "app": "<part>" }). */
  part?: string;
  /** In view "picture": draw this setting's choice, small. */
  picture?: { setting: string; value: SettingValue; group: string; w: number; h: number };
  /** On phones: the device's own size. */
  room?: { w: number; h: number };
  /** The screen page: the screen's own name as the Host gave it ("Living room"), "" when it has none. */
  name?: string;
}

interface LambaTheme {
  colours: { ink?: string; sub?: string; panel?: string; tile?: string; track?: string; line?: string; accent?: string; good?: string; warn?: string; bad?: string; [k: string]: string | undefined };
  fonts: { ui?: string; [k: string]: string | undefined };
}

/** A Player is one PERSON: on a phone and a laptop they are one entry. id: their first device's id (messages from any of their devices come from it); person: the same id on every device and every list; devices and kinds: how many (up to 3) and what ("phone" | "computer"). */
interface LambaPlayer { id: string; name: string; person: string; devices: number; kinds: Array<"phone" | "computer">; /** true while the Player cannot play: their page is hidden for over 2 s (phone locked, another app) on every device they have, or their link dropped. Absent when they are here. Pause the game and say who it waits for. */ away?: boolean;
  /** This Player's own settings (groups with "players": "own" in lamba.json): the default until they, or Lamba.setOwn, choose. Only for an app that has such a group. */
  own?: Record<string, unknown> }
/** A device of a Player joined or left (Lamba.onDevice). */
interface LambaDevice { id: string; person: string; kind: "phone" | "computer"; on: boolean }

interface LambaStatus {
  connected: boolean;
  linked?: boolean;
  /** Is this app on the screen now? Show a calm "not on the screen" with a Show on screen button when false. */
  onScreen: boolean;
  power: boolean | null;
  tv: boolean | null;
  tvAddress?: string;
  /** This phone has no screen yet: show the app as it would be, and Lamba.show() asks to connect a screen. */
  noTv?: boolean;
}

/** A message between the screen and the phones: { type: "word", ... }, at most 4 KB of JSON; a type never starts with "lamba". */
interface LambaMessage { type: string; [k: string]: unknown }

interface LambaStore {
  /** A copy of the value, or undefined. */
  get(k: string): any;
  /** Save it (the screen and the owner's phones; never guests). set(k) with no value removes it. Keys: letters, digits, _ and -, at most 40; a value at most 4 KB; 16 KB and 32 keys in all. */
  set(k: string, v?: unknown): LambaSDK;
  /** A copy of everything. */
  all(): { [k: string]: any };
  /** fn(k, v) when a value changed elsewhere (v undefined: removed). */
  on(fn: (k: string, v: any) => void): LambaSDK;
}

interface LambaSound {
  /** True once sound may play (a remote's button on a screen, a tap on a phone). */
  unlocked: boolean;
  /** One Web Audio context for the page, woken whenever sound may play. Never an <audio> element on a screen page. */
  context(): AudioContext | null;
  /** Make the context if there is none and wake it now, inside a tap of your own (Lamba already does this on every tap, click and remote press). */
  unlock(): LambaSDK;
  /** fn() when sound becomes allowed, or at once if it already is. */
  onUnlock(fn: () => void): LambaSDK;
}

/** Where an Air Touch app's camera is: "host-phone" the Host's own phone (the default); "device" a room camera device, a spare phone or a laptop with any webcam left in place (coming next); "screen" the screen's own camera (coming next); "home" a Home Assistant camera the Host allowed for this app on this screen. */
type LambaCameraSourceKind = "host-phone" | "device" | "screen" | "home";
/** The camera source the Host picked (lamba.json "cameraSource": true, docs/sdk/SENSORS.md "Camera sources"). where "phone": the frames are on a phone, tracked there, fingertips streamed, the picture through Lamba.video as always; where "screen": the frames are on the screen, which shows it with Lamba.camera.show (and tracks it there, coming next). */
interface LambaCameraSource { /** true once the room has said which camera the Host picked (before that `source` is the default, not their pick) */ known?: boolean; /** true once someone picked the source (a home camera, or the phone with Lamba.camera.use("host-phone")); false = the default: never start the phone camera yet */ chosen?: boolean; source: LambaCameraSourceKind; where: "phone" | "screen"; /** a home camera: Home Assistant's entity id ("camera.porch") */ id?: string; /** what the Host calls it ("Porch"), or "" */ name?: string; }
/** The picture of a "screen" source on the screen page: drawn by Lamba under your page, never in it. */
interface LambaCameraShow {
  /** "starting" (connecting), "live" (frames come), "stopped" (stop(), or the Host moved to a phone source), "error" (see why) */
  state: "starting" | "live" | "paused" | "stopped" | "error";   // "paused": the Host's phone page is hidden (an app switch) and Lamba is keeping the link for up to 60 s. Back within that, the picture is there at once with no new offer; after it, or if the link died, state goes "starting" again with the last picture shown dimmed under Lamba's loader. The page does nothing on hide for it.
  /** with "error": "camera" (Home Assistant answered but the camera did not stream: Lamba says "isn't answering at home") | "ha" (Home Assistant itself is unreachable) | "network" (no direct link and the relay failed; "away" is the same) | "not allowed" | "not connected" | "busy" | "none" (no WebRTC here) | "not yet" (a source still to come) | "away" (neither direct nor Lamba's relay reached it: a phone away from home) */
  why: string;
  /** the picture's own size in pixels once live (its shape: w / h), 0 before */
  w: number; h: number;
  /** while "starting": the real step reached, 1 finding the camera, 2 connecting, 3 waiting for the first picture (of `steps`); Lamba draws the loader itself, so your page draws nothing over it and shows its own marks only when state is "live" */
  step: number; steps: number;
  on(ev: "state", fn: (s: LambaCameraShow) => void): LambaCameraShow;
  /** with `show(el, { zoom: true })`: the view changed (a finger, the scrub or `zoom()`), including on the screen when the Host's phone zoomed */
  on(ev: "zoom", fn: (z: { z: number; cx: number; cy: number }) => void): LambaCameraShow;
  /** Digital zoom (a home camera has no optical zoom): z from 1 to 3 round the view's middle (cx, cy, fractions of the picture), clamped so the view never shows outside the picture. Lamba draws it (a transform in its own box, about 120 ms, the main stream), remembers it per camera for the session and shows 1x after a camera switch. With `{ zoom: true }` on the phone and the screen page, the screen shows the same view. Draw your rings through it: `AirSpots.view` in Home Touch's spots.js, and shell/sdk/zoomscrub.js for the scrub, pinch and double tap. */
  zoom(z: number, cx?: number, cy?: number): { z: number; cx: number; cy: number };
  zoomState(): { z: number; cx: number; cy: number };
  /** the hands found in the picture, as tracking frames (the format of docs/TRACKING.md, `hands[].points`, x and y 0 to 1 of the picture, never mirrored) */
  on(ev: "hands", fn: (f: { aspect: number; mirror: boolean; hands: { points: { x: number; y: number }[] }[] }) => void): LambaCameraShow;
  /** the Host's own hand, cut out of their phone's camera picture, now shows over this camera on the screen (Lamba draws it in its own layer: your page never gets a pixel). Keep your drawn ghost hand until it does, and draw it again when it says false (the picture has not arrived yet, the link failed, hand mode stopped, or this screen cannot decode it). Needs `share: "screen"` on the phone's Lamba.track.preview. */
  on(ev: "handvideo", fn: (on: boolean) => void): LambaCameraShow;
  /** true while that cutout shows */
  handVideo: boolean;
  /** turn the hands in the picture on or off (the Host's phone: on only while the screen cannot be reached) */
  hands(on: boolean): LambaCameraShow;
  /** tell Lamba the element moved or changed shape (it follows the window by itself): the picture and its loader sit exactly on el */
  place(el?: Element, o?: { fit?: "contain" | "cover" }): void;
  stop(): void;
}
/** The camera source of an Air Touch app (lamba.json "cameraSource": true). One concept, four sources; your app follows `source`. */
interface LambaCamera {
  /** The screen and the Host's phone: the source now ({ source: "host-phone", where: "phone" } until the Host picks another). */
  source: LambaCameraSource;
  /** Hears the source each time the room says it: the Host picks one (the same one again after a failure too) or the screen comes back. Compare with what you show and start again only when needed. Returns the way to stop listening. */
  onSource(fn: (s: LambaCameraSource) => void): () => void;
  /** The Host's phone page only: Lamba's own sheet of the sources (this phone, home cameras the Host allows there). Resolves with the source after. */
  /** o.keep: an element the sheet never covers (see Lamba.home.controls). */
  choose(o?: { keep?: HTMLElement; onKeep?(shift: number): void }): Promise<LambaCameraSource>;
  /** The screen page, or the Host's own phone view (to mark things on the picture; never a Player's page), for a source whose where is "screen": Lamba draws the live picture UNDER your page over el's box (null: the whole page; keep your page transparent there) with Lamba's own "Camera on", always visible while it streams. fit "contain" (default) shows the whole picture, "cover" fills the box. Your page never gets a pixel. */
  /** hands: true also finds hands IN the picture (a person in the room reaching for something): landmarks only, hands only, about 14 a second, on this page, never a pixel to your page; hear them with `on("hands")`. On the Host's phone turn it on only when the screen cannot be reached (`session.hands(true)`). */
  /** The real cause of a camera failure in plain words (Lamba draws these itself in the picture's box; use them for your own small tile). */
  words(why: string, name?: string): { line: string; sub: string };
  show(el: Element | null, o?: { fit?: "contain" | "cover"; hands?: boolean; /** the picture can be zoomed (1 to 3) and the screen follows the Host phone */ zoom?: boolean; /** a tile of a layout of several cameras: this home camera's own picture (an id of `sources()`), never the source; at most 4 at once; no hands */ id?: string; /** with `id`: the camera's small stream when it has one (a quarter of the memory on a phone) */ small?: boolean }): LambaCameraShow;
  /** The screen and the Host's phone view (a Player gets []): the home cameras the Host allowed for this app on this screen, at most 4, names only (never an address). Empty until the Host allowed one (`add()`). Call again when `onSources` fires. Resolves the allowed cameras: an empty list always means none are allowed. REJECTS when the list could not be read (the room did not answer), so never treat a rejection as "no cameras" (do not clear anything for it). */
  /** The Host's phone: whether the picked home camera can turn. */
  canTurn(): Promise<boolean>;
  /** The Host's phone: one small step of the camera (pan left or right, tilt up or down), the same step a drag sends; ONE step at a time (a second or two): a step asked while one runs is dropped, so send the next after onTurn says it settled. With no amt it is a small step of about 15 degrees (0.08 across, 0.06 up and down). The first step of a camera also finds out whether it turns the wrong way (a small grayscale compare of the picture before and after; only numbers) and the room flips that axis for that camera from then on. */
  nudge(o: { pan?: "left" | "right"; tilt?: "up" | "down"; amt?: number }): boolean;
  /** ONE move toward where a finger or a hand went: fx, fy are signed fractions of the picture's width and height, and the VIEW LOOKS THE WAY THEY WENT (right = the camera looks right in the room). 1.2 times the fraction, never more than cap (default 0.25, 0.05 to 0.8). true when a move was sent. */
  look(fx: number, fy: number, o?: { cap?: number }): boolean;
  /** The camera stops turning now (the Host's phone; ONVIF Stop). The page drops whatever it had queued. */
  stop(): void;
  drag(fx: number, fy: number): boolean;
  /** Spots that follow the picture (the Host's phone, a home camera that can turn). A spot is where its THING is now, not an x and y that stays at one place on the screen when the camera turns.
   *  Lamba reads the picture in its own host (never given to the page), finds each spot again by what it looks like, and tells you where it is, or that it is out of view. */
  anchors: {
    /** The spots to follow. x and y are thousandths of the picture (where the spot is). now: true when the Host just placed or moved it, so Lamba learns what it looks like from the picture in view
     *  now; any other spot is learned the next time the picture is live, if the camera has not turned since the page began. follow([]) stops following and forgets nothing.
     *  What a spot looks like never reaches the page: Lamba keeps it. */
    follow(list: { id: string; x: number; y: number; now?: boolean }[]): void;
    /** The Host removed these spots: what Lamba learned about them goes. The only way it goes (a short or empty follow() list never does). */
    /** The Host dragged a followed spot to x, y (thousandths of the picture as it is seen now). Lamba keeps its place in the scene from the picture in view right now, so it keeps following the room after a turn and a reload. */
    move(id: string, x: number, y: number): void;
    forget(ids: string[]): void;
    /** "spots": about twice a second, and at once after a turn settles. here false means out of view: draw nothing (edge: the side it left by). */
    on(ev: "spots", fn: (list: { id: string; x: number; y: number; score: number; here: boolean; edge: "" | "left" | "right" | "top" | "bottom" }[]) => void): () => void;
    /** "turn": a step of the camera started, or the camera has been still for 1.4 s (settled). pan and tilt are the step's direction. */
    on(ev: "turn", fn: (t: { state: "start" | "settled"; pan: "" | "left" | "right"; tilt: "" | "up" | "down" }) => void): () => void;
  };
  sources(): Promise<{ id: string; name: string; area: string; ptz: boolean }[]>;
  /** The Host's phone: ids you saved earlier that are another stream of one of the listed cameras -> the camera's own id (only those; Lamba keeps the grouping itself). */
  canon(ids: string[]): Promise<Record<string, string>>;
  /** Hears the allowed cameras change (the same list `sources()` gives). Returns the way to stop listening. */
  onSources(fn: (list: { id: string; name: string; area: string; ptz: boolean }[]) => void): () => void;
  /** The Host's phone page only: one of the allowed home cameras becomes the camera of the app (the source), with no sheet (the Host tapped its tile); "host-phone" makes this phone the source. Resolves with the source then: check `id`. */
  use(id: string): Promise<LambaCameraSource>;
  /** The Host's phone page only: Lamba's own camera picker straight away, to allow another home camera (at most 4 in all). The source stays as it is. Resolves with the allowed cameras then. */
  add(): Promise<{ id: string; name: string; area: string; ptz: boolean }[]>;
  /** The Host's phone view of a home camera that can turn (an ONVIF camera): a one finger drag on `el` turns and tilts it (the picture follows the finger), at most about 4 a second, Host only. `o.when()` returns false while your app uses the finger itself (marking or moving a spot). The first time only Lamba shows a small hint in `el`. Anywhere else, or for a camera that cannot turn, it does nothing. */
  turn(el: Element, o?: { when?: () => boolean; onSwipe?: (fx: number, fy: number, o: { cap: number }) => void }): { stop(): void };
}
/** One thing in the Host's home that Lamba Home can switch (lamba.json "home": true). `id` is Home Assistant's entity_id ("light.desk_lamp"). Never a lock, an alarm or a camera. */
interface LambaHomeDevice {
  id: string;
  /** A light that can dim (more than on and off): the Brighter and Dimmer keys apply. */
  dim?: boolean;
  /** What the Host calls it in Home Assistant, at most 40 characters. */
  name: string;
  kind: "light" | "switch" | "fan" | "cover" | "media" | "tv" | "climate";
  /** On now (a cover: open; a speaker: playing; a screen: not off, standby, unavailable or unknown; heating: not off). */
  on: boolean;
  /** The room it is in, or "". */
  area: string;
}
/** Why a Lamba.home call failed: the rejected Error also has `.error` with one of these. */
type LambaHomeError = "not connected" | "not allowed" | "unreachable" | "busy" | "unavailable";
/** The Host's smart home, connected once by the Host in Lamba (Home Assistant). Declare "home": true in lamba.json (docs/sdk/HOME.md). The app never sees an address or a token. */
interface LambaHome {
  /** Is a home connected? Always { connected: false } on a Player's page. */
  ready(): Promise<{ connected: boolean; system: "home-assistant" | null }>;
  /** The Host's phone page only: opens Lamba's own Home Assistant page (address, Connect, Disconnect). The Host comes back with Back. Show it when ready() says not connected. */
  connect(): Promise<void>;
  /** The devices the Host already allowed for this app, with their state: never the whole house. */
  devices(): Promise<LambaHomeDevice[]>;
  /** The Host's phone page only: Lamba opens its own picker, the Host ticks the devices this app may switch from the screen (up to `max`, at most 24, kept with the app's settings for this screen) and it resolves with the devices chosen. Only the Host's tick allows a device: an app cannot allow one itself. Resolves with the devices as before when the Host cancels. */
  choose(o?: { max?: number; keep?: HTMLElement; onKeep?(shift: number): void }): Promise<LambaHomeDevice[]>;
  /** The Host's phone page, staging only for now: one key to the remote of a screen (a media player with a paired Android TV remote, the same device): up, down, left, right, ok, back or home. The room sends the key code itself, never one the page names, and allows 10 a second (the air remote sends at most 4). Rejects "not allowed" for another id or key, "busy" when too fast. */
  key(id: string, key: "up" | "down" | "left" | "right" | "ok" | "back" | "home"): Promise<void>;
  /** The Host's phone page, staging only for now: the volume of a screen or speaker: up, down or mute (a toggle). */
  volume(id: string, dir: "up" | "down" | "mute"): Promise<void>;
  /** The Host's phone page, staging only for now: one step (a fifth) brighter or dimmer for a light that can dim (a device with dim: true). */
  dim(id: string, dir: "up" | "down"): Promise<void>;
  /** The Host's phone page only (o.rows: the app's own quiet rows at the foot of the sheet, below a divider, at most 4: text rows with a small icon, never a second big button; a tap closes the sheet and runs on(); a `danger` row such as Remove comes last, apart from the rest, and Lamba asks "Remove?" first, with one Remove button and a quiet Cancel). Lamba opens its own controls for one allowed device, a bottom sheet that drags down (a screen: trackpad, Back, Home, volume, mute, power; a speaker: play, volume; a light: on and off, brightness; the rest: on and off). Resolves when the Host closes it. Rejects with "not allowed" for another id. Live by nature: an action, never a setting that waits for Send. */
  controls(id: string, o?: { /** an element the sheet must never cover (the camera picture the person watches while they press keys): the sheet is never taller than the page below it; when that leaves under about 260 px Lamba asks the page to move it up (onKeep(shift), default: the page scrolls by shift) */ keep?: HTMLElement; onKeep?(shift: number): void; rows?: Array<{ label: string; icon?: "move" | "trash" | "edit" | "info"; danger?: boolean; on(): void }> }): Promise<void>;
  /** The screen page or the Host's phone: switch an allowed device on or off. Rejects with "not allowed" for any other id. At most 4 a second for each screen. */
  set(id: string, on: boolean): Promise<{ on: boolean }>;
  /** The screen page or the Host's phone: switch an allowed device to the opposite of how it is now. */
  /** via: "air": this switch comes from a HAND (a held fingertip): the room drops the same device switched again within 1.5 s from any source of the room (`error: "same"`: ignore it quietly), so two sides that both saw one hold never switch it twice. A plain tap in your app is never held back. */
  toggle(id: string, o?: { via?: "air" }): Promise<{ on: boolean }>;
  /** The allowed devices' state, pushed when they change (about every 2 seconds while listening, and at once after a switch). Returns the way to stop. */
  state(fn: (devices: LambaHomeDevice[]) => void): () => void;
  /** The Host's phone page only, with find.js and shape.js loaded: lights find themselves. Lamba blinks each light once (a card first: "Lamba will blink each light once to find it" and one button), watches the camera picture and gives back where each one is. Always puts every light back. The promise has `.cancel()`. */
  findLights(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | (() => Promise<{ url: string; w: number; h: number; mirror?: boolean }>), o?: LambaFindOptions): Promise<LambaFindResult> & { cancel(): Promise<LambaFindResult> };
}
/** A spot found by blinking: x, y, r (thousandths of the picture, as a spot) and poly (the outline, [x0, y0, ...] in thousandths). */
interface LambaFoundLight { id: string; name: string; x: number; y: number; r: number; poly: number[]; score: number }
interface LambaFindOptions {
  /** A card with one line and one button before it starts (default true); false when your own screen already asked. */
  ask?: boolean;
  /** Switch ids YOUR APP says are lamps (a smart plug with a lamp on it). The kit does not ask the Host and cannot tell a lamp from a heater on a plug: name only a switch the Host told your app is a lamp. No other switch, fan, cover or speaker is ever blinked. */
  asLight?: string[];
  onStep?: (s: { phase: "ask" | "start" | "watch" | "found" | "missing" | "done" | "cancelled"; i?: number; n?: number; id?: string; name?: string }) => void;
  /** Milliseconds to watch each light (1500), the picture before it blinks (300), between pictures (100), the least between two switches (280). */
  watchMs?: number; baselineMs?: number; frameMs?: number; gapMs?: number;
  /** How much brighter or darker (0 to 255, default 8) counts as a light. */
  minDelta?: number;
  /** True when the source is not shown mirrored but the Host sees it mirrored (a front camera). */
  mirror?: boolean;
  /** Width of the small copy it compares (default 120), points in an outline (default 14). */
  size?: number; max?: number;
}
interface LambaFindResult {
  found: LambaFoundLight[];
  /** A light the camera did not see change: never guessed. */
  missing: Array<{ id: string; name: string; why: "not in view" | "error" }>;
  /** Lights it could not put back as they were after six tries (should be empty). */
  stuck: string[];
  cancelled: boolean;
  reason: "" | "cancelled" | "hidden" | "declined" | "error" | "source";
}
/** Lights find themselves (shell/sdk/find.js, with shape.js). */
declare var LambaFind: {
  /** True while a pass runs. A second findLights call returns the running pass; skip your own switching while this is true. */
  busy(): boolean;
  lights(home: LambaHome, source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | (() => Promise<{ url: string; w: number; h: number; mirror?: boolean }>), o?: LambaFindOptions): Promise<LambaFindResult> & { cancel(): Promise<LambaFindResult> };
  detect(before: ArrayLike<number>, after: ArrayLike<number>, w: number, h: number, o?: { minDelta?: number; max?: number }): { score: number; x: number; y: number; r: number; poly: number[]; area: number } | null;
  lightsOf(devices: LambaHomeDevice[], asLight?: string[]): LambaHomeDevice[];
};
/** The shape of a thing in a picture as a small polygon (shell/sdk/shape.js). A polygon is [x0, y0, x1, y1, ...]; saved, it is in thousandths of the picture. */
interface LambaShapeResult { w: number; h: number; mask: Uint8Array; poly: number[]; box: { x: number; y: number; w: number; h: number }; x: number; y: number; r: number; area: number }
declare var LambaShape: {
  fromMask(mask: ArrayLike<number>, w: number, h: number, o?: { seed?: { x: number; y: number }; max?: number }): LambaShapeResult | null;
  blob(values: ArrayLike<number>, w: number, h: number, threshold: number, o?: { seed?: { x: number; y: number }; max?: number }): LambaShapeResult | null;
  simplify(poly: number[], max: number): number[];
  pointIn(poly: number[], x: number, y: number): boolean;
  /** 4 letters and digits a point (0 to 1000 each), for a text setting. */
  encode(poly: number[]): string;
  decode(text: string): number[] | null;
  area(poly: number[]): number; centre(poly: number[]): { x: number; y: number }; box(poly: number[]): { x: number; y: number; w: number; h: number }; scale(poly: number[], k: number, cx: number, cy: number): number[];
};

/** What Lamba's music is doing (lamba.json "music": true). Lamba plays it itself, so an app never has to. */
interface LambaMusicState {
  /** A style is chosen and its volume is up. */
  on: boolean;
  /** The style id ("piano", "ambient", "acoustic", "strings", "handpan", "calm", "meditation"), or "" for Off. */
  style: string;
  /** The track playing, or the one that comes first. */
  track: string;
  /** The track's name and who made it. */
  name: string;
  by: string;
  /** True while sound comes out (after the first press of the remote's OK on a screen). */
  playing?: boolean;
}

/** Lamba.clip: a video file with its own sound (a .film on a canvas, the sound by Web Audio), played once and kept in step. */
interface LambaClip { play(): void; pause(): void; stop(): void;
  /** Go to a second (the picture and the sound together). */
  seek(seconds: number): void;
  /** Where it is, in seconds (the sound's clock while it plays). */
  time(): number;
  /** How long it is, in seconds (0 until known). */
  duration(): number;
  playing(): boolean;
  /** How loud it is now, 0 to 1 (the proof that sound really plays). */
  level(): number;
  stats(): { sound: "none" | "loading" | "ready" | "failed"; ready: boolean; ctx?: string; starts?: number; drift?: number } }
interface LambaClipOptions { film: string; sound?: string; onready?: () => void; onend?: () => void; onfail?: (why: string) => void; onframe?: () => void; autoplay?: boolean }
interface LambaFilm { play(): void; pause(): void; stop(): void;
  /** Another recording on the same canvas: it starts fresh at the best quality for the screen. fps and minQuality carry over unless given. */
  load(url: string, opts?: Pick<LambaFilmOptions, "low" | "seq" | "films" | "fps" | "minQuality">): void }
/** Lamba.film's options: the player's own and the film's, in one object (the SDK passes each to its place). */
interface LambaFilmOptions {
  /** The player: fn() once the first picture is drawn. */
  onframe?: () => void;
  /** The player: fn() when this screen can show none of the film's copies (show a still picture then). */
  onfail?: () => void;
  /** The player: fn(fps, dropped share) about every 2 seconds, measured. */
  onfps?: (fps: number, dropped: number) => void;
  /** The player: false draws in 2D only (no WebGL). */
  gl?: boolean;
  /** The player: true keeps the hidden player on the page (2 pixels, out of reach), for browsers that slow it down otherwise. */
  attach?: boolean;
  /** The film: the 720 copy's address (default: the address with -720 before .film), or false for none. */
  low?: string | false;
  /** The film: the pictures' index (default: name.seq.json next to name.film), or false for none. */
  seq?: string | false;
  /** The film: film addresses, best first (for example a 2160, a 1080 and a 720 copy), instead of url and low. */
  films?: string[];
  /** The film: its own frames a second (default 25). */
  fps?: number;
  /** The film: the fewest lines a copy may have on a screen (720 or 1080). Copies under it (the 360 copy, the pictures) never show; below it the still picture (onfail). Default: none. */
  minQuality?: 360 | 720 | 1080 | 1440 | 2160;
}

interface LambaQuestion { text: string; kind?: string; answer?: string; choices?: string[]; board?: unknown }

/** One Google font. rank 1 is the most popular. */
interface LambaFont {
  family: string;
  kind: "sans" | "serif" | "display" | "handwriting" | "script" | "mono";
  /** Google's own word: "Sans Serif", "Serif", "Display", "Handwriting" or "Monospace". */
  category: string;
  /** Upright weights it has: 100 thin, 300 light, 400 regular, 500 medium, 700 bold, 900 black... */
  weights: number[];
  /** Italic weights it has (empty: no italic). */
  italics: number[];
  /** Alphabets besides latin: "arabic", "cyrillic", "greek", "hebrew", "thai", "devanagari"... */
  subsets: string[];
  rank: number;
}

interface LambaFonts {
  /** The whole library, most popular first. kind "popular" is the 150 most used; query searches names (and alphabets: "arabic"); subset keeps only fonts with that alphabet. */
  list(opts?: { kind?: "popular" | "sans" | "serif" | "display" | "script" | "handwriting" | "mono"; query?: string; subset?: string; limit?: number; from?: number }): Promise<LambaFont[]>;
  search(query: string, opts?: { kind?: string; subset?: string; limit?: number; from?: number }): Promise<LambaFont[]>;
  /** One family by name (any case), or null. */
  get(family: string): Promise<LambaFont | null>;
  /** Load a font through Lamba's own address and resolve when it can be drawn (in the page or on a canvas). text: only those letters are fetched; preview: true gives it a small name of its own (use the returned family). A weight the family lacks becomes the nearest one it has. */
  load(family: string, opts?: { weight?: number; italic?: boolean; text?: string; preview?: boolean }): Promise<{ family: string; weight: number; italic: boolean }>;
  /** Resolves when the catalogue is read. */
  ready(): Promise<LambaFont[]>;
  /** The address on Lamba of a font's css (after ready()); never a Google address. */
  address(family: string, opts?: { weight?: number; italic?: boolean; text?: string; as?: string }): string;
}

interface LambaFontPicker {
  el: HTMLElement;
  /** Set the chosen font from outside (a settings change on another phone). */
  set(v: { family: string; weight?: number; italic?: boolean }): void;
  get(): { family: string; weight: number; italic: boolean };
}

/** The shared controls (shell/sdk/ui.js). fontPicker and hold are typed here; the rest are in docs/sdk/UI.md. */
interface LambaPurchases {
  /** The app itself costs money (price or subscription). */
  paid: boolean;
  /** The household may use the whole app: bought, subscribed (a trial, a grace period or a cancelled one until it ends), or the app is free. */
  owned: boolean;
  plan: "monthly" | "yearly" | null;
  state: "bought" | "trial" | "active" | "grace" | "canceled" | "expired" | null;
  until: number | null;
  /** The unlock ids (lamba.json products) the household has. */
  unlocks: string[];
  /** Unlocks in their free try, and when it ends. */
  trying: { [id: string]: number };
  preview: { mode: "free" | "time" | "locked"; minutes: number };
}
interface LambaSheetHandle {
  /** The element to draw into: it scrolls, the handle, the title and the one button stay put. */
  body: HTMLElement; root: HTMLElement; panel: HTMLElement; primary: HTMLButtonElement | null;
  title(text: string): void; sub(text: string): void;
  /** A short line under the rows (a problem in calm red, or good: calm green). */
  msg(text: string, good?: boolean): void;
  /** A slim bar, a short line that moves on, and skeleton rows, never "One moment". keep: leave what is already in the body. */
  loading(on: boolean, steps?: string[], keep?: boolean): void;
  /** A row: the name and a SHORT kind (Light, Plug, Screen, Speaker); long information goes in info, behind an "i". */
  row(r: { name: string; kind?: string; info?: string; on?: boolean | null; mode?: "switch" | "choose" | "plain"; icon?: string; attr?: { [k: string]: string }; onTap?(b: HTMLButtonElement): void }): HTMLButtonElement;
  setPrimary(text: string | null, disabled?: boolean): void;
  close(why?: string): void;
}
declare var LambaSheet: { open(o: { title?: string; sub?: string; label?: string; primary?: string | { text: string; disabled?: boolean }; onPrimary?(s: LambaSheetHandle): void; onClose?(why: "done" | "backdrop" | "drag" | "esc" | "code"): void; steps?: string[] }): LambaSheetHandle; closeAll(): void };
declare var LambaUI: {
  /** Lamba's one bottom sheet (shell/sdk/sheet.js): a handle, a hairline top edge, a soft shadow and a dim backdrop; a tap on the backdrop, Escape or a drag down closes it. Returns the sheet at once when sheet.js is on the page, else null and o.ready(sheet). */
  sheet(o: { title?: string; sub?: string; primary?: string; onPrimary?(s: LambaSheetHandle): void; onClose?(why: string): void; steps?: string[]; ready?(s: LambaSheetHandle): void }): LambaSheetHandle | null;
  /** A Google font picker: search, kinds (Popular, Script, Handwriting, Display, Sans, Serif, Mono), tiles drawn in each font, then its weights and italic. o.extra: your own list of choices shown first as { id, name, family?, weight?, italic?, draw?(canvas) }. */
  fontPicker(o: { value?: { family?: string; weight?: number; italic?: boolean; id?: string }; sample?: string; extra?: { title?: string; items: object[] }; onChange(v: { family: string; weight: number; italic: boolean; id?: string; kind: string }): void }): LambaFontPicker;
  /** A press and hold key (shell/sdk/ui.js): start on the press (finger, mouse, Enter or Space; the finger is captured), beat(msHeld) every `every` ms (1500) while held, end(why) once: "up", "cancel", "away" (page hidden or left), "max" (after max ms, 20000) or "off". */
  hold(el: Element, o: { start?(): void; beat?(msHeld: number): void; end?(why: "up" | "cancel" | "away" | "max" | "off"): void; every?: number; max?: number }): { off(): void; release(): void; held(): boolean };
  /** A Player's own colour strip ending in "Your own colour" (shell/sdk/ui.js): colours [{ id, name, hex }], onChange(hex). */
  swatches(o: { colours: { id: string; name: string; hex: string }[]; value?: string; onChange?(hex: string): void }): { el: HTMLElement; get(): string; set(hex: string): void };
  /** A swipe on a surface (shell/sdk/ui.js): fn once when a finger moves at least min px (60) that way in under 700 ms. */
  swipe(el: Element, o: { dir?: "up" | "down" | "left" | "right" | "any"; min?: number; fn(s: { dx: number; dy: number; len: number; speed: number; ms: number }): void }): { off(): void };
  /** Trace a shape with one finger: a dashed guide, the finger's line over it, onDone({ score 0 to 100, ms, pts }) when it lifts. trace.score(drawn, shape) and trace.shapes are pure. */
  trace: { (o: { el?: Element; shape: "star" | "heart" | "house" | { pts: number[][] }; onDone(r: { score: number; ms: number; pts: number[][] }): void }): { el: HTMLElement; set(shape: "star" | "heart" | "house" | { pts: number[][] }): void; clear(): void; off(): void }; score(drawn: number[][], shape: number[][]): number; shapes: { [k: string]: number[][] } };
  [k: string]: any;
};
/** Rounds, points, a clock, sliding bars and confetti for a party game (shell/sdk/game.js, ES5, screen and phone pages). */
declare var LambaGame: {
  playlist(ids: string[], n: number, last?: string): string[];
  award(order: (string | string[])[], took: string[], o?: { top?: number[]; part?: number }): { [id: string]: number };
  rank(rows: { id: string; v: number }[], low?: boolean, ties?: boolean): string[] & string[][];
  clock(o: { ms: number; every?: number; tick?(left: number): void; end?(): void }): { start(): any; pause(): any; resume(): any; stop(): any; left(): number; running(): boolean };
  bars(el: Element, o?: { ms?: number }): { show(rows: { id: string; name: string; colour?: string; mark?: string; score: number; add?: number }[]): void; set(rows: { id: string; name: string; colour?: string; mark?: string; score: number }[]): void };
  confetti(canvas: HTMLCanvasElement): { stop(): void };
  /** Ten animals (a sloth is one) and eight colours; the face of an animal as an SVG string. */
  animals: { id: string; name: string }[];
  colours: { id: string; name: string; hex: string }[];
  mark(animal: string, colour?: string, o?: { size?: number }): string;
};

/** Hand flip (shell/sdk/flip.js, ES5): a pinch of the right hand is "next", of the left hand "previous". Load flip.js, then call Lamba.hands.flip. */
declare var LambaFlip: {
  engine(o?: { pinchOn?: number; pinchOff?: number; debounce?: number; cooldown?: number; minPalm?: number; maxSpeed?: number; lostMs?: number; swap?: boolean }): { feed(frame: object, t?: number): Array<{ type: "flip"; dir: "next" | "previous"; side: "right" | "left"; t: number }>; reset(): void };
  can(): boolean;
  glow(dir: "next" | "previous", o?: { colour?: string }): boolean;
  hint(text?: string): boolean;
};

/** Air Touch, hold to press (shell/sdk/air.js, ES5): a fingertip rests on an object, an outline shows, colour fills it, full it fires once with a flash; leaving early drains it. */
declare var LambaGesture: {
  /** Hand gestures from tracking frames: feed(frame, t?) returns the events of that frame; on(fn) hears them too. Units are fractions of the picture's width. */
  engine(o?: { pinchOn?: number; pinchOff?: number; debounce?: number; tapMs?: number; holdMs?: number; deadZone?: number; flickMs?: number; flickDist?: number; palmMs?: number }): { feed(frame: object, t?: number): Array<{ type: "pinch" | "pinchmove" | "swipe" | "palm"; t: number; [k: string]: unknown }>; on(fn: (e: object) => void): () => void; reset(): void; state(): { pinched: boolean; moving: boolean; open: boolean } };
  /** The air remote's mapping: pinch tap is ok, pinch and move is one arrow for each 0.12 of the picture's width (repeating at the edge), an open palm held still is home, a quick pinch flick left is back, a pinch that starts in the right strip moved up or down is volume. At most 4 sends a second. */
  remote(o: { /** Explicit options, all off by default: an open hand is the default pose and misfired. */ drag?: boolean; palm?: boolean; flick?: boolean; volume?: boolean; send(key: "up" | "down" | "left" | "right" | "ok" | "back" | "home"): Promise<unknown>; volume?(dir: "up" | "down"): Promise<unknown>; flash?(label: string, key: string): void; fail?(e: unknown): void; off?(): boolean; wake?(): void; throttle?: number; step?: number; strip?: number; timer?: boolean; now?(): number }): { handle(e: object): void; press(key: "up" | "down" | "left" | "right" | "ok" | "back" | "home" | "volup" | "voldown"): void; pump(t?: number): void; reset(): void; active: boolean; queue(): number };
  LABEL: { [key: string]: string };
};
declare var LambaAir: {
  hold(o?: { ms?: number; drainMs?: number; flashMs?: number; reduced?: boolean }): { step(inside: boolean, dtMs: number): LambaAirState; reset(): any; fill(): number };
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: LambaAirState, o?: { colour?: string; line?: string; width?: number; reduced?: boolean; poly?: number[] }): void;
  busy(s: LambaAirState): boolean;
  /** A saved spot { x, y, r, poly? } (thousandths of the picture) in the picture's box rc (pixels): { cx, cy, r, poly (pixels, or null for a circle) }. */
  toPx(spot: { x: number; y: number; r: number; poly?: number[] }, rc: { x: number; y: number; w: number; h: number }): { cx: number; cy: number; r: number; poly: number[] | null };
  /** Is the point (pixels) in what toPx gave: the polygon, or the circle. `grow` widens it around its middle (default 1). */
  hit(shape: { cx: number; cy: number; r: number; poly: number[] | null }, px: number, py: number, grow?: number): boolean;
  pointIn(poly: number[], x: number, y: number): boolean;
  reduced(): boolean;
};
interface LambaAirState { fill: number; fired: boolean; flash: number; inside: boolean; locked: boolean; reduced: boolean }

/** What turning motion on ends with: "on" (tilt, swing and shake come now), "finger" (the person chose to play by touch), "denied" (the phone said no) or "none" (this phone has no motion). */
type MotionState = "on" | "finger" | "denied" | "none";
interface LambaTilt { /** -1 (left) to 1 (right) */ x: number; /** -1 (top of the screen) to 1 (bottom): the screen's way, so ball.y += tilt.y moves it down */ y: number }
interface LambaSwing { /** the turning speed at its peak, degrees a second */ speed: number; /** 0 to 1, how hard (for this person) */ power: number; /** where the hand went on the screen: x right, y down, so a throw at the screen is { x: 0, y: -1 } */ dir: { x: number; y: number } }
interface LambaMotion {
  state: "off" | MotionState;
  /** Phones whose lamba.json declares "motion". Lamba's own screen asks the person (an iPhone asks from a tap); nobody is taught how to hold the phone. o.orientation true also gives "orientation" events. */
  /** o.point true: tilt follows where the phone points, like a remote (turn it left or right, raise or lower it), for a game that aims at the screen; without it tilt is a marble on a tray (tip the phone). */
  start(o?: { title?: string; orientation?: boolean; point?: boolean }): Promise<MotionState>;
  stop(): LambaSDK;
  /** The way the phone is held now is the middle again. */
  centre(): LambaSDK;
  on(type: "tilt", fn: (t: LambaTilt) => void): () => void;
  on(type: "swing", fn: (s: LambaSwing) => void): () => void;
  on(type: "shake", fn: (s: { strength: number }) => void): () => void;
  /** How much the phone moves now, ten a second while motion is on: 0 held still, 1 a hard shake (a hand's tremor stays under 0.05). */
  on(type: "energy", fn: (e: { level: number }) => void): () => void;
  on(type: "orientation", fn: (o: { alpha: number | null; beta: number | null; gamma: number | null }) => void): () => void;
}
/** A frame (see the "Motion and camera" topic: landmarks, joint angles and gesture names; never the picture). */
interface LambaHands {
  /** Which camera flip would use: "phone" (this phone page, propped up), "screen" (the screen's own camera, when its host has one) or "none" (no camera, an old browser). */
  where(): Promise<"screen" | "phone" | "none">;
  /** Right hand pinch = "next", left hand pinch = "previous", once for each pinch. on(dir) is called for each; the edge glow and a one-time hint are shown unless glow / hint is false. */
  flip(o: { on?(dir: "next" | "previous", e: { side: "right" | "left"; t: number }): void; onState?(state: "starting" | "loading" | "on" | "none" | "stopped"): void; /** a hand pointing (index out, the others curled): where its fingertip is on the screen, 0 to 1, mirrored on the front camera and smoothed; (null, null) when it stops. Send it to Lamba.ink.aim for the laser. */ onPoint?(x: number | null, y: number | null): void; /** 0 to 1 while the hand model downloads */ onProgress?(fraction: number): void; camera?: "front" | "back"; glow?: boolean; hint?: boolean | string; rate?: number; swap?: boolean }): { source: "screen" | "phone" | "none"; state: string; why: string; ready: Promise<any>; on(fn: (dir: "next" | "previous", e: any) => void): any; onState(fn: (state: string) => void): any; stop(): any };
}
interface LambaTrackFrame { v: number; t: number; id: number; w: number; h: number; mirror: boolean; pose: Array<{ x: number; y: number; z: number; v: number; wx?: number; wy?: number; wz?: number }> | null; hands: Array<{ side: "left" | "right"; points: Array<{ x: number; y: number; z: number }>; shape: string; pinch: number; pinching: boolean; wave: number; [k: string]: any }>; face: { blend: { [name: string]: number }; mesh: any; smile: number; emotion: string } | null; gestures: { body: { [k: string]: any }; pair: { [k: string]: any }; events: Array<{ type: string; [k: string]: any }> }; /** the picture's mean brightness, 0 to 255, measured on the phone about once a second (the picture never leaves it) */ light?: number; [k: string]: any }
interface LambaTrackOptions { /** The person just tapped something that clearly starts the camera: skip Lamba's own "Use your camera?" and go straight to the browser's question (one question, not two). false: it was not a tap, Lamba asks first. Left out, Lamba reads navigator.userActivation: start() called inside a tap counts as a tap. Without a tap (an app that opens straight into a camera view) Lamba asks first, and a camera the browser already blocked is never asked again: Lamba says how to turn it back on. */ asked?: boolean; camera?: "front" | "back"; pose?: boolean; hands?: boolean; face?: boolean; gestures?: boolean; /** frames a second, 5 to 30 (default 30) */ rate?: number;
  /** The body model, at start. "auto" (default): the Tracking Lab's own way, the light model that steps up to the full one while the phone is quick and back down when it is not. "lite": stays on the light model. "full": starts on the full model (more exact, a 9 MB download, hotter; an iPhone or iPad always stays on the light one). Hands only: pose: false (and gestures: false for the plain hand model). */ model?: "auto" | "lite" | "full";
  /** Where the models run: left out, the engine picks (the graphics chip, the processor if that is slow). "CPU" or "GPU" forces one. */ delegate?: "CPU" | "GPU" }
interface LambaTrackSession {
  state: string;
  /** Resolves when frames flow, rejects when the camera is refused or missing. */
  ready: Promise<LambaTrackSession>;
  on(name: "frame", fn: (f: LambaTrackFrame) => void): LambaTrackSession;
  on(name: "state", fn: (state: "loading" | "running" | "paused" | "stopped" | "denied" | "nocam" | "error") => void): LambaTrackSession;
  on(name: "progress", fn: (p: { fraction: number }) => void): LambaTrackSession;
  on(name: "error", fn: (e: { why: string }) => void): LambaTrackSession;
  stop(): LambaTrackSession;
  /** No argument flips front and back. */
  switchCamera(to?: "front" | "back"): LambaTrackSession;
  setOptions(o: LambaTrackOptions): LambaTrackSession;
  calibrate(): LambaTrackSession;
}
interface LambaTrack {
  /** The real cameras of this phone: kind "none", "one", "flip" (front and back: offer a switch) or "list". */
  cameras(): Promise<{ kind: "none" | "one" | "flip" | "list"; front: boolean; back: boolean }>;
  /** Fetch the models early (kept on the phone). Resolves true, or false when this phone cannot. */
  preload(o?: { pose?: boolean; hands?: boolean; face?: boolean; gestures?: boolean; model?: "auto" | "lite" | "full" }, onProgress?: (p: { fraction: number }) => void): Promise<boolean>;
  /** Phones whose lamba.json declares "camera": the person is asked on the phone; the picture stays there. */
  start(o?: LambaTrackOptions): LambaTrackSession;
  /** Help improve tracking (Lamba's own apps only, never a kids app): this phone's own choice, off to begin with. help() says it; help(false) switches it off; help(true) only asks: Lamba shows its own sheet, and only the person's tap on Turn on switches it on. can is false where it is not offered: show no switch then. sent is 1 after an upload went. */
  help(on?: boolean): Promise<{ can: boolean; on: boolean; sent: 0 | 1 }>;
  /** Hears the choice change and an upload go. Returns a function that stops it. */
  onHelp(fn: (h: { can: boolean; on: boolean; sent: 0 | 1 }) => void): () => void;
  /** Labels the frames while the switch is on: "start" and "end" of each prompt (its id, what was expected as plain numbers, its score 0 to 1), then "done" with the round's score and the phone to screen latency in ms. Nothing is kept or sent while the switch is off. */
  /** Lamba draws the live camera picture with Tracking Lab's nodes (body, hands, face) exactly over el while the camera runs (in a camera game el is the remote's hero: the biggest thing, front and centre): the picture never enters your page. null takes it away. o.under: drawn UNDER your page (transparent there) so you draw marks over it; o.nodes false: the plain picture; o.fit "contain": the whole camera picture inside el, never cut (shape el like the picture, f.aspect, and it fills el exactly), "cover" (the default) fills el and cuts the overflow. */
  /** only: "hands" (with over: true) draws just the real hands cut out of the camera picture (soft edge, the forearm to the picture's edge, mirrored on the front camera), over your page in el's box: the whole camera picture maps to the whole box and a hand keeps its true shape, its index fingertip exactly at its place. Never a face or a body. */
  preview(el: Element | null, o?: { under?: boolean; nodes?: boolean; fit?: "cover" | "contain"; only?: "hands"; over?: boolean; /** "screen" (the Host's phone only, with only: "hands", a home camera on the screen): the same hand cutout also shows on the screen over its camera picture. Lamba cuts the hand out ON THE PHONE and sends ONLY the cutout (small, about 20 frames a second) to the room's screen, never the camera picture, the face or the body; black is sent once the hand is lost. It stops with the preview, the camera and a hidden page; a Player or Co-Host never has it. Your page never has the picture. */ share?: "screen"; /** The fingertip pointer (default true with only: "hands", false turns it off): a small bright dot exactly at the index fingertip with a soft, slowly pulsing ring (no ring, only the dot, for reduced motion). It is drawn into the cutout, so the screen shows it too. Tell Lamba when the tip is over a glow with track.pointer(). */ pointer?: boolean; /** How the hand looks with only: "hands" (default "wire": a fine white wireframe of the 21 landmarks with a ring at the index tip, no camera pixel, nothing shared with the screen but landmarks; "sticker" and "plain" are the cutouts). Old note, "sticker": a firm edge, a white outline round it and a soft shadow under it, like a sticker lifted off the picture (the outline hides the noisy fringe round the hand), a small pop when it appears and a fade when it leaves (none with reduced motion); the screen gets the same sticker. "plain": the cutout alone, with a soft 2 to 3 px edge. */ look?: "wire" | "sticker" | "plain" }): void;
  /** A small live self view of this phone's camera (the plain picture, mirrored like the picture the engine runs), drawn by Lamba exactly over el (at most 200 x 200, about 15 frames a second), ALONGSIDE any preview: with preview(other, { only: "hands" }) drawing the hand over another picture, the person still sees that the camera is on and where it looks. Your page never has the picture. self(null) takes it away. */
  self(el: Element | null): void;
  /** With preview(el, { only: "hands" }): the tip is over a glow (over true: the ring tightens) and how far that glow's hold has filled (progress 0 to 1). Call it as often as you like; Lamba sends only changes. */
  pointer(over: boolean, progress?: number): void;
  /** Hand gestures from the running session's landmarks (load ../../shell/sdk/gesture.js): gestures(true) starts them, gestures(false) stops them; true when they run. With hysteresis and a debounce, so jitter makes nothing. */
  gestures(on?: boolean): boolean;
  /** Listens to the hand gestures (and starts them): pinch { on, tap, ms } (thumb tip and index tip within 0.25 of the palm size, off at 0.40; a tap is under 300 ms with little movement), pinchmove { dx, dy, x, y } (fractions of the picture's width, after 300 ms and a 0.03 dead zone), swipe { dir } (a pinch flick under 300 ms, 0.12 or more), palm (an open hand held still 0.8 s). Returns the way to stop listening. */
  on(ev: "gesture", fn: (e: { type: "pinch" | "pinchmove" | "swipe" | "palm"; t: number; on?: boolean; tap?: boolean; ms?: number; dx?: number; dy?: number; x?: number; y?: number; dir?: "left" | "right" | "up" | "down"; dist?: number }) => void): () => void;
  /** The Host's phone, settings part only: a small still of the live camera (JPEG data address, 640 wide at most, mirrored like the screen shows a front camera) to mark things on, taken from the camera this phone runs with start(). Never available to a Player's page or the screen (rejects "not allowed"); rejects "no camera" when none runs. The page is sealed (no network): keep it for drawing, never send it on. */
  still(): Promise<{ url: string; w: number; h: number; mirror: boolean }>;
  mark(o: { prompt?: string; at: "start" | "end" | "done"; expect?: { [k: string]: number }; score?: number; latency?: { med: number; p95: number; n: number } }): void;
}

/** A microphone session's state (docs/sdk/SENSORS.md, Microphone): "asking" (Lamba's sheet or the browser asks), "on", "off" (stopped: by the app,
 * the person's tap on Lamba's sign, the phone locking), "denied" (said no, or not declared), "host" (the Host turned Players' microphones off),
 * "none" (no microphone here, or no words: why "words"), "error". */
type LambaMicState = "asking" | "on" | "off" | "denied" | "host" | "none" | "error";
interface LambaMicSession {
  mode: "level" | "words" | "record";
  state: LambaMicState;
  /** Resolves once it listens; rejects with an Error whose why says why not. */
  ready: Promise<LambaMicSession>;
  on(ev: "state", fn: (state: LambaMicState, why: string) => void): LambaMicSession;
  /** level only: a blow began (loud noise, not a voice, for a fifth of a second). */
  on(ev: "blow", fn: (b: { strength: number }) => void): LambaMicSession;
  stop(): LambaMicSession;
}
type LambaRecordState = "idle" | "counting" | "asking" | "on" | "paused" | "saving" | "done" | "denied" | "none" | "signin" | "full" | "error";
type LambaRecordEvent = ["slide", number] | ["tr", string] | ["laser", number, number, string] | ["vid", "play" | "pause" | "seek", number];
interface LambaRecord {
  state: LambaRecordState; id: string; url: string; seconds: number; left: number;
  /** true on a phone whose lamba.json declares "recording" while the Host's setting "recording" is not "off". */
  allowed(): boolean;
  /** Show or hide Lamba's own Record key (it hides itself when the Host sets Recording to Off). Never draw your own. */
  key(on?: boolean): LambaRecord;
  /** What the next recording is: title, presenter, the deck ({ v: 1, id, title, items }) and its id. Nothing is uploaded until a recording starts. */
  prepare(o: { title?: string; presenter?: string; deck?: object; deckId?: string }): LambaRecord;
  start(o?: { asked?: boolean }): LambaRecord;
  stop(): LambaRecord;
  /** Pause and resume the running recording (Lamba's own key does this too). Paused time is left out of the voice, the timeline and the length. */
  pause(): LambaRecord;
  resume(): LambaRecord;
  /** A timeline event; the host stamps its time. Ignored while not recording. */
  event(e: LambaRecordEvent): LambaRecord;
  /** A small JPEG (data URL, at most 400 KB) of slide i, for the link's chapters. */
  slide(i: number, jpegDataUrl: string): LambaRecord;
  mine(): Promise<{ id: string; title: string; date: number; seconds: number }[]>;
  remove(id: string): LambaRecord;
  on(ev: "state" | "tick" | "progress", fn: (a: any, b?: any) => void): LambaRecord;
}
interface LambaMic {
  /** The last session's state. */
  state: LambaMicState;
  /** Does this phone turn speech into words (false: offer another way); null on the screen. */
  canWords: boolean | null;
  /** The loudness, 0 (a quiet room) to 1 (shouting into it), smoothed, about 25 times a second; x.blow is true while a blow lasts. Only the number leaves the phone. */
  /** o.asked: the person just tapped something that starts the microphone: no question of Lamba's own, only the browser's (left out, a call inside a tap counts; see Lamba.track.start). */
  level(fn: (v: number, x: { blow: boolean }) => void, o?: { blow?: boolean; asked?: boolean }): LambaMicSession;
  /** Speech to text on the phone: onText gets the words so far, onFinal each finished sentence. Only the words leave the phone. */
  words(o?: { asked?: boolean; lang?: string; interim?: boolean; onText?: (text: string) => void; onFinal?: (text: string) => void }): LambaMicSession;
  /** Lamba's own sheet records up to max seconds (1 to 15, default 10); the person listens back and sends it. Resolves { id, seconds } once sent, null if they closed it; rejects when refused. The screen hears it as a Lamba.voice "message". */
  record(o?: { max?: number; asked?: boolean }): Promise<{ id: string; seconds: number } | null>;
  /** Stops every session of this page. */
  stop(): LambaSDK;
}
interface LambaVoice {
  /** A voice message came (from: "owner" or a Player's id). */
  on(ev: "message", fn: (m: { id: string; from: string; seconds: number }) => void): () => void;
  /** Someone began or stopped talking live (name: "The Host", the Player's name, or ""). */
  on(ev: "talk", fn: (t: { from: string; name: string; on: boolean }) => void): () => void;
  /** Live captions (live({ captions: true })): the talker's words so far, from their phone's own speech recognition; final at a sentence's end. */
  on(ev: "words", fn: (w: { from: string; name: string; text: string; final: boolean }) => void): () => void;
  on(ev: "live", fn: (state: "on" | "off" | "none") => void): () => void;
  /** Plays a voice message through this page's sound (the Host's volume); resolves once it ended. volume 0 to 1. */
  play(id: string, o?: { volume?: number }): Promise<{ seconds: number }>;
  /** Stops the messages playing now. */
  stop(): LambaSDK;
  /** Opens live voice: Lamba's hold to talk on the phones, the voice plays here. talkers 1 to 4 (1), max 5 to 60 seconds (30), silence 2 to 15 (5).
   * Resolves "on", or "none" when this screen cannot play it (it says so). live(false) ends it. */
  live(o?: { talkers?: number; max?: number; silence?: number; big?: boolean; captions?: boolean; /** false: captions only, the voice is never sent or played, and a tap turns captions on until a tap turns them off (default true) */ sound?: boolean; /** false: no sign of Lamba's on the screen for who talks; the app shows it itself, in its own words (default true) */ sign?: boolean } | false): Promise<"on" | "none" | "off">;
}

interface LambaVideoRect {
  /** Fractions of the app's page, 0 to 1: where the picture goes. */
  x: number; y: number; w: number; h: number;
  /** "fill": the whole picture with its own soft copy filling the sides (a face held upright on a wide screen); "cover" fills the box and cuts what overflows; "contain" fits the whole picture on black (a shared screen). Left out: fill for a camera, contain for a screen. */
  fit?: "cover" | "contain" | "fill";
}
interface LambaVideoCall {
  /** Remote people (not on the screen's Wi-Fi) the plan allows in one call; 0 = no remote. Home 2, Business 12 (worker/plans.js). */
  remoteMax: number;
  /** When the call ends (ms since 1970, this screen's clock), or 0 for no time limit. The clock starts when the first remote person joins. */
  endsAt: number;
  /** Remote people in the call now, and remote people past remoteMax ("This call is full"). */
  remote: number; full: number;
  /** The time ran out: the remote people have dropped out, the room goes on sharing on its Wi-Fi. */
  over: boolean;
}
interface LambaVideo {
  /** Same as Lamba.track.still(): a still of the camera for marking, the Host's settings part only (see there). */
  still(): Promise<{ url: string; w: number; h: number; mirror: boolean }>;
  /** Someone started or stopped showing (from: "owner" or a Player's id; kind: their camera or their screen; slot 0 to 5, the sender's part of the split, or its place in the row of heads; kind "file": a picture or the pages of a PDF; head: a front camera floating round over the pictures). */
  on(ev: "show", fn: (s: { from: string; name: string; kind: "camera" | "screen" | "file"; on: boolean; slot: number }) => void): () => void;
  on(ev: "live", fn: (state: "on" | "off" | "none") => void): () => void;
  /** Room sharing: the plan's limits and the call's time changed (a remote person came or went, the 5 minute mark, the end). Lamba draws the pill and the lines itself. */
  on(ev: "call", fn: (c: LambaVideoCall) => void): () => void;
  /** The last "call" word, or undefined before the room says. */
  call?: LambaVideoCall;
  /** Opens live video: Lamba's own "Show my camera" or "Share my screen" tap on the phones and computers, and Lamba draws the picture over this page (never a video element of yours).
   * from: "camera" (phones), "screen" (computers) or "any" (default); senders 1 to 6 at once, a split of up to 6 parts (default 1; the plan's splitMax may allow fewer); heads: every FRONT camera is a round head floating over the pictures, taking no part (a back camera is a share and takes a part), default false; files: people may share a picture or a PDF (turned into page pictures on their own device, deleted when the share stops), default false; big: the tap is the remote's one big key; audio: the sound goes with the picture (a camera's microphone, a shared tab's sound), played by Lamba at the Host's volume, default false.
   * Resolves "on", or "none" when this screen cannot show it. live(false) ends it. */
  /** the screen page of a deck: show page n (0 based). The room believes only this page in a deck. */
  page(n: number): LambaSDK;
  /** a deck on a computer used as the screen: Lamba draws "Choose slides on this computer" (and a drop anywhere, and a quiet Add slides) over your page; leave room for the button as { x, y, w, h } in 0..1 of the page, or null to take it back. Nothing is drawn on a TV browser or a touch screen. */
  pickSlot(r: { x: number; y: number; w: number; h: number } | null): LambaSDK;
  /** a phone page: a small data picture of page n of the deck, or "" */
  thumb(n: number): Promise<string>;
  live(o?: { from?: "camera" | "screen" | "any"; senders?: 1 | 2 | 3 | 4 | 5 | 6; heads?: boolean; files?: boolean; /** with files: the Host's phone adds a deck (a PDF, pictures, a Google Slides link); the room keeps the pages and only this screen page moves them (page(n)); Lamba draws the remote (big keys, count, strip, video bar) on every phone. With files false and from "screen": the keys of Present from my computer. */ deck?: boolean; /** a deck's transition when a page changes: "none" (default), "fade", "slide" or "zoom" */ transition?: "none" | "fade" | "slide" | "zoom"; /** true: Lamba draws the live picture UNDER your page, and your page is transparent where it draws nothing (leave the page background out), so you can draw over the picture (a glow, a ring). Your page never gets a pixel of it. */ under?: boolean; /** true: a Player keeps your own remote (phone.html) while video is live, instead of the copy of the screen; Lamba's Camera key stands at the foot below it. Use it when the remote is the camera view (Lamba.track.preview). */ own?: boolean; big?: boolean; audio?: boolean; /** the phone's first camera: "front" (default, a face, mirrored) or "back" (a whiteboard, a page) */ camera?: "front" | "back" } | false): Promise<"on" | "none" | "off">;
  /** Where Lamba draws the picture: the whole page by default (a half each with senders 2, a grid of 3 to 6 parts with a thin black line between). from: one sender's id (from a "show"); left out: every sender. place(null) puts it back. */
  place(rect: LambaVideoRect | null, from?: string): LambaSDK;
}

interface LambaDesktop {
  state: "off" | "waiting" | "paired" | "away"; info: { os: "mac" | "win" | ""; apps: ("keynote" | "powerpoint")[]; keys: boolean; pinch: boolean; canPinch: boolean };
  /** True on the Host's Mac or Windows computer (never a phone). The first call asks Lamba's page; listen with on("state"). */
  can(): boolean;
  /** Joins the Lamba helper: raises "code" for the person to TYPE into the helper's "Enter a code" (no link ever opens it). Resolves when it joins. */
  pair(): Promise<{ os: string; apps: string[] }>;
  unpair(): void;
  /** One key in the front slideshow: Keynote or PowerPoint itself, else an arrow key. The word "access" says the Mac's Accessibility switch is off. */
  key(k: "next" | "previous" | "first" | "last"): Promise<{ ok: boolean; via: "keynote" | "powerpoint" | "keys" | ""; why: "" | "access" | "noapp" | "failed" | "away" }>;
  /** A Keynote or PowerPoint file as a PDF, exact pages. No file: the helper opens its own chooser. */
  toPdf(file?: File): Promise<{ name: string; blob: Blob }>;
  /** Hand pinch with the computer's own webcam, looked at by the helper ON the computer (Mac helper 1.1 or later, info.canPinch): the helper presses next (right hand) and previous (left hand) itself; no picture ever leaves the computer. */
  pinch(on: boolean): Promise<{ ok: boolean; state: "on" | "off" | "denied" | "nocam" | "failed" }>;
  on(ev: "state", fn: (state: string, info: object) => void): () => void;
  on(ev: "code", fn: (code: string) => void): () => void;
  /** One pinch the helper saw and pressed: ok false says why it could not press (the same words as key). */
  on(ev: "pinch", fn: (dir: "next" | "previous", e: { side: "right" | "left"; ok: boolean; via: string; why: string }) => void): () => void;
  on(ev: "cam", fn: (state: "on" | "off" | "denied" | "nocam" | "failed") => void): () => void;
}
interface LambaInk {
  /** The Host lets Players point and draw (their Players tile): null until the room says, then true or false. Show your join card only when true. */
  players: boolean | null;
  on(ev: "players", fn: (on: boolean) => void): () => void;
  /** A finished stroke (points are 0 to 1 of the placed rectangle), or a pointer moving (at most 10 a second for each person). from: "owner" or a Player's id. */
  on(ev: "stroke", fn: (s: { from: string; name: string; colour: string; points: { x: number; y: number }[] }) => void): () => void;
  on(ev: "point", fn: (s: { from: string; name: string; colour: string; x: number; y: number }) => void): () => void;
  on(ev: "live", fn: (state: "on" | "off" | "none") => void): () => void;
  /** Opens ink: Lamba's own pad on the phones (Point and Draw), and Lamba draws each person's pointer dot and strokes over this page, above any live video.
   * pointer / draw: which modes the pad offers (both on by default); fade: seconds before a stroke fades away (0, the default, never). Resolves "on", or "none" when this screen cannot draw it. live(false) ends it. */
  live(o?: { pointer?: boolean; draw?: boolean; fade?: number; /** each person's name beside their dot (true, the default) */ names?: boolean; /** "laser" (a red dot for everyone, the default), "person" (each person's colour), or one "#rrggbb" for all */ dot?: "laser" | "person" | string } | false): Promise<"on" | "none" | "off">;
  /** A person's colour, your app's choice ("owner" or a Player's id, "#rrggbb"; null gives Lamba's colour back): their lines, their own pad, and their dot when dot is "person". */
  colour(who: string, colour: string | null): LambaSDK;
  /** A person's colour on the screen ("owner", "v0", "v1"...): the one you gave, else Lamba's own, spread apart so no two people look alike. */
  colourOf(who: string): string;
  /** Where Lamba draws, and what the phones' pad stands for: fractions of the page ({ x, y, w, h }), the whole page by default. place(null) puts it back. */
  place(rect: { x: number; y: number; w: number; h: number } | null): LambaSDK;
  /** Wipes every stroke. */
  clear(): LambaSDK;
  /** A PHONE page (lamba.json "ink"): a pointing hand drives this phone's laser dot on the screen. x, y are 0 to 1 of the screen's picture; aim(null, null) when the hand stops. Lamba keeps to the Host's rules and sends it like the pad's own dot. */
  aim(x: number | null, y: number | null): LambaSDK;
}

interface LambaSDK {
  /** The vocabulary's version: 1. */
  v: number;
  /** The app's id. */
  app: string;
  role: Role | "";
  screen: LambaScreen;
  /** The app's own settings (lamba.json settings.fields), always valid. Never the host's frame, mat or brightness. A "photo" setting is "" (none yet: draw an empty frame) or an address to draw with <img> or drawImage (Lamba shows the picker and the crop at the setting's aspect). */
  settings: { [key: string]: SettingValue };
  theme: LambaTheme;
  /** Screen: the guests playing now, in the order they came in. */
  players: LambaPlayer[];
  /** Screen: the visitors here now (lamba.json visitors): no seat, a few messages a minute each, never in players. */
  visitors: LambaPlayer[];
  /** A guest's phone: true while this person is a visitor, not a player. */
  visitor: boolean;
  /** Phones (part, guest): is this app on the screen now. */
  status: LambaStatus;
  /** "Easier to see": 0 off, 1 on, 2 strongest. */
  see: number;
  /** Screen: null on the whole screen; in one half of a split screen, which half and its shape (tall: lamba.json "split": "tall"). */
  layout: { half: "left" | "right"; tall: boolean; scale: number; w: number; h: number } | null;
  /** Screen: fn(layout) when the screen is split, or whole again. */
  onLayout(fn: (layout: { half: "left" | "right"; tall: boolean; scale: number; w: number; h: number } | null) => void): LambaSDK;
  /** Screen: where the screen is, only when lamba.json asks for "country"; null otherwise. */
  place: { country: string } | null;
  /** What the host said about each declared permission. */
  permissions: { [name: string]: PermissionState };

  /** fn(Lamba) once the host has said hello. Start everything here. */
  ready(fn: (L: LambaSDK) => void): LambaSDK;
  /** The page has drawn itself: the host fades it in (a picture view: the picture is ready). */
  /** The Host's own page: open one of Lamba's own pages in a new tab from a tap. Only "/helper" (the Mac app download) is allowed. */
  link(path: "/helper"): LambaSDK;
  drawn(): LambaSDK;
  /** Staging only: a small plain object (3000 characters at most) to the staging log (wrangler tail, "tcltest 0000 app"), so a run on a real phone can be read afterwards. It goes nowhere on live. */
  report(o: { [k: string]: unknown }): LambaSDK;
  onSettings(fn: (settings: { [key: string]: SettingValue }, changed: string[]) => void): LambaSDK;
  onPlayers(fn: (players: LambaPlayer[]) => void): LambaSDK;
  /** Screen: fn({ id, person, kind, on }) when a device of a Player joins or leaves ("Use another device" in the Player menu). */
  onDevice(fn: (d: LambaDevice) => void): LambaSDK;
  /** What this page runs on: "phone" or "computer" on a Player's or the Host's page, "screen" on the screen page. */
  device: "phone" | "computer" | "screen";
  /** Screen: fn(visitors) when visitors come or go. */
  onVisitors(fn: (visitors: LambaPlayer[]) => void): LambaSDK;
  /** A guest's phone: fn(visitor) when a visitor gets a player's seat. */
  onSeat(fn: (visitor: boolean) => void): LambaSDK;
  /** Screen: the remote's OK button, when lamba.json has "remote": { "ok": true }. */
  onKey(fn: (k: { key: "ok"; down: boolean }) => void): LambaSDK;
  onStatus(fn: (status: LambaStatus) => void): LambaSDK;
  onScreen(fn: (screen: LambaScreen) => void): LambaSDK;
  onSee(fn: (level: number) => void): LambaSDK;
  /** The time zone the Host picked for the screen ("Europe/Amsterdam"); "" means the screen's own. Use it as `timeZone` in Intl.DateTimeFormat or toLocaleTimeString for any wall time you show. */
  timeZone: string;
  onTimeZone(fn: (zone: string) => void): LambaSDK;
  /** Screen: what Lamba's music is doing, or null when the app does not declare "music": true. */
  music: LambaMusicState | null;
  /** Screen: fn(state) when the style, the track or whether it plays changes. */
  onMusic(fn: (state: LambaMusicState | null) => void): LambaSDK;
  /** Kept for old apps: does nothing now (there is no controller view). */
  keepInView(on: boolean): LambaSDK;
  /** Part: take the whole phone screen (a photo's crop screen, LambaUI.photo does it for you), and give it back with false. */
  fill(on: boolean): LambaSDK;
  /** Screen: the Host tapped one of the app's action tiles (lamba.json actions). from is "owner". */
  on(type: "action", fn: (msg: LambaAction, from: "owner") => void): LambaSDK;
  /** Messages of that type from the other side. from: "tv", "owner" or a player's id ("v0"). */
  /** from: the sender (a person with two devices is one id); info: null, or { device, kind } when it came from that person's other device. */
  on(type: string, fn: (msg: LambaMessage, from: string, info: { device: string; kind: "phone" | "computer" } | null) => void): LambaSDK;
  /** Screen: what an action's tile says now (Start becomes Pause): label (24 at most), icon (an SVG in the app's folder), off (greyed). The Host's phone reads it from its copy of the screen. */
  action(key: string, state: { label?: string; icon?: string; off?: boolean }): LambaSDK;
  /** Phones: { name } the person chose, never an email. null on the screen or when no name was given. */
  me(): { name: string } | null;
  /** A paid app (lamba.json price, subscription or products): what this household owns, the same on every screen and phone; null for an app with nothing to sell. */
  purchases: LambaPurchases | null;
  onPurchases(fn: (p: LambaPurchases | null) => void): LambaSDK;
  /** True when the household has the app (no id) or that unlock (bought, or in its free try). */
  owns(id?: string): boolean;
  /** The Host's phone only: Lamba's payment sheet for the app (no id), "monthly", "yearly" or an unlock id. The screen and Players are always told no ("host"). */
  buy(id?: string): Promise<{ ok: boolean; why: "" | "cancelled" | "host" | "owned" | "off" }>;
  /** A phone's message always goes to the screen. The screen's goes to `to`. Its type is never "action" (the host's). */
  send(msg: LambaMessage, to?: To): LambaSDK;
  /** Screen: give a Player (LambaPlayer.person) their own settings, e.g. a free animal when they join. The room checks the values like the Player's own change. */
  setOwn(person: string, patch: Record<string, unknown>): LambaSDK;
  /** Part: change settings; final false while still moving (a slider being dragged). */
  change(patch: { [key: string]: SettingValue }, final?: boolean): LambaSDK;
  store: LambaStore;
  sound: LambaSound;
  /** Ask for a permission lamba.json declares. One not declared is always "denied". */
  ask(name: Permission, fn?: (state: PermissionState) => void): LambaSDK;
  /** Screen: a looping film drawn into a canvas (a .film file: H.264 MP4 inside). Never a <video> on a screen page. */
  film(canvas: HTMLCanvasElement, url: string, opts?: LambaFilmOptions): LambaFilm;
  /** A video file with its own sound, played once (never a <video> on a screen page): shell/clip.js. */
  clip(canvas: HTMLCanvasElement, opts: LambaClipOptions): LambaClip;
  /** Screen: the host's join card with the code people scan. Only for apps guests join. line: at most 60 characters. */
  /** The host's join card. An ambient app (categories "ambient", "art" or "clocks") never gets the big card in the middle: "full" shows the corner card for 30 s, then only the small code in that corner; "corner" is the small code at once. side: which bottom corner (default "left"). */
  joinCard(o: { show?: boolean; size?: "full" | "corner" | "code"; line?: string; avoid?: [number, number, number, number]; side?: "left" | "right" }): LambaSDK;
  /** Screen: the in-room question for what is on screen now. */
  question(q: LambaQuestion): LambaSDK;
  /** Screen and picture: the app's main colours, so the frame's Soft and Neon styles match. */
  colours(c: { board?: string; ink?: string }): LambaSDK;
  /** Part, guest: ask the host to put this app on the screen. */
  show(): LambaSDK;
  /** Part: open a group of the settings drawer (and one of its parts); "" goes back to the tiles. */
  open(group: string, part?: string): LambaSDK;
  /** Part, or the screen's copy on the Host's phone: the words under a settings tile whose value is "app", at most 40 characters. */
  describe(group: string, text: string): LambaSDK;
  /** Screen: where the movable parts of the picture are now (screen widths; w, h before turning; r in degrees), so the phone's copy of the screen shows handles to move, size and turn them. A "transforms" setting holds the result. */
  parts(list: { id: string; name?: string; cx: number; cy: number; w: number; h: number; r?: number; parent?: string }[]): LambaSDK;
  /** A part's { x, y, s, r } from a "transforms" setting (s 1, the rest 0 when not moved yet). */
  xf(map: { [id: string]: { x: number; y: number; s: number; r: number; d?: 1 } } | undefined, id: string): { x: number; y: number; s: number; r: number; d: boolean };
  /** Phone views, "motion" declared: tilt, swing and shake (docs/sdk/SENSORS.md). */
  motion: LambaMotion;
  /** Phone views, "camera" declared: body, hands and face as landmarks and gesture names (docs/sdk/SENSORS.md). */
  track: LambaTrack;
  /** Hand flip (load ../../shell/sdk/flip.js): a pinch of the right hand is next, of the left hand previous. */
  hands: LambaHands;
  /** Phone views, "microphone" declared: loudness, words and voice messages; Lamba asks, shows it listens and stops it (docs/sdk/SENSORS.md). */
  mic: LambaMic;
  /** Phone views, "recording" declared: record a talk to a link, lamba.tv/r/<id>. Optional, only on the person's tap (docs/sdk/SENSORS.md, "Recording a talk"). */
  record: LambaRecord;
  /** The screen, "microphone" declared: voice messages and live voice. */
  voice: LambaVoice;
  /** The screen, "video" declared: a live camera or screen picture, drawn by Lamba. */
  video: LambaVideo;
  /** The screen, "ink" declared: phones point and draw over this page, drawn by Lamba (docs/sdk/SENSORS.md, "Ink and pointers"). */
  ink: LambaInk;
  /** A phone page on the Host's computer, "desktop" declared: the Lamba helper moves Keynote and PowerPoint (docs/sdk/SENSORS.md, "Lamba helper"). */
  desktop: LambaDesktop;
  /** The Host's smart home, "home": true declared (docs/sdk/HOME.md): list and allow devices on the Host's phone, switch the allowed ones from the screen. */
  home: LambaHome;
  /** The camera source of an Air Touch app, "cameraSource": true declared (docs/sdk/SENSORS.md, "Camera sources"): which camera the Host picked, and on the screen the picture of a home camera. */
  camera: LambaCamera;
  /** A sender that keeps to hz messages a second (1 to 30, the latest wins). From a phone to the screen it goes straight over the Wi-Fi when it can (a direct link, no round trip through the room) and through the room when not; your app cannot tell and never needs to: const out = Lamba.stream("pos", 20, "tv"); out({ x, y }). */
  stream(type: string, hz?: number, to?: string): ((data: { [k: string]: unknown }) => void) & { flush(): void };
  /** Phones: every Google font, through Lamba's own address (never straight from Google). */
  fonts: LambaFonts;
  /** Part, or the screen's copy on the Host's phone: choices made at run time for a choice setting marked dynamic, at most 120. */
  choices(setting: string, list: Array<{ id: string | number; name: string; sub?: string; picture?: unknown }>): LambaSDK;
}

// A script, not a module: Lamba and these types are global, as the SDK is on the page.
declare var Lamba: LambaSDK;
interface Window { Lamba: LambaSDK }

/** What is in a photo, found on the phone (shell/sdk/vision.js; load it on a phone page only, never on the screen page). Nothing is uploaded. */
interface LambaVisionSubject {
  /** "person" (hair, skin, face and clothes told apart), "pet", "object" (a thing the model knows), or "none" (nothing found). */
  kind: "person" | "pet" | "object" | "none";
  /** The size of the label map: the picture's longest side is made `size` pixels (320 by default). */
  w: number;
  h: number;
  /** One byte per pixel. 0 is the background. A person: 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 other. A pet or an object: 1. */
  label: Uint8Array;
}
interface LambaVisionFace {
  w: number;
  h: number;
  /** The face's 478 mesh points as x, y, x, y, ... in pixels of the same size as the subject. */
  pts: number[];
}
interface LambaVisionApi {
  /** Find the main subject. `thing: true` skips the person model. Can reject (no WebGL, a lost connection): fall back to something simpler. */
  subject(canvas: HTMLCanvasElement, o?: { size?: number; thing?: boolean; onProgress?: (fraction: number) => void }): Promise<LambaVisionSubject>;
  /** Find the main face, or null. */
  face(canvas: HTMLCanvasElement, o?: { size?: number }): Promise<LambaVisionFace | null>;
  /** Tap an object: its real outline (MediaPipe's Interactive Segmenter, on the phone, nothing uploaded; needs shape.js). x and y are thousandths of the picture. Resolves null when nothing is there. The model is freed 20 s after the last tap, or by release(). */
  outline(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, pt: { x: number; y: number }, o?: { size?: number; max?: number; onProgress?: (fraction: number) => void }): Promise<LambaShapeResult | null>;
  /** HEAVY: a second engine and an 18 MB model, about 400 MB more on the phone, one model at a time; not for phones with little memory (lamba check warns). Prefer glow() and suggest(). What is it: the kinds of smart home device the picture looks like, best first. `what` is an outline() result or a box in thousandths. */
  label(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, what: LambaShapeResult | { x: number; y: number; w: number; h: number }, o?: { size?: number }): Promise<Array<{ kind: "light" | "media_player" | "fan" | "switch"; score: number; label: string }>>;
  /** The Host's device list with the best match first (copies, each with .match 0 to 1). No model, no picture. `placed`: ids that already have a spot, they go after the others. */
  suggest(devices: LambaHomeDevice[], labels: Array<{ kind: string; score: number }>, o?: { placed?: string[] }): Array<LambaHomeDevice & { match: number }>;
  /** Lamba.track.still() answers { url, w, h, mirror }: this turns it into a canvas that outline(), glow() and label() read (the Host's phone page never holds the live picture, only stills). */
  fromStill(still: { url: string; w: number; h: number; mirror?: boolean }): Promise<HTMLCanvasElement>;
  /** No model, free: is the tapped thing much brighter than what is round it (a lit lamp)? `what` is an outline() result or a circle { x, y, r } in thousandths. Returns [{ kind: "light", score }] or []. */
  glow(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, what: { x: number; y: number; r?: number; poly?: number[] }): Array<{ kind: "light"; score: number; label: string }>;
  kindOf(imagenetName: string): "light" | "media_player" | "fan" | "switch" | "";
  /** Free the segmenter and the classifier now. */
  release(): void;
  /** Load the engine early. Resolves false when this phone cannot run it. */
  ready(o?: { onProgress?: (fraction: number) => void }): Promise<boolean>;
  /** The mesh point numbers of each part of a face (closed loops end where they start). */
  FACE: { [part: string]: number[] };
  /** False on a browser without WebAssembly. */
  supported: boolean;
}
declare var LambaVision: LambaVisionApi;
