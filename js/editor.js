/* Site editor: password-protected editing of the projects (pages inside each project).
   Edits happen in the browser only. "Save" downloads a zip of the updated site files that you upload to GitHub. */
(function () {
  'use strict';
  var cfgEl = document.getElementById('edit-config');
  if (!cfgEl) return;
  var cfg = JSON.parse(cfgEl.textContent);
  var SALT = 'portfolio-editor-v1', ITER = 100000;
  var root = document.documentElement;
  var unlocked = false, editing = false, dirty = false, collapsed = false;
  var pending = {};                       /* new picture path -> { blob, url } */
  var fab, panel, titleEl, bodyEl, saveBtn, dotEl, msgEl, msgActionEl;

  /* ---------- small helpers ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  function api() { return window.__deck || null; }
  function touch() { dirty = true; updateSave(); }
  function updateSave() { if (dotEl) dotEl.style.display = dirty ? 'inline-block' : 'none'; }
  function msg(t, actionLabel, action) {
    msgEl.textContent = t || '';
    msgActionEl.innerHTML = '';
    if (actionLabel) msgActionEl.appendChild(h('button', { type: 'button', class: 'ed-btn sm', text: actionLabel, onclick: action }));
  }
  function slug(t) { return String(t || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project'; }
  function newPath(name, ext) {
    var p;
    do { p = 'assets/projects/' + slug(name) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext; } while (pending[p]);
    return p;
  }
  function blankSlides() {
    return [
      { h: null, t: 'Add a short description of this project here: what it is, which tools you used and what you did.' },
      { h: 'details', t: 'Add a picture and a few lines about this part of the project.' },
      { h: 'result', t: 'Add a picture and a few lines about the result.' }
    ];
  }
  function listToText(list) { return (list || []).map(function (it) { return typeof it === 'string' ? it : it[0] + ': ' + it[1]; }).join('\n'); }
  function textToList(t) {
    var out = [];
    t.split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      var i = line.indexOf(': ');
      out.push(i > 0 ? [line.slice(0, i), line.slice(i + 2)] : line);
    });
    return out.length ? out : null;
  }

  /* pictures added in this session are shown from memory until they are saved */
  window.__resolveImg = function (p) { return pending[p] ? pending[p].url : p; };

  /* shrink big photos so the site stays light */
  function prep(file) {
    return new Promise(function (resolve) {
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve({ blob: file, ext: ext });
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight));
        var cv = document.createElement('canvas');
        cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { resolve(b ? { blob: b, ext: 'jpg' } : { blob: file, ext: ext }); }, 'image/jpeg', 0.88);
      };
      im.onerror = function () { URL.revokeObjectURL(url); resolve({ blob: file, ext: ext }); };
      im.src = url;
    });
  }

  /* ---------- password ---------- */
  function hash(pw) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('nosubtle'));
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash: 'SHA-256' }, k, 256);
    }).then(function (bits) {
      return Array.prototype.map.call(new Uint8Array(bits), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function modal(title, labels, okLabel, onOk) {
    var ov = h('div', { class: 'ed-ov' }), err = h('p', { class: 'ed-err' }), inputs = [];
    var box = h('div', { class: 'ed-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h3', { text: title }));
    function close() { ov.remove(); }
    function submit() {
      ok.disabled = true; err.textContent = '';
      Promise.resolve(onOk(inputs.map(function (i) { return i.value; }))).then(function (res) {
        ok.disabled = false;
        if (res === true) close(); else { err.textContent = res || ''; inputs[0].select(); }
      });
    }
    labels.forEach(function (l) {
      var i = h('input', { type: 'password', autocomplete: 'off', placeholder: l, 'aria-label': l });
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') close(); });
      inputs.push(i); box.appendChild(i);
    });
    var ok = h('button', { type: 'button', class: 'ed-btn pri', text: okLabel, onclick: submit });
    box.appendChild(err);
    box.appendChild(h('div', { class: 'ed-row' }, ok, h('button', { type: 'button', class: 'ed-btn', text: 'cancel', onclick: close })));
    ov.appendChild(box);
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    inputs[0].focus();
  }
  function askPassword() {
    modal('enter the editor password', ['password'], 'unlock', function (v) {
      return hash(v[0]).then(function (hx) {
        if (hx === cfg.hash) { unlocked = true; startEditing(); return true; }
        return new Promise(function (r) { setTimeout(function () { r('wrong password'); }, 500); });
      }, function () { return 'passwords can only be checked on https:// pages or localhost'; });
    });
  }
  function changePassword() {
    modal('set a new password', ['new password (8+ characters)', 'type it again'], 'change', function (v) {
      if (v[0].length < 8) return 'use at least 8 characters';
      if (v[0] !== v[1]) return "the two passwords don't match";
      return hash(v[0]).then(function (hx) {
        cfg.hash = hx; touch();
        msg('Password changed. It takes effect once you save and upload the zip.');
        return true;
      }, function () { return 'cannot set a password on this page (needs https:// or localhost)'; });
    });
  }

  /* ---------- panel ---------- */
  function field(label, control) { return h('label', { class: 'ed-f' }, h('span', { text: label }), control); }
  function input(val, ph, fn) {
    var i = h('input', { type: 'text', placeholder: ph || '' }); i.value = val || '';
    i.addEventListener('input', function () { fn(i.value); }); return i;
  }
  function area(val, ph, rows, fn) {
    var a = h('textarea', { rows: rows, placeholder: ph || '' }); a.value = val || '';
    a.addEventListener('input', function () { fn(a.value); }); return a;
  }
  function btn(label, fn, cls, disabled) {
    var b = h('button', { type: 'button', class: 'ed-btn ' + (cls || ''), text: label, onclick: fn });
    if (disabled) b.disabled = true; return b;
  }
  function note(t) { return h('p', { class: 'ed-note', text: t }); }

  function renderPanel() {
    if (!editing) return;
    var D = api(), st = D ? D.get() : null;
    bodyEl.innerHTML = '';
    if (!D) { titleEl.textContent = 'editor'; bodyEl.appendChild(note('The projects viewer is not available on this page.')); }
    else if (!st.open) {
      titleEl.textContent = 'editor';
      bodyEl.appendChild(note('Open a project category on the projects page (click one of its cards) to edit its projects and their pages.'));
      if (location.hash !== '#projects') bodyEl.appendChild(btn('go to projects', function () { location.hash = '#projects'; }));
    }
    else if (st.mode === 'list') listView(D, st);
    else slideView(D, st);
    updateSave();
  }

  function listView(D, st) {
    var cat = D.data[st.c];
    titleEl.textContent = cat.name + ' · projects';
    cat.projects.forEach(function (p, i) {
      bodyEl.appendChild(h('div', { class: 'ed-item' },
        input(p.name, 'project name', function (v) { p.name = v; touch(); D.showList(true); }),
        h('div', { class: 'ed-row' },
          btn('open', function () { D.openProject(i); }, 'sm'),
          btn('up', function () { swap(cat.projects, i, i - 1); D.showList(true); renderPanel(); }, 'sm', i === 0),
          btn('down', function () { swap(cat.projects, i, i + 1); D.showList(true); renderPanel(); }, 'sm', i === cat.projects.length - 1),
          btn('delete', function () {
            if (!confirm('Delete the project "' + p.name + '" and all its pages?')) return;
            cat.projects.splice(i, 1); touch(); D.showList(true); renderPanel();
          }, 'sm danger'))));
    });
    bodyEl.appendChild(btn('+ add project', function () {
      cat.projects.push({ name: 'New project', slides: blankSlides() }); touch(); D.showList(true); renderPanel();
      var ins = bodyEl.querySelectorAll('.ed-item input'); if (ins.length) { var l = ins[ins.length - 1]; l.focus(); l.select(); }
    }, 'pri'));
  }
  function swap(arr, a, b) { if (b < 0 || b >= arr.length) return; var t = arr[a]; arr[a] = arr[b]; arr[b] = t; touch(); }

  function slideView(D, st) {
    var cat = D.data[st.c], pj = cat.projects[st.pr], n = pj.slides.length, sl = pj.slides[st.s];
    titleEl.textContent = 'page ' + (st.s + 1) + ' of ' + n;
    bodyEl.appendChild(field('project name', input(pj.name, '', function (v) { pj.name = v; touch(); D.refreshText(); })));
    bodyEl.appendChild(field('heading (empty = project name)', input(sl.h || '', pj.name, function (v) { sl.h = v.trim() ? v : null; touch(); D.refreshText(); })));
    bodyEl.appendChild(field('text', area(sl.t || '', '', 5, function (v) { sl.t = v; touch(); D.refreshText(); })));
    bodyEl.appendChild(field('details list (one per line, like "Tools used: Excel")', area(listToText(sl.list), '', 3, function (v) {
      var l = textToList(v); if (l) sl.list = l; else delete sl.list; touch(); D.refreshText();
    })));
    bodyEl.appendChild(h('div', { class: 'ed-f' }, h('span', { text: 'picture' }),
      h('div', { class: 'ed-row' },
        btn(sl.img ? 'change picture' : 'add picture', function () { choosePicture(D, st, pj, sl); }, 'sm'),
        sl.img ? btn('remove picture', function () { delete sl.img; touch(); D.slide(st.s, 0, true); renderPanel(); }, 'sm') : null)));
    bodyEl.appendChild(h('div', { class: 'ed-f' }, h('span', { text: 'pages in this project (' + n + ')' }),
      h('div', { class: 'ed-row' },
        btn('+ add page after this', function () {
          pj.slides.splice(st.s + 1, 0, { h: 'new page', t: 'Add a picture and a few lines here.' }); touch(); D.slide(st.s + 1, 1, false);
        }, 'sm pri'),
        btn('move earlier', function () { swap(pj.slides, st.s, st.s - 1); D.slide(st.s - 1, -1, false); }, 'sm', st.s === 0),
        btn('move later', function () { swap(pj.slides, st.s, st.s + 1); D.slide(st.s + 1, 1, false); }, 'sm', st.s === n - 1),
        btn('delete this page', function () {
          if (n <= 1) return;
          if (!confirm('Delete this page?')) return;
          pj.slides.splice(st.s, 1); touch(); D.slide(Math.min(st.s, n - 2), -1, false);
        }, 'sm danger', n <= 1))));
    bodyEl.appendChild(btn('delete this project', function () {
      if (!confirm('Delete the project "' + pj.name + '" and all its pages?')) return;
      cat.projects.splice(st.pr, 1); touch(); D.back();
    }, 'sm danger'));
  }

  function choosePicture(D, st, pj, sl) {
    var inp = h('input', { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      msg('Processing picture…');
      prep(f).then(function (r) {
        var path = newPath(pj.name, r.ext);
        pending[path] = { blob: r.blob, url: URL.createObjectURL(r.blob) };
        sl.img = path; touch(); D.slide(st.s, 0, true); renderPanel(); msg('Picture added.');
      });
    });
    inp.click();
  }

  /* ---------- saving: build a zip of the updated site ---------- */
  function crc32(u8) {
    var t = crc32.t;
    if (!t) { t = crc32.t = []; for (var n = 0, c; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
    var crc = -1; for (var i = 0; i < u8.length; i++) crc = t[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }
  function makeZip(files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0, cenSize = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      var l = new DataView(new ArrayBuffer(30));
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true);
      l.setUint16(10, time, true); l.setUint16(12, date, true); l.setUint32(14, crc, true); l.setUint32(18, sz, true); l.setUint32(22, sz, true);
      l.setUint16(26, nm.length, true); l.setUint16(28, 0, true);
      parts.push(l.buffer, nm, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true);
      c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(c.buffer, nm); cenSize += 46 + nm.length;
      off += 30 + nm.length + sz;
    });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cenSize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [e.buffer]), { type: 'application/zip' });
  }
  function swapJson(html, id, obj) {
    var open = '<script type="application/json" id="' + id + '">', i = html.indexOf(open);
    if (i < 0) throw new Error('Could not find the ' + id + ' block in index.html');
    var s = i + open.length, e = html.indexOf('</script>', s);
    var json = (id === 'site-data' ? JSON.stringify(obj, null, 1) : JSON.stringify(obj)).replace(/</g, '\\u003c');
    return html.slice(0, s) + json + html.slice(e);
  }
  function localLinks(sel, attr) {
    return [].slice.call(document.querySelectorAll(sel)).map(function (e) { return e.getAttribute(attr); })
      .filter(function (u) { return u && !/^([a-z]+:)?\/\//i.test(u) && u.indexOf('data:') !== 0; });
  }
  function fetchBuf(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); });
  }
  /* read index.html, css and js from the web address (works on GitHub Pages / a local server) */
  function sourcesFromWeb() {
    var base = location.href.split('#')[0].split('?')[0];
    var names = localLinks('link[rel="stylesheet"][href]', 'href').concat(localLinks('script[src]', 'src'));
    return fetchBuf(base).then(function (buf) {
      return Promise.all(names.map(function (n) { return fetchBuf(n).then(function (b) { return { name: n, data: new Uint8Array(b) }; }); }))
        .then(function (extra) { return { html: new TextDecoder().decode(buf), extra: extra }; });
    });
  }
  /* fallback when the page is opened straight from the computer: ask for the site folder */
  function sourcesFromFolder() {
    return new Promise(function (resolve, reject) {
      var inp = h('input', { type: 'file', webkitdirectory: '', multiple: '' });
      inp.addEventListener('change', function () {
        var files = [].slice.call(inp.files || []), html = null, extra = [];
        Promise.all(files.map(function (f) {
          var rel = (f.webkitRelativePath || f.name).split('/').slice(1).join('/');
          if (rel === 'index.html') return f.text().then(function (t) { html = t; });
          if (/^(css|js)\//.test(rel)) return f.arrayBuffer().then(function (b) { extra.push({ name: rel, data: new Uint8Array(b) }); });
        })).then(function () { if (html === null) reject(new Error('index.html was not found in that folder')); else resolve({ html: html, extra: extra }); });
      });
      inp.click();
    });
  }
  function buildZip(src) {
    var enc = new TextEncoder(), html = swapJson(src.html, 'site-data', api().data);
    html = swapJson(html, 'edit-config', cfg);
    var used = {}, files = [{ name: 'index.html', data: enc.encode(html) }].concat(src.extra);
    (function walk(o) {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { if (k === 'img' && typeof o[k] === 'string') used[o[k]] = 1; else walk(o[k]); });
    })(api().data);
    var pics = Object.keys(pending).filter(function (p) { return used[p]; });
    return Promise.all(pics.map(function (p) { return pending[p].blob.arrayBuffer().then(function (b) { files.push({ name: p, data: new Uint8Array(b) }); }); })).then(function () {
      var a = h('a', { download: 'portfolio-site-updated.zip', href: URL.createObjectURL(makeZip(files)) });
      document.body.appendChild(a); a.click(); a.remove();
      dirty = false; updateSave();
      msg('Downloaded portfolio-site-updated.zip. Unzip it and upload everything inside to GitHub (replace the old files).');
    });
  }
  function save() {
    if (!api()) { msg('Nothing to save here.'); return; }
    msg('Preparing the zip…');
    sourcesFromWeb().then(buildZip).catch(function () {
      msg('This page can\u2019t read its own files (it was opened from your computer). Pick your site folder instead:', 'choose folder', function () {
        sourcesFromFolder().then(buildZip).catch(function (e) { msg('Could not save: ' + e.message); });
      });
    });
  }

  /* ---------- build the UI ---------- */
  function startEditing() {
    editing = true; root.classList.add('ed-on'); fab.classList.add('on'); fab.setAttribute('aria-pressed', 'true');
    if (location.hash !== '#projects') location.hash = '#projects';
    renderPanel();
  }
  function stopEditing() { editing = false; root.classList.remove('ed-on'); fab.classList.remove('on'); fab.setAttribute('aria-pressed', 'false'); }
  function lock() { unlocked = false; stopEditing(); }

  fab = h('button', { type: 'button', class: 'ed-fab', 'aria-label': 'Edit site', 'aria-pressed': 'false', 'data-cursor': 'edit' });
  fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  fab.addEventListener('click', function () { if (!unlocked) askPassword(); else if (editing) stopEditing(); else startEditing(); });

  titleEl = h('div', { class: 'ed-title', text: 'editor' });
  var collapse = h('button', { type: 'button', class: 'ed-btn sm', 'aria-label': 'Shrink or expand the editor', text: '–' });
  collapse.addEventListener('click', function () { collapsed = !collapsed; panel.classList.toggle('min', collapsed); collapse.textContent = collapsed ? '+' : '–'; });
  bodyEl = h('div', { class: 'ed-body' });
  msgEl = h('p', { class: 'ed-msg', 'aria-live': 'polite' });
  msgActionEl = h('div', { class: 'ed-row' });
  dotEl = h('i', { class: 'ed-dot', title: 'unsaved changes' });
  saveBtn = h('button', { type: 'button', class: 'ed-btn pri', onclick: save }, 'save & download zip ', dotEl);
  panel = h('div', { class: 'ed-panel', role: 'region', 'aria-label': 'Site editor' },
    h('div', { class: 'ed-head' }, titleEl, collapse), bodyEl,
    h('div', { class: 'ed-foot' }, msgEl, msgActionEl,
      h('div', { class: 'ed-row' }, saveBtn,
        btn('password', changePassword, 'sm'), btn('lock', lock, 'sm'))));
  document.body.appendChild(panel); document.body.appendChild(fab);
  updateSave();

  window.__deckNav = renderPanel;          /* the viewer tells us when the project/page changes */
  addEventListener('hashchange', function () { if (editing) renderPanel(); });
  addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
