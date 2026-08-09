(function () {
  // English and Hebrew live at separate URLs (/ and /he/), each server-rendered
  // in its own language, so no client-side language toggle is needed here.

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
        }
      });
    });
  }

  function initNavToggle() {
    var toggle = document.getElementById('nav-toggle');
    var links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initImages();
    initGallery();
    initSmoothScroll();
    initNavToggle();
  });
})();
