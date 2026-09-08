/**
 * RKD birthday party booking backend.
 *
 * Deploy this as its OWN standalone Google Apps Script Web App — separate from
 * google-apps-script/Code.gs, which already defines doPost() for the tournament
 * forms. Two doPost() functions cannot live in one project. See
 * ../BIRTHDAY_BOOKING_SETUP.md for the full walkthrough.
 *
 * Slots come from the fixed weekly pattern in WEEKLY_SCHEDULE below, so the
 * normal week needs no upkeep at all. One-off changes — closing a date, adding
 * a time that isn't in the pattern — go in the Exceptions tab of the sheet, no
 * code change needed. Run setupBookingSheet() once from the editor and it
 * creates both tabs with their headers:
 *
 *   Exceptions columns:  A date | B start | C action | D note
 *   Bookings   columns:  A ref | B date | C start | D package | E price |
 *                        F parent | G phone | H email | I child | J age |
 *                        K guests | L notes | M language | N status |
 *                        O created | P paid
 *
 * A slot is taken when a Bookings row for the same date+start is PAID, or is a
 * HOLD created less than CONFIG.holdMinutes ago. Taken slots stop being
 * offered. Expired holds free their slot automatically — no cleanup trigger is
 * required for correctness.
 */

var CONFIG = {
  // Spreadsheet that holds the Exceptions and Bookings tabs. Paste the long id from
  // the sheet's URL: docs.google.com/spreadsheets/d/<THIS PART>/edit
  sheetId: 'PASTE_YOUR_BOOKING_SPREADSHEET_ID_HERE',

  // Where new-booking alerts go. Leave '' to turn the emails off.
  notifyEmail: '',

  timezone: 'Asia/Jerusalem',

  // How long a slot is held while the customer pays. After this the slot
  // reopens on its own.
  holdMinutes: 20,

  // Bookings must start at least this many hours from now.
  minNoticeHours: 24,

  // How far ahead the booking page shows slots.
  maxDaysAhead: 120,
};

/**
 * The two party packages. `payUrl` is the payment link the customer is sent to
 * after their slot is held — one link per package, because payment links carry
 * a fixed amount. Put {REF} anywhere in the URL and the booking reference is
 * substituted in; without it the reference is appended as ?ref=... so the
 * payment lands next to the right row.
 */
var PACKAGES = {
  basic: {
    label: 'Basic',
    labelHe: 'בסיסי',
    price: 450,
    maxGuests: 16,
    payUrl: 'PASTE_YOUR_BASIC_PAYMENT_LINK_HERE',
  },
  vip: {
    label: 'VIP',
    labelHe: 'VIP',
    price: 750,
    maxGuests: 20,
    payUrl: 'PASTE_YOUR_VIP_PAYMENT_LINK_HERE',
  },
};

/**
 * The weekly pattern of party start times. The key is the day of the week
 * (0 = Sunday through 6 = Saturday); the value is the times offered that day.
 * Editing this changes the schedule from next lookup onward — but it is code,
 * so a one-off closure or an extra time belongs in the Exceptions tab instead.
 *
 * Leave a day out entirely (or give it an empty list) to offer nothing that day.
 */
var WEEKLY_SCHEDULE = {
  0: ['14:00', '16:00', '18:00'], // Sunday
  1: ['14:00', '16:00', '18:00'], // Monday
  2: ['14:00', '16:00', '18:00'], // Tuesday
  3: ['14:00', '16:00', '18:00'], // Wednesday
  4: ['14:00', '16:00', '18:00'], // Thursday
  5: ['11:00', '13:00'],          // Friday
  6: ['11:00', '13:00', '15:00', '17:00'], // Saturday
};

/* ─────────────────────────── one-time setup ─────────────────────────── */

/**
 * Run this once from the Apps Script editor (select setupBookingSheet, press
 * Run) after filling in CONFIG.sheetId. It creates both tabs, writes the header
 * rows, and drops in a few example slots so you can see the expected format.
 */
function setupBookingSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.sheetId);

  var ex = ss.getSheetByName('Exceptions') || ss.insertSheet('Exceptions');
  if (ex.getLastRow() === 0) {
    ex.appendRow(['date', 'start', 'action', 'note']);
    // Examples of the three things this tab can do. Delete these rows.
    ex.appendRow(['2026-10-16', '', 'close', 'closed all day — private event']);
    ex.appendRow(['2026-10-17', '16:00', 'close', 'just this one time is unavailable']);
    ex.appendRow(['2026-10-18', '20:00', 'open', 'extra late slot, not in the usual week']);
    ex.setFrozenRows(1);
  }

  var bookings = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
  if (bookings.getLastRow() === 0) {
    bookings.appendRow([
      'ref', 'date', 'start', 'package', 'price', 'parent', 'phone', 'email',
      'child', 'age', 'guests', 'notes', 'language', 'status', 'created', 'paid',
    ]);
    bookings.setFrozenRows(1);
  }

  return 'Exceptions and Bookings tabs are ready.';
}

/* ───────────────────────────── endpoints ───────────────────────────── */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === 'status') {
      return jsonOut(bookingStatus((params.ref || '').toString().trim()));
    }
    // The page posts reservations, but falls back to GET when a browser
    // refuses the cross-origin POST. Same handler either way.
    if (params.action === 'reserve') return jsonOut(reserve(params));
    // Default: the list of bookable slots.
    return jsonOut({ ok: true, packages: publicPackages(), slots: availableSlots() });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === 'paid') return jsonOut(markPaid(params));
    return jsonOut(reserve(params));
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

/* ──────────────────────────── slot reading ──────────────────────────── */

function availableSlots() {
  var taken = takenSlotKeys();
  var ex = readExceptions();
  var now = new Date();
  var earliest = new Date(now.getTime() + CONFIG.minNoticeHours * 3600 * 1000);
  var latest = new Date(now.getTime() + CONFIG.maxDaysAhead * 86400 * 1000);
  var out = [];
  var seen = {};

  for (var day = 0; day <= CONFIG.maxDaysAhead; day++) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
    var date = asDateString(d);
    if (ex.closedDates[date]) continue;

    // The usual week, plus any extra times opened for this date specifically.
    var times = (WEEKLY_SCHEDULE[d.getDay()] || []).concat(ex.extra[date] || []);

    for (var i = 0; i < times.length; i++) {
      var start = asTimeString(times[i]);
      if (!start) continue;

      var key = slotKey(date, start);
      if (ex.closedSlots[key] || taken[key]) continue;
      // A time can appear in both the pattern and the extras; offer it once.
      if (seen[key]) continue;

      var when = parseSlotDate(date, start);
      if (!when || when < earliest || when > latest) continue;

      seen[key] = true;
      out.push({ date: date, start: start, note: ex.notes[key] || '' });
    }
  }

  out.sort(function (a, b) {
    return a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date);
  });
  return out;
}

/**
 * The Exceptions tab, which overrides WEEKLY_SCHEDULE for particular dates:
 *
 *   action "close" with no start  — the whole date is closed
 *   action "close" with a start   — just that one slot is unavailable
 *   action "open"  with a start   — an extra slot not in the weekly pattern
 */
function readExceptions() {
  var rows = readSheet('Exceptions');
  var out = { closedDates: {}, closedSlots: {}, extra: {}, notes: {} };

  for (var i = 0; i < rows.length; i++) {
    var date = asDateString(rows[i][0]);
    if (!date) continue;
    var start = asTimeString(rows[i][1]);
    var action = (rows[i][2] || 'close').toString().trim().toLowerCase();
    var note = (rows[i][3] || '').toString().trim();

    if (action === 'open') {
      if (!start) continue;
      if (!out.extra[date]) out.extra[date] = [];
      out.extra[date].push(start);
      if (note) out.notes[slotKey(date, start)] = note;
    } else {
      // Anything that is not "open" closes: close, closed, blocked, x...
      if (start) out.closedSlots[slotKey(date, start)] = true;
      else out.closedDates[date] = true;
    }
  }
  return out;
}

/** Map of "date|start" for every slot currently spoken for. */
function takenSlotKeys() {
  var rows = readSheet('Bookings');
  var cutoff = new Date().getTime() - CONFIG.holdMinutes * 60 * 1000;
  var taken = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var status = (row[13] || '').toString().trim().toUpperCase();
    if (status === 'PAID') {
      taken[slotKey(asDateString(row[1]), asTimeString(row[2]))] = true;
    } else if (status === 'HOLD') {
      var created = row[14] instanceof Date ? row[14].getTime() : Date.parse(row[14]);
      if (created && created > cutoff) {
        taken[slotKey(asDateString(row[1]), asTimeString(row[2]))] = true;
      }
    }
  }
  return taken;
}

