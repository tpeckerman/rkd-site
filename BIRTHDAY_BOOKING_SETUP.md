# Online birthday booking: setup

`book.html` (and `he/book.html`) lets a parent pick a package, pick one of the
slots **you** opened, and pay to confirm — no back-and-forth on WhatsApp.

The whole thing runs on Google Sheets and Apps Script, which cost nothing. The
only money you spend is your payment provider's cut of each payment.

**Where the moving parts live:**

| Piece | File | What it does |
|---|---|---|
| Closures + extra slots | a Google Sheet you create | Your control panel |
| Backend | `google-apps-script/Booking.gs` | Holds the weekly schedule, serves open slots, records bookings |
| Booking page | `book.html`, `he/book.html` | What the customer sees |
| Page logic | `js/booking.js` | Talks to the backend |

Steps 1–3 are done and live. Step 4 (payments) is optional — see *Going live
before you have a payment link* at the bottom.

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
   Authorize it when Google asks. This creates the `Exceptions` and `Bookings`
   tabs with their headers and three example rows (delete them once you've seen
   the format).
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
amount: one for NIS 450 (Basic), one for NIS 750 (VIP). Whichever provider you use, create
both links and paste them into the `PACKAGES` block near the top of
`Booking.gs`:

```js
basic: { ..., payUrl: 'https://your-provider.example/pay/abc123' },
vip:   { ..., payUrl: 'https://your-provider.example/pay/def456' },
```

If the provider lets you pass your own reference through the link, put `{REF}`
where it belongs and the booking reference is substituted in. Otherwise the
reference is appended as `?ref=RKD-...` automatically, so the payment can be
matched to the right row.

After editing the script, redeploy with **Deploy → Manage deployments → (pencil
icon) → Version: New version → Deploy**. That keeps the same `/exec` URL, so
you never touch `js/booking.js` again. A plain save in the editor does *not*
update the live version.

### Marking bookings paid automatically

A new booking lands as `HOLD`. Wire up the provider's callback and it becomes
`PAID` on its own.

1. In the Apps Script editor: **Project Settings → Script properties → Add
   script property**. Name it `WEBHOOK_TOKEN`, value a long random string.
2. In your provider, set the payment link's **notifyUrl** (Grow calls this the
   server-to-server callback) to your `/exec` URL with two things on the end:

   ```
   https://script.google.com/macros/s/.../exec?action=paycallback&token=YOUR_TOKEN
   ```

   The token both routes the request and proves it came from you. With Grow,
   webhooks have to be switched on by their support team first.

Nothing in the handler depends on a particular provider's field names. Every
callback is written to a **Payments** tab exactly as it arrived, the booking
reference is recognised by its shape (`RKD-nnnnnn-nnnn`) anywhere in the
payload, and a booking is marked `PAID` only on an explicit success signal.
If a callback arrives in a shape it does not recognise, the booking stays
`HOLD` and you get an email — it will never assume a party was paid for.

That last part matters on the first real payment: check the Payments tab, see
what your provider actually sent, and tell me if the status field wasn't
recognised. It is a one-line change to teach it.

Without a callback, open the `Bookings` tab when the money lands and type
`PAID` in the status column. At a few parties a week that takes seconds.

Either way, **set the payment provider's success/return URL** to
`https://rkdzichron.com/book.html?paid=1` so customers land back on your site
with a thank-you.

## Your weekly schedule

Slots come from a fixed weekly pattern, so a normal week needs no upkeep at
all:

| Day | Start times |
|---|---|
| Sunday – Thursday | 14:00, 16:00, 18:00 |
| Friday | 11:00, 13:00 |
| Saturday | 11:00, 13:00, 15:00, 17:00 |

A customer picks a date, sees the times still open that day, and picks one.
**Times that are already booked simply aren't offered.**

To change the pattern itself, edit `WEEKLY_SCHEDULE` at the top of
`Booking.gs` and redeploy (**Deploy → Manage deployments → pencil → New
version**). The keys are days of the week, `0` for Sunday through `6` for
Saturday; leave a day out to offer nothing that day.

## One-off changes: the Exceptions tab

Anything that deviates from the usual week goes in the **Exceptions** tab, and
takes effect immediately — nothing to redeploy or push.

| date | start | action | note |
|---|---|---|---|
| `2026-10-16` | | `close` | closed all day — private event |
| `2026-10-17` | `16:00` | `close` | just this one time is unavailable |
| `2026-10-18` | `20:00` | `open` | extra late slot |

- **`close` with no start** — shuts the whole date.
- **`close` with a start** — removes just that one time.
- **`open` with a start** — adds a time that isn't in the weekly pattern.
- **note** — optional; on an `open` row it shows under the time on the button.
  It appears exactly as you type it on both the English and Hebrew pages.

Dates are `YYYY-MM-DD` (a real date cell works too) and times are 24-hour
`HH:MM`.

**Space your pattern by at least the party length.** Every party is 1 hour of
private access, and the system does not know how long you need between parties
to reset. The times above leave a 2-hour gap; if you tighten them, remember
both slots can sell.

## How a booking actually goes

1. Parent picks a package, then a date, then one of the times still open
   that day, then fills in their details.
2. The slot is **held for 20 minutes** (`CONFIG.holdMinutes`) and a `HOLD` row
   appears in `Bookings`. You get an email.
3. They're sent to the payment link for that package.
4. Payment lands → the row becomes `PAID` (webhook, or you type it) and the
   slot is gone for good.
5. If they never pay, the hold expires on its own and the slot quietly comes
   back. Nothing to clean up.

Two people clicking the same slot at the same second is handled — the second
one is told the slot just went and gets a refreshed list.

If a browser refuses the cross-origin POST the page retries the reservation as
a GET, which the backend accepts too. That retry is safe: re-sending the same
slot from the same phone number returns the booking already made rather than
making a second one.

## Things worth knowing

- **Slots are hidden inside 24 hours** (`CONFIG.minNoticeHours`) so nobody
  books a party for tonight. Raise or lower it to taste.
- **A booked time stops being offered** the moment it is held, and comes back
  by itself if the hold expires unpaid.
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

Package contents and prices come from the RKD B-DAY flyer: Basic NIS 450 for up
to 16 people, VIP NIS 750 for up to 20 with unlimited claw machine and a
giveaway package. Both run 1 hour of private access. The recommended age is
6 and up.

Prices live in two places that must agree — the `PACKAGES` block in
`Booking.gs` (what the customer is charged) and the package cards in
`book.html` / `he/book.html` (what they're shown). Change one, change the
other.
