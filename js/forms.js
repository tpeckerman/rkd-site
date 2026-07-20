(function () {
  // Paste the Apps Script Web App /exec URL (see TOURNAMENT_SETUP.md) here.
  var GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyosQlkAi2HfQHAffj_xqSBpuq-DumHU4KLzrnHl3n0kXSs3ISCEyliiKquXxkxkF-Czg/exec';

  function setupToggle(buttonId, wrapId) {
    var btn = document.getElementById(buttonId);
    var wrap = document.getElementById(wrapId);
    if (!btn || !wrap) return;

    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function () {
      var isOpen = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        setTimeout(function () {
          wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 200);
      }
    });
  }

  function setupForm(formId, msgId, formName) {
    var form = document.getElementById(formId);
    if (!form) return;
    var msg = document.getElementById(msgId);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var data = { form: formName };
      new FormData(form).forEach(function (value, key) {
        data[key] = value;
      });

      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      msg.textContent = '';
      msg.className = 'form-msg';

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(data),
      })
        .then(function () {
          msg.textContent = 'Thanks! We’ll be in touch.';
          msg.className = 'form-msg success';
          form.reset();
        })
        .catch(function () {
          msg.textContent = 'Something went wrong. Please try again or message us on WhatsApp.';
          msg.className = 'form-msg error';
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupToggle('open-updates-form', 'updates-form-wrap');
    setupForm('updates-form', 'updates-form-msg', 'updates');

    setupToggle('open-signup-form', 'signup-form-wrap');
    setupForm('signup-form', 'signup-form-msg', 'signup');
  });
})();