/* ───────────────────────────── reserving ───────────────────────────── */

function reserve(params) {
  var pkgKey = (params.package || '').toString().trim().toLowerCase();
  var pkg = PACKAGES[pkgKey];
  if (!pkg) return { ok: false, error: 'Unknown package' };

  var date = (params.date || '').toString().trim();
  var start = (params.start || '').toString().trim();
  var parent = (params.parent || '').toString().trim();
  var phone = (params.phone || '').toString().trim();
  if (!date || !start) return { ok: false, error: 'Missing slot' };
  if (!parent || !phone) return { ok: false, error: 'Missing name or phone' };

  var lock = LockService.getScriptLock();
  // Two people submitting the same slot at once must not both get it.
  if (!lock.tryLock(15000)) return { ok: false, error: 'Busy, please try again' };

  var ref;
  try {
    // A retry (or the GET fallback after a failed POST) must not collide with
    // the hold the first attempt already created. Same slot, same phone,
    // still within the hold window: hand back that booking.
    var mine = findLiveHold(date, start, phone);
    if (mine) {
      return {
        ok: true,
        ref: mine,
        price: pkg.price,
        holdMinutes: CONFIG.holdMinutes,
        payUrl: payUrlFor(pkg, mine),
      };
    }

    var slot = findOpenSlot(date, start);
    if (!slot) return { ok: false, error: 'SLOT_TAKEN' };

    ref = makeRef(date);
    SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName('Bookings').appendRow([
      ref,
      date,
      start,
      pkg.label,
      pkg.price,
      parent,
      phone,
      (params.email || '').toString().trim(),
      (params.child || '').toString().trim(),
      (params.age || '').toString().trim(),
      (params.guests || '').toString().trim(),
      (params.notes || '').toString().trim(),
      (params.language || 'en').toString().trim(),
      'HOLD',
      new Date(),
      '',
    ]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  notifyOwner(ref, date, start, pkg, parent, phone);

  return {
    ok: true,
    ref: ref,
    price: pkg.price,
    holdMinutes: CONFIG.holdMinutes,
    payUrl: payUrlFor(pkg, ref),
  };
}

/** Reference of a still-live HOLD for this slot placed by this phone number. */
function findLiveHold(date, start, phone) {
  var rows = readSheet('Bookings');
  var cutoff = new Date().getTime() - CONFIG.holdMinutes * 60 * 1000;

  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][13] || '').toString().trim().toUpperCase() !== 'HOLD') continue;
    if (asDateString(rows[i][1]) !== date) continue;
    if (asTimeString(rows[i][2]) !== start) continue;
    if ((rows[i][6] || '').toString().trim() !== phone) continue;
    var created = rows[i][14] instanceof Date ? rows[i][14].getTime() : Date.parse(rows[i][14]);
    if (created && created > cutoff) return (rows[i][0] || '').toString().trim();
  }
  return null;
}

function findOpenSlot(date, start) {
  var slots = availableSlots();
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].date === date && slots[i].start === start) return slots[i];
  }
  return null;
}

function payUrlFor(pkg, ref) {
  var url = (pkg.payUrl || '').toString().trim();
  if (!url || url.indexOf('PASTE_') === 0) return '';
  if (url.indexOf('{REF}') !== -1) return url.replace(/\{REF\}/g, encodeURIComponent(ref));
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ref=' + encodeURIComponent(ref);
}

function makeRef(date) {
  var suffix = Math.floor(1000 + Math.random() * 9000);
  return 'RKD-' + date.replace(/-/g, '').slice(2) + '-' + suffix;
}

function notifyOwner(ref, date, start, pkg, parent, phone) {
  if (!CONFIG.notifyEmail) return;
  try {
    MailApp.sendEmail(
      CONFIG.notifyEmail,
      'New birthday booking held: ' + date + ' ' + start + ' (' + pkg.label + ')',
      [
        'Reference: ' + ref,
        'Slot: ' + date + ' at ' + start,
        'Package: ' + pkg.label + ' — NIS ' + pkg.price,
        'Parent: ' + parent,
        'Phone: ' + phone,
        '',
        'The slot is held for ' + CONFIG.holdMinutes + ' minutes. It reopens by',
        'itself if payment does not come through.',
      ].join('\n'),
    );
  } catch (err) {
    // A failed alert must never cost the customer their booking.
  }
}

