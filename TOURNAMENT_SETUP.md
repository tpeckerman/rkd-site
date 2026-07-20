# Tournament sign-up: connecting the forms to Google Sheets

The Tournament tab (`tournament.html`) and the air hockey sign-up page
(`rkd-air-hockey` repo) both submit their "name + phone" forms to one Google
Apps Script Web App, which appends a row to the right spreadsheet. This is a
one-time manual setup (Google doesn't allow scripted deployment from outside
its UI).

## 1. Deploy the script

1. Open either spreadsheet:
   - Sign-ups: https://docs.google.com/spreadsheets/d/1qlJveRbuwZ-T7xdl100IuIxW6H5BysKNAlv4L4gah9M/edit
   - Updates: https://docs.google.com/spreadsheets/d/1Fj5wxpUvVdI4EQ0Jr8BnvDnYhUvtL6nVH1BZTvFS3vg/edit
2. In either one, go to **Extensions → Apps Script**.
3. Delete the placeholder code and paste in the contents of
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs) from this repo.
   (It's a standalone script — it references both spreadsheet IDs directly,
   so it doesn't matter which sheet you opened it from.)
4. Click **Deploy → New deployment**.
5. Type: **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, authorize the script when prompted (it needs edit access
   to both spreadsheets — grant access with the Google account that owns
   them).
7. Copy the **Web app URL** it gives you (ends in `/exec`).

## 2. Wire the URL into both sites

Paste that URL into:
- `rkd-site/js/tournament.js` — replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`
- `rkd-air-hockey/src/routes/index.tsx` — replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`

Commit and redeploy both sites after pasting the URL.

## Notes

- Each submission sends a `form` field (`"signup"` or `"updates"`) so the
  single script knows which spreadsheet to append to.
- Rows always append below the existing header row, so data starts on row 2
  as requested — column A is name, column B is phone.
- Visitors never see the spreadsheet — only the form. The sheet stays private;
  the script runs under your Google account's permissions.
- If you ever edit the script after the initial deploy, use **Deploy → Manage
  deployments → Edit → New version** so the same `/exec` URL keeps working.
