(function () {
  var LANG_KEY = 'rkd_lang';
  var currentLang = localStorage.getItem(LANG_KEY) || 'en';

  function applyLang(lang) {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      el.innerHTML = el.getAttribute('data-' + lang) || '';
    });
    document.body.classList.toggle('rtl', lang === 'he');
    document.documentElement.lang = lang === 'he' ? 'he' : 'en';
    var toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.textContent = lang === 'en' ? 'עברית' : 'English';
    localStorage.setItem(LANG_KEY, lang);
    currentLang = lang;
  }

  window.toggleLang = function () {
    applyLang(currentLang === 'en' ? 'he' : 'en');
  };

  window.toggleNav = function () {
    var links = document.getElementById('nav-links');
    if (links) links.classList.toggle('open');
  };

  function initImages() {
    document.querySelectorAll('.img-slot').forEach(function (wrap) {
      var img = wrap.querySelector('img');
      var placeholder = wrap.querySelector('.img-placeholder');
      if (!img || !placeholder) return;

      img.style.display = 'none';
      placeholder.style.display = 'flex';

      img.addEventListener('load', function () {
        img.style.display = 'block';
        placeholder.style.display = 'none';
      });
      img.addEventListener('error', function () {
        img.style.display = 'none';
        placeholder.style.display = 'flex';
      });

      // Trigger load check for cached images
      if (img.complete && img.naturalWidth > 0) {
        img.style.display = 'block';
        placeholder.style.display = 'none';
      }
    });
  }

  function initGallery() {
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      var img = item.querySelector('img');
      if (!img) return;
      img.addEventListener('error', function () {
        item.style.display = 'none';
      });
      if (img.complete && img.naturalWidth === 0) {
        item.style.display = 'none';
      }
    });
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
          var links = document.getElementById('nav-links');
          if (links) links.classList.remove('open');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyLang(currentLang);
    initImages();
    initGallery();
    initSmoothScroll();
  });
})();
