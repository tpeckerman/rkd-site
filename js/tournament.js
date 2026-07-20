(function () {
  // Paste the Apps Script Web App /exec URL from google-apps-script/Code.gs here.
  var GOOGLE_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

  var overlay = document.getElementById('updates-modal');
  var openBtn = document.getElementById('open-updates-modal');
  var closeBtn = document.getElementById('close-updates-modal');
  var form = document.getElementById('updates-form');
  var msg = document.getElementById('updates-form-msg');

  function openModal() {
    if (overlay) overlay.classList.add('open');
  }
  function closeModal() {
    if (overlay) overlay.classList.remove('open');
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameEl = document.getElementById('updates-name');
      var phoneEl = document.getElementById('updates-phone');
      var name = nameEl.value.trim();
      var phone = phoneEl.value.trim();
      if (!name || !phone) return;

      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      msg.textContent = '';
      msg.className = 'form-msg';

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({ form: 'updates', name: name, phone: phone }),
      })
        .then(function () {
          msg.textContent = 'Thanks! We’ll be in touch.';
          msg.className = 'form-msg success';
          form.reset();
          setTimeout(closeModal, 1800);
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
})();
