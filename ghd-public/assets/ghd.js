/* eslint-disable @typescript-eslint/no-unused-vars */
/* GH PDF portal — ortak arayüz yardımcıları */
(function () {
  'use strict';

  try {
    if (!window.localStorage.getItem('bentopdf-language')) {
      window.localStorage.setItem('bentopdf-language', 'tr');
    }
  } catch (err) {
    // Gizli mod / depolama kapalı: varsayılan dil yine de tr.
  }

  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var revealNodes = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealNodes.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealNodes.forEach(function (node) {
      observer.observe(node);
    });
  } else {
    revealNodes.forEach(function (node) {
      node.classList.add('is-visible');
    });
  }

  // Kullanıcı kaydırmasa bile içerik kısa süre sonra görünür olsun.
  if (revealNodes.length) {
    window.setTimeout(function () {
      revealNodes.forEach(function (node) {
        node.classList.add('is-visible');
      });
    }, 900);
  }

  document.querySelectorAll('[data-fallback-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      window.location.href = link.getAttribute('href');
    });
  });
})();

async function ghdApi(path, options) {
  var opts = Object.assign(
    { credentials: 'same-origin', headers: { Accept: 'application/json' } },
    options || {}
  );
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers = Object.assign({}, opts.headers, {
      'Content-Type': 'application/json',
    });
    if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  }
  var response;
  try {
    response = await fetch(path, opts);
  } catch (err) {
    throw new Error(
      'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      { cause: err }
    );
  }
  var data = null;
  var text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }
  }
  if (!response.ok) {
    var message =
      (data && (data.message || data.error || data.detail)) ||
      'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
    var error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function ghdShowAlert(id, message, type) {
  var el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  el.textContent = message;
  el.className = 'alert alert--' + (type || 'error') + ' is-visible';
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function ghdHideAlert(id) {
  var el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) {
    el.className = 'alert';
    el.textContent = '';
  }
}

function ghdSetBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label || 'İşleniyor…';
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}

function ghdEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ghdFormatDate(value) {
  if (!value) return '—';
  var date = new Date(String(value).replace(' ', 'T'));
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

var GHD_STATUS_LABELS = {
  pending: 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

var GHD_LEGAL_LABELS = {
  student: 'Hukuk öğrencisi',
  graduate: 'Hukuk mezunu',
};

var GHD_DOC_LABELS = {
  student_certificate: 'Öğrenci belgesi',
  diploma: 'Diploma',
};
