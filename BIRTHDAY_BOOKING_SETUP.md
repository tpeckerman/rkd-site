# Online birthday booking: setup

`book.html` (and `he/book.html`) lets a parent pick a package, pick one of the
slots **you** opened, and pay to confirm — no back-and-forth on WhatsApp.

The whole thing runs on Google Sheets and Apps Script, which cost nothing. The
only money you spend is your payment provider's cut of each payment.

**Where the moving parts live:**

| Piece | File | What it does |
|---|---|---|
| Slot list + bookings | a Google Sheet you create | Your control panel |
| Backend | `google-apps-script/Booking.gs` | Serves open slots, holds a slot, records the booking |
| Booking page | `book.html`, `he/book.html` | What the customer sees |
| Page logic | `js/booking.js` | Talks to the backend |

Until you finish steps 1–3 the page loads but can't show slots. Step 4
(payments) is optional at first — see *Going live before you have a payment
link* at the bottom.

## 1. Create the spreadsheet

1. Make a new Google Sheet and name it something like **RKD Birthday
   Bookings**.
2. Copy its id out of the URL — the long code between `/d/` and `/edit`:
   `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## 2. Deploy the backend

This is a **separate** Apps Script project from the tournament one in
`TOURNAMENT_SETUP.md`. Both files define a `doPost()` function, and two of
those cannot live in the same project.

1. In your new spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder code, paste in all of
   [`google-apps-script/Booking.gs`](google-apps-script/Booking.gs).
3. At the top of the file, fill in `CONFIG.sheetId` with the id from step 1.
   While you're there, set `notifyEmail` to your address so you get an email
   the moment someone books.
4. In the toolbar, pick the function **setupBookingSheet** and press **Run**.
   Authorize it when Google asks. This creates the `Slots` and `Bookings` tabs
   with their headers and three example slots.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

## 3. Wire the URL into the site

Open `js/booking.js` and replace:

```js
var BOOKING_SCRIPT_URL = 'PASTE_YOUR_BOOKING_APPS_SCRIPT_WEB_APP_URL_HERE';
```

with your real `/exec` URL, then commit and push. Both `book.html` and
`he/book.html` share this one file, so it only goes in once.

## 4. Connect payments

You need **one payment link per package**, because payment links carry a fixed
amount: one for NIS 450, one for NIS 650. Whichever provider you use, create
both links and paste them into the `PACKAGES` block near the top of
`Booking.gs`:

```js
standard: { ..., payUrl: 'https://your-provider.example/pay/abc123' },
vip:      { ..., payUrl: 'https://your-provider.example/pay/def456' },
```

If the provider lets you pass your own reference through the link, put `{REF}`
where it belongs and the booking reference is substituted in. Otherwise the
reference is appended as `?ref=RKD-...` automatically, so the payment can be
matched to the right row.

After editing the script, redeploy with **Deploy → Manage deployments → (pencil
icon) → Version: New version → Deploy**. That keeps the same `/exec` URL, so
you never touch `js/booking.js` again. A plain save in the editor does *not*
update the live version.

### Marking bookings paid automatically (optional)

A new booking lands as `HOLD`. It becomes `PAID` when someone says so.

The reliable way is a webhook, if your provider supports one:

1. In the Apps Script editor: **Project Settings → Script properties → Add
   script property**. Name it `WEBHOOK_TOKEN`, value a long random string.
2. Point your provider's webhook at your `/exec` URL, posting
   `action=paid`, `token=<your token>`, and `ref=<the booking reference>`.

Without a webhook, just open the `Bookings` tab when the money lands and type
`PAID` in the status column. At a few parties a week that takes seconds.

Either way, **set the payment provider's success/return URL** to
`https://rkdzichron.com/book.html?paid=1` so customers land back on your site
with a thank-you.

## Opening and closing slots

This is the part you'll actually use week to week. Go to the **Slots** tab and
add a row per slot you want to offer:

| date | start | status | packages | note |
|---|---|---|---|---|
| `2026-10-16` | `16:00` | `open` | | Friday afternoon |
| `2026-10-16` | `18:00` | `open` | `standard` | short evening slot |
| `2026-10-17` | `11:00` | `closed` | | |

- **date** — `YYYY-MM-DD`. A real date cell works too.
- **start** — 24-hour `HH:MM`.
- **status** — `open` to offer it. Anything else (`closed`, `held`) hides it.
- **packages** — leave blank to accept either package. Put `standard` to block
  VIP from a slot that can't run the full 1.5 hours.
- **note** — optional, shows under the time on the button. It appears exactly
  as you type it on both the English and Hebrew pages, so keep it short or
  write it in whichever language most of your customers read.

Changes take effect immediately; there's nothing to redeploy or push.

**Space your slots for the longest package you allow in them.** The system does
not know a VIP party runs 1.5 hours — if you open 16:00 and 17:00 and let VIP
into both, you can sell yourself an overlap. Either space them far enough
apart, or mark the tight ones `standard`.

## How a booking actually goes

1. Parent picks a package, then a slot, then fills in their details.
2. The slot is **held for 20 minutes** (`CONFIG.holdMinutes`) and a `HOLD` row
   appears in `Bookings`. You get an email.
3. They're sent to the payment link for that package.
4. Payment lands → the row becomes `PAID` (webhook, or you type it) and the
   slot is gone for good.
5. If they never pay, the hold expires on its own and the slot quietly comes
   back. Nothing to clean up.

Two people clicking the same slot at the same second is handled — the second
one is told the slot just went and gets a refreshed list.

## Things worth knowing

- **Slots are hidden inside 24 hours** (`CONFIG.minNoticeHours`) so nobody
  books a party for tonight. Raise or lower it to taste.
- **Only 120 days ahead are shown** (`CONFIG.maxDaysAhead`).
- **The `Bookings` tab is your record.** Never delete a `PAID` row for a party
  that hasn't happened — that frees the slot for someone else to book.
- **Expired holds** stay in the sheet as `HOLD` rows. They're ignored for
  availability, so this is only cosmetic; if the clutter bothers you, attach
  `releaseExpiredHolds` to an hourly time-driven trigger and they'll be
  relabelled `EXPIRED`.
- **Cancellations:** set the row's status to `CANCELLED` and the slot reopens.

## Going live before you have a payment link

The page works with `payUrl` still unset. Instead of a Pay button, the customer
is shown their booking reference and asked to WhatsApp it to you, and you send
a payment request by hand. The slot picker, the hold, and the record-keeping all
still work — so you can put this live now and add the payment link later without
touching the front-end.

## Before you publish

- **Confirm what the VIP package includes.** The NIS 650 feature list is
  marked with an `EDIT ME` comment in both `book.html` and `he/book.html` — the
  two lists must say the same thing. It's also summarised on `birthday.html`
  and `he/birthday.html`.
- Your party page says *full payment is required to confirm your reservation*
  and *cancellations 48 hours ahead are refunded minus NIS 100*. The booking
  flow charges the full amount, which matches — but re-read both pages once
  with the new VIP price in mind.