/* ─────────────────────────── payment status ─────────────────────────── */

/**
 * Flip a held booking to PAID. Called by your payment provider's webhook, or by
 * hand from the sheet. Guarded by a shared secret so a customer cannot mark
 * their own booking paid: in the Apps Script editor go to Project Settings >
 * Script properties and add WEBHOOK_TOKEN with a long random value, then have
 * the webhook post token=<that value>&ref=<booking ref>&action=paid.
 */
function markPaid(params) {
  var expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');
  if (!expected || (params.token || '') !== expected) return { ok: false, error: 'Unauthorized' };

  var ref = (params.ref || '').toString().trim();
  if (!ref) return { ok: false, error: 'Missing ref' };

  var sheet = SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName('Bookings');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString().trim() === ref) {
      sheet.getRange(i + 1, 14).setValue('PAID');
      sheet.getRange(i + 1, 16).setValue(new Date());
      return { ok: true, ref: ref };
    }
  }
  return { ok: false, error: 'Unknown ref' };
}

function bookingStatus(ref) {
  if (!ref) return { ok: false, error: 'Missing ref' };
  var rows = readSheet('Bookings');
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').toString().trim() === ref) {
      return {
        ok: true,
        ref: ref,
        date: asDateString(rows[i][1]),
        start: asTimeString(rows[i][2]),
        package: (rows[i][3] || '').toString(),
        status: (rows[i][13] || '').toString().trim().toUpperCase(),
      };
    }
  }
  return { ok: false, error: 'Unknown ref' };
}

/**
 * Optional tidiness: mark timed-out holds as EXPIRED so the Bookings tab reads
 * cleanly. Availability already ignores them, so this is cosmetic — attach it
 * to an hourly time-driven trigger only if you want it.
 */
function releaseExpiredHolds() {
  var sheet = SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName('Bookings');
  var rows = sheet.getDataRange().getValues();
  var cutoff = new Date().getTime() - CONFIG.holdMinutes * 60 * 1000;

  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][13] || '').toString().trim().toUpperCase() !== 'HOLD') continue;
    var created = rows[i][14] instanceof Date ? rows[i][14].getTime() : Date.parse(rows[i][14]);
    if (created && created <= cutoff) sheet.getRange(i + 1, 14).setValue('EXPIRED');
  }
}

/* ───────────────────────────── helpers ───────────────────────────── */

function readSheet(name) {
  var sheet = SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function publicPackages() {
  var out = {};
  Object.keys(PACKAGES).forEach(function (key) {
    out[key] = {
      label: PACKAGES[key].label,
      labelHe: PACKAGES[key].labelHe,
      price: PACKAGES[key].price,
      maxGuests: PACKAGES[key].maxGuests,
    };
  });
  return out;
}

function parsePackages(value) {
  // Blank means the slot takes any package.
  var raw = (value || '').toString().trim().toLowerCase();
  if (!raw) return [];
  return raw.split(/[,\s]+/).filter(function (p) {
    return PACKAGES.hasOwnProperty(p);
  });
}

function slotKey(date, start) {
  return date + '|' + start;
}

/** Sheets may hand back a real Date or whatever text was typed. Accept both. */
function asDateString(value) {
  if (value instanceof Date) return Utilities.formatDate(value, CONFIG.timezone, 'yyyy-MM-dd');
  var text = (value || '').toString().trim();
  var m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  var dmy = text.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/); // 16/10/2026
  if (dmy) return dmy[3] + '-' + pad(dmy[2]) + '-' + pad(dmy[1]);
  return '';
}

function asTimeString(value) {
  if (value instanceof Date) return Utilities.formatDate(value, CONFIG.timezone, 'HH:mm');
  var m = (value || '').toString().trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? pad(m[1]) + ':' + m[2] : '';
}

function parseSlotDate(date, start) {
  var d = date.split('-');
  var t = start.split(':');
  if (d.length !== 3 || t.length < 2) return null;
  // Built in the script's timezone, which CONFIG.timezone should match.
  return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), Number(t[0]), Number(t[1]));
}

function pad(n) {
  return ('0' + n).slice(-2);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
