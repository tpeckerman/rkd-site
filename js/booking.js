(function () {
  // Paste the /exec URL of the Booking.gs Web App here. This is a DIFFERENT
  // deployment from the one in js/forms.js — see BIRTHDAY_BOOKING_SETUP.md.
  var BOOKING_SCRIPT_URL = 'PASTE_YOUR_BOOKING_APPS_SCRIPT_WEB_APP_URL_HERE';

  var WHATSAPP_URL = 'https://wa.me/972555002413';

  var isHebrew = document.documentElement.lang === 'he';

  var T = {
    loading:      isHebrew ? 'טוען מועדים פנויים…' : 'Loading available slots…',
    chooseFirst:  isHebrew ? 'בחרו חבילה כדי לראות מועדים פנויים.' : 'Choose a package to see the available slots.',
    none:         isHebrew ? 'אין כרגע מועדים פנויים לחבילה הזו. שלחו לנו הודעה בוואטסאפ ונמצא לכם תאריך.'
                           : 'No open slots for this package right now. Message us on WhatsApp and we’ll find you a date.',
    failed:       isHebrew ? 'לא הצלחנו לטעון את המועדים. רעננו את הדף או שלחו לנו הודעה בוואטסאפ.'
                           : 'We couldn’t load the slots. Refresh the page or message us on WhatsApp.',
    slotTaken:    isHebrew ? 'המועד הזה נתפס בינתיים. בחרו מועד אחר — הרשימה עודכנה.'
                           : 'That slot was just taken. Please pick another — the list has been refreshed.',
    error:        isHebrew ? 'משהו השתבש. נסו שוב או שלחו לנו הודעה בוואטסאפ.'
                           : 'Something went wrong. Please try again or message us on WhatsApp.',
    missingSlot:  isHebrew ? 'בחרו חבילה ומועד לפני המשך.' : 'Please choose a package and a slot first.',
    holding:      isHebrew ? 'שומרים לכם את המועד…' : 'Holding your slot…',
    heldFor:      isHebrew ? 'המועד שמור לכם עוד' : 'Your slot is held for',
    minutes:      isHebrew ? 'דקות' : 'minutes',
    expired:      isHebrew ? 'ההמתנה הסתיימה והמועד שוחרר. אפשר להזמין שוב.'
                           : 'The hold expired and the slot was released. You can book again.',
    payNow:       isHebrew ? 'לתשלום ולסיום ההזמנה' : 'Pay now to confirm',
    payManual:    isHebrew ? 'שלחו לנו את מספר ההזמנה בוואטסאפ ונשלח לכם קישור לתשלום.'
                           : 'Send us your booking reference on WhatsApp and we’ll send you a payment link.',
    bookAgain:    isHebrew ? 'להזמנה נוספת' : 'Book another slot',
    paidThanks:   isHebrew ? 'תודה! ההזמנה שלכם התקבלה. נתראה ב-RKD! 🎉'
                           : 'Thank you! Your booking is confirmed. See you at RKD! 🎉',
  };

  var state = { slots: [], pkg: null, slot: null, holdTimer: null };

  var els = {};

  /* ───────────────────────────── loading ───────────────────────────── */

  function loadSlots() {
    setSlotStatus(T.loading);
    return fetch(BOOKING_SCRIPT_URL + (BOOKING_SCRIPT_URL.indexOf('?') === -1 ? '?' : '&') + 'action=slots')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) throw new Error(data && data.error);
        state.slots = data.slots || [];
        renderSlots();
      })
      .catch(function () {
        state.slots = [];
        setSlotStatus(T.failed, 'error');
      });
  }

  /* ──────────────────────────── rendering ──────────────────────────── */

  function slotsForPackage() {
    return state.slots.filter(function (slot) {
      // An empty packages list means the slot takes either package.
      return !slot.packages || !slot.packages.length || slot.packages.indexOf(state.pkg) !== -1;
    });
  }

  function renderSlots() {
    els.slotGroups.innerHTML = '';
    if (!state.pkg) {
      setSlotStatus(T.chooseFirst);
      return;
    }

    var slots = slotsForPackage();
    if (!slots.length) {
      setSlotStatus(T.none);
      return;
    }
    setSlotStatus('');

    // One block per date, so a day with four slots reads as a day.
    var byDate = {};
    var order = [];
    slots.forEach(function (slot) {
      if (!byDate[slot.date]) { byDate[slot.date] = []; order.push(slot.date); }
      byDate[slot.date].push(slot);
    });

    order.forEach(function (date) {
      var group = document.createElement('div');
      group.className = 'slot-group';

      var heading = document.createElement('div');
      heading.className = 'slot-date';
      heading.textContent = formatDate(date);
      group.appendChild(heading);

      var times = document.createElement('div');
      times.className = 'slot-times';
      byDate[date].forEach(function (slot) {
        times.appendChild(buildSlotButton(slot));
      });
      group.appendChild(times);

      els.slotGroups.appendChild(group);
    });
  }

  function buildSlotButton(slot) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn';
    btn.dataset.date = slot.date;
    btn.dataset.start = slot.start;

    var time = document.createElement('span');
    time.className = 'slot-time';
    time.textContent = slot.start;
    btn.appendChild(time);

    if (slot.note) {
      var note = document.createElement('span');
      note.className = 'slot-note';
      note.textContent = slot.note;
      btn.appendChild(note);
    }

    btn.addEventListener('click', function () {
      state.slot = slot;
      els.slotGroups.querySelectorAll('.slot-btn').forEach(function (b) {
        b.classList.toggle('selected', b === btn);
      });
      unlock(els.stepDetails);
      els.stepDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      updateSummary();
    });

    return btn;
  }

  function updateSummary() {
    if (!els.summary) return;
    if (!state.pkg || !state.slot) {
      els.summary.textContent = '';
      return;
    }
    var input = document.querySelector('input[name="package"][value="' + state.pkg + '"]');
    var price = input ? input.dataset.price : '';
    var name = input ? input.dataset.label : state.pkg;
    els.summary.textContent =
      formatDate(state.slot.date) + ' · ' + state.slot.start + ' · ' + name + ' · ₪' + price;
  }

  function formatDate(date) {
    var parts = date.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  function setSlotStatus(text, kind) {
    els.slotStatus.textContent = text;
    els.slotStatus.className = 'booking-note' + (kind ? ' ' + kind : '');
  }

  function unlock(step) { if (step) step.classList.remove('is-locked'); }
  function lock(step) { if (step) step.classList.add('is-locked'); }

  /* ──────────────────────────── reserving ──────────────────────────── */

  function submitBooking(e) {
    e.preventDefault();
    if (!state.pkg || !state.slot) {
      setFormMsg(T.missingSlot, 'error');
      return;
    }
    if (!els.form.reportValidity()) return;

    var data = {
      action: 'reserve',
      package: state.pkg,
      date: state.slot.date,
      start: state.slot.start,
      language: isHebrew ? 'he' : 'en',
    };
    new FormData(els.form).forEach(function (value, key) { data[key] = value; });

    els.submitBtn.disabled = true;
    setFormMsg(T.holding);

    fetch(BOOKING_SCRIPT_URL, { method: 'POST', body: new URLSearchParams(data) })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result && result.ok) {
          showPayStep(result);
          return;
        }
        if (result && result.error === 'SLOT_TAKEN') {
          setFormMsg(T.slotTaken, 'error');
          state.slot = null;
          lock(els.stepDetails);
          return loadSlots();
        }
        setFormMsg(T.error, 'error');
      })
      .catch(function () { setFormMsg(T.error, 'error'); })
      .finally(function () { els.submitBtn.disabled = false; });
  }

  function showPayStep(result) {
    setFormMsg('');
    els.form.reset();
    lock(els.stepPackage);
    lock(els.stepSlot);
    lock(els.stepDetails);
    unlock(els.stepPay);
    els.stepPay.hidden = false;

    els.payRef.textContent = result.ref;
    els.paySummary.textContent =
      formatDate(state.slot.date) + ' · ' + state.slot.start + ' · ₪' + result.price;

    if (result.payUrl) {
      els.payBtn.href = result.payUrl;
      els.payBtn.hidden = false;
      els.payManual.hidden = true;
    } else {
      // No payment link configured yet — fall back to finishing on WhatsApp so
      // the booking still completes.
      els.payBtn.hidden = true;
      els.payManual.hidden = false;
      els.payManualLink.href =
        WHATSAPP_URL + '?text=' + encodeURIComponent('Booking ' + result.ref);
    }

    startHoldCountdown(result.holdMinutes || 20);
    els.stepPay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function startHoldCountdown(minutes) {
    var deadline = Date.now() + minutes * 60 * 1000;
    clearInterval(state.holdTimer);

    function tick() {
      var left = deadline - Date.now();
      if (left <= 0) {
        clearInterval(state.holdTimer);
        els.payCountdown.textContent = T.expired;
        els.payBtn.hidden = true;
        return;
      }
      var mins = Math.floor(left / 60000);
      var secs = Math.floor((left % 60000) / 1000);
      els.payCountdown.textContent =
        T.heldFor + ' ' + mins + ':' + ('0' + secs).slice(-2) + ' ' + T.minutes;
    }

    tick();
    state.holdTimer = setInterval(tick, 1000);
  }

  function setFormMsg(text, kind) {
    els.formMsg.textContent = text;
    els.formMsg.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  /* ───────────────────────────── startup ───────────────────────────── */

  function init() {
    els.slotStatus = document.getElementById('slot-status');
    els.slotGroups = document.getElementById('slot-groups');
    els.stepPackage = document.getElementById('step-package');
    els.stepSlot = document.getElementById('step-slot');
    els.stepDetails = document.getElementById('step-details');
    els.stepPay = document.getElementById('step-pay');
    els.form = document.getElementById('booking-form');
    els.formMsg = document.getElementById('booking-form-msg');
    els.summary = document.getElementById('booking-summary');
    els.payRef = document.getElementById('pay-ref');
    els.paySummary = document.getElementById('pay-summary');
    els.payCountdown = document.getElementById('pay-countdown');
    els.payBtn = document.getElementById('pay-btn');
    els.payManual = document.getElementById('pay-manual');
    els.payManualLink = document.getElementById('pay-manual-link');
    if (!els.form) return;
    els.submitBtn = els.form.querySelector('button[type="submit"]');

    els.payManual.textContent = T.payManual + ' ';
    els.payManual.appendChild(els.payManualLink);

    // Returning from the payment provider's success redirect.
    if (/[?&]paid=1/.test(window.location.search)) {
      var banner = document.getElementById('paid-banner');
      banner.textContent = T.paidThanks;
      banner.hidden = false;
    }

    document.querySelectorAll('input[name="package"]').forEach(function (input) {
      input.addEventListener('change', function () {
        state.pkg = input.value;
        state.slot = null;
        document.querySelectorAll('.pkg-card').forEach(function (card) {
          card.classList.toggle('selected', card.contains(input));
        });
        unlock(els.stepSlot);
        lock(els.stepDetails);
        renderSlots();
        updateSummary();
      });
    });

    els.form.addEventListener('submit', submitBooking);
    loadSlots();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
