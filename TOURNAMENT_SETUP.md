# Tournament sign-up: connecting the forms to Google Sheets

The Tournament tab (`tournament.html`) and the air hockey sign-up page
(`air-hockey.html`) both submit their forms to one Google Apps Script Web
App, which appends a row to the right spreadsheet. This is a one-time manual
setup — Google doesn't allow scripted deployment from outside its UI, so
these steps have to be done by hand once.

**This is also the reason submissions aren't reaching the spreadsheet yet:**
the code currently has a placeholder in place of a real deployed URL. Once
you complete the steps below and paste in the real URL, submissions will
start showing up.

## 1. Deploy the script

1. Open either spreadsheet:
   - Sign-ups (air hockey tournament): https://docs.google.com/spreadsheets/d/1qlJveRbuwZ-T7xdl100IuIxW6H5BysKNAlv4L4gah9M/edit
   - Updates (general "notify me" list): https://docs.google.com/spreadsheets/d/1Fj5wxpUvVdI4EQ0Jr8BnvDnYhUvtL6nVH1BZTvFS3vg/edit
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

## 2. Wire the URL into the site

Open `js/forms.js` and replace:

```js
var GOOGLE_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

with your real `/exec` URL, then commit and push. Both `tournament.html` and
`air-hockey.html` share this one file, so this is the only place it needs to
be pasted.

## Sheet columns

- **Sign-up sheet** (air hockey tournament entries): `A` name, `B` phone.
- **Updates sheet** (general tournament-interest list): `A` name, `B` phone,
  `C` age, `D` gender.

Rows always append below the existing header row, so data starts on row 2 as
requested. Visitors never see the spreadsheet — only the form. The sheet
stays private; the script runs under your Google account's permissions.

## Notes

- If you ever edit the script after the initial deploy, use **Deploy → Manage
  deployments → Edit → New version** so the same `/exec` URL keeps working.
- The air hockey tournament page used to live in a separate repo/site
  (`rkd-air-hockey`, built with Lovable). It's now folded into this repo as
  a plain page (`air-hockey.html`) so the whole site deploys from one place.
  The old Lovable project isn't linked from the site anymore and can be
  left alone or deleted at your discretion.
