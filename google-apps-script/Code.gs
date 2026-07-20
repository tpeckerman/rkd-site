/**
 * RKD Tournament sign-up backend.
 *
 * Deploy this as a standalone Google Apps Script Web App (Deploy > New deployment >
 * Web app > Execute as: Me > Who has access: Anyone). See ../TOURNAMENT_SETUP.md
 * for the full walkthrough. Copy the deployed /exec URL into GOOGLE_SCRIPT_URL in
 * js/forms.js.
 *
 * Each form submission POSTs a "form" value ("signup" or "updates") plus "name"
 * and "phone" (the "updates" form also sends "age" and "gender"). Rows are
 * appended below the existing header row, so data always starts on row 2.
 *
 *   signup  sheet columns:  A name | B phone
 *   updates sheet columns:  A name | B phone | C age | D gender
 */

var SHEETS = {
  signup: '1qlJveRbuwZ-T7xdl100IuIxW6H5BysKNAlv4L4gah9M',   // Adult Men's Air Hockey Tournament sign-ups
  updates: '1Fj5wxpUvVdI4EQ0Jr8BnvDnYhUvtL6nVH1BZTvFS3vg',  // "Notify me about future tournaments" list
};

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    var form = params.form;
    var name = (params.name || '').toString().trim();
    var phone = (params.phone || '').toString().trim();

    if (!Object.prototype.hasOwnProperty.call(SHEETS, form)) {
      return jsonOutput({ ok: false, error: 'Unknown form' });
    }
    if (!name || !phone) {
      return jsonOutput({ ok: false, error: 'Missing name or phone' });
    }

    var row = [name, phone];
    if (form === 'updates') {
      var age = (params.age || '').toString().trim();
      var gender = (params.gender || '').toString().trim();
      row.push(age, gender);
    }

    var sheet = SpreadsheetApp.openById(SHEETS[form]).getSheets()[0];
    sheet.appendRow(row);

    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
