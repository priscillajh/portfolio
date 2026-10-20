/* Contact page: fills the phone from the "contact-data" block, flips the card and sends the message. */
(function () {
  'use strict';
  var dataEl = document.getElementById('contact-data'), sec = document.getElementById('contact');
  if (!dataEl || !sec) return;
  var D = JSON.parse(dataEl.textContent);
  var $ = function (s) { return sec.querySelector(s); };
  var phone = $('#phone'), chat = $('#ph-chat'), cc = $('#cc'), openBtn = $('#cc-open'), back = $('#cc-back');
  var closeBtn = $('#cc-close'), form = $('#cc-form'), status = $('#cc-status'), sendBtn = $('#cc-send');
  var local = [], busy = false, doneTimer = 0;     /* messages sent in this visit (shown in the chat only) */

  function pop(up) { if (window.__pop) window.__pop(up); }
  function text(sel, v) { $(sel).textContent = v || ''; }

  function bubble(b, i, delay) {
    var d = document.createElement('div');
    d.className = 'bub ' + (b.from === 'visitor' ? 'out' : 'in');
    d.style.setProperty('--i', i);
    if (delay !== undefined) d.style.setProperty('--d', delay);
    d.textContent = b.t;
    return d;
  }
  function render() {
    var c = D.card || {};
    text('#ph-name', D.name); text('#ph-status', D.status);
    text('#cc-title', c.title); text('#cc-formtitle', c.formTitle || 'send me a message');
    if (!cc.classList.contains('done')) text('#cc-sub', c.sub);
    chat.innerHTML = '';
    (D.bubbles || []).forEach(function (b, i) { chat.appendChild(bubble(b, i)); });
    local.forEach(function (b) { chat.appendChild(bubble(b, 0, '0s')); });
  }

  /* flip the card */
  function flip(on) {
    cc.classList.toggle('flipped', on);
    openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    openBtn.inert = on; back.inert = !on;
    pop(on);
    if (on) { clearTimeout(doneTimer); setTimeout(function () { var f = form.elements.name; if (f && cc.classList.contains('flipped')) f.focus({ preventScroll: true }); }, 450); }
    else setTimeout(function () { openBtn.focus({ preventScroll: true }); }, 450);
  }
  openBtn.addEventListener('click', function () { flip(true); });
  closeBtn.addEventListener('click', function () { flip(false); });
  back.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); flip(false); } });

  /* sending */
  function setStatus(t, err) { status.textContent = t || ''; status.classList.toggle('err', !!err); }
  function request(v) {
    var to = (D.to || '').trim();
    if (!to) return Promise.reject(new Error('notset'));
    var subject = v.subject || ('Portfolio message from ' + v.name), url, body;
    if (to.indexOf('@') > 0) {            /* an email address: FormSubmit (no account needed) */
      url = 'https://formsubmit.co/ajax/' + encodeURI(to);
      body = { name: v.name, email: v.email, _subject: subject, message: v.message, _template: 'table', _captcha: 'false' };
    } else if (/^https?:\/\//i.test(to)) { /* a Formspree (or similar) form link */
      url = to; body = { name: v.name, email: v.email, _subject: subject, subject: subject, message: v.message };
    } else {                               /* a Web3Forms access key */
      url = 'https://api.web3forms.com/submit';
      body = { access_key: to, name: v.name, email: v.email, subject: subject, message: v.message, from_name: 'Portfolio contact form', botcheck: '' };
    }
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var bad = j && (j.success === false || j.success === 'false' || j.error || j.errors);
          if (!r.ok || bad) throw new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
          return j;
        });
      });
  }
  function validate(v) {
    var bad = [];
    if (!v.name) bad.push('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) bad.push('email');
    if (!v.message) bad.push('message');
    [].forEach.call(form.querySelectorAll('input, textarea'), function (el) { el.classList.toggle('bad', bad.indexOf(el.name) > -1); });
    if (bad.length) { setStatus(bad.indexOf('email') > -1 && v.email ? 'please check your email address' : 'please fill in your ' + bad.join(' and ') , true); var f = form.elements[bad[0]]; if (f) f.focus(); }
    return !bad.length;
  }
  function done(v) {
    var short = v.message.length > 140 ? v.message.slice(0, 137) + '…' : v.message;
    local.push({ from: 'visitor', t: short });
    chat.appendChild(bubble(local[local.length - 1], 0, '0s'));
    if (D.reply) { var r = { from: 'me', t: D.reply }; local.push(r); chat.appendChild(bubble(r, 0, '1.4s')); }
    form.reset(); setStatus('');
    flip(false);
    cc.classList.add('done'); text('#cc-sub', (D.card && D.card.done) || 'message sent, thank you!');
    doneTimer = setTimeout(function () { cc.classList.remove('done'); text('#cc-sub', D.card && D.card.sub); }, 8000);
  }
  form.addEventListener('input', function (e) { if (e.target.classList) e.target.classList.remove('bad'); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var f = form.elements;
    var v = { name: f.name.value.trim(), email: f.email.value.trim(), subject: f.subject.value.trim(), message: f.message.value.trim() };
    if (f.botcheck.value) { done(v); return; }          /* a bot filled the hidden field: pretend it worked */
    if (!validate(v)) return;
    busy = true; sendBtn.disabled = true; setStatus('sending…');
    request(v).then(function () { busy = false; sendBtn.disabled = false; done(v); }, function (err) {
      busy = false; sendBtn.disabled = false;
      setStatus(err && err.message === 'notset' ? 'messaging isn\u2019t set up yet.' : 'couldn\u2019t send. please try again in a moment.', true);
      if (window.console) console.warn('contact form:', err && err.message);
    });
  });

  /* tidy up when the page is left, so it opens fresh next time */
  addEventListener('hashchange', function () {
    if (location.hash === '#contact') return;
    if (cc.classList.contains('flipped')) { cc.classList.remove('flipped'); openBtn.inert = false; back.inert = true; openBtn.setAttribute('aria-expanded', 'false'); }
    phone.classList.remove('static'); setStatus('');
  });

  render();
  /* used by the site editor */
  window.__contact = { data: D, render: function () { phone.classList.add('static'); render(); } };
})();
