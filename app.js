// PHOTO NOVA - main app: state, rendering, UI, undo/redo, export
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const cv = $('#cv'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const MAX = 1800; // longest side of the working image

  const SLIDERS = [
    ['brightness', 'Brightness', -100, 100], ['contrast', 'Contrast', -100, 100],
    ['saturation', 'Saturation', -100, 100], ['warmth', 'Warmth', -100, 100],
    ['hue', 'Hue', -180, 180], ['sepia', 'Sepia', 0, 100], ['vignette', 'Vignette', 0, 100]
  ];
  const blank = () => ({ brightness: 0, contrast: 0, saturation: 0, warmth: 0, hue: 0, sepia: 0, vignette: 0, gray: 0 });
  const fresh = () => ({ p: blank(), rot: 0, fx: false, fy: false, ratio: 0, text: '', tsize: 8, tcolor: '#ffffff', tpos: 'bottom' });

  let img = null, S = fresh(), undoStack = [], redoStack = [], last = '', raf = 0;

  // ---------- rendering ----------
  function draw() {
    if (!img) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (S.ratio) {
      if (iw / ih > S.ratio) { sw = ih * S.ratio; sx = (iw - sw) / 2; }
      else { sh = iw / S.ratio; sy = (ih - sh) / 2; }
    }
    const k = Math.min(1, MAX / Math.max(sw, sh));
    const dw = Math.round(sw * k), dh = Math.round(sh * k), turned = S.rot % 2;
    cv.width = turned ? dh : dw; cv.height = turned ? dw : dh;
    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate(S.rot * Math.PI / 2);
    ctx.scale(S.fx ? -1 : 1, S.fy ? -1 : 1);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    const data = ctx.getImageData(0, 0, cv.width, cv.height);
    NovaFilters.apply(data, S.p);
    ctx.putImageData(data, 0, 0);
    if (S.text) {
      const fs = cv.width * S.tsize / 100;
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = S.tcolor; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = fs / 6;
      const y = { top: .12, middle: .5, bottom: .88 }[S.tpos] * cv.height;
      ctx.fillText(S.text, cv.width / 2, y, cv.width * .92);
      ctx.shadowBlur = 0;
    }
  }
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

  // ---------- history ----------
  function buttons() {
    $('#undo').disabled = !undoStack.length;
    $('#redo').disabled = !redoStack.length;
  }
  function commit() {
    const cur = JSON.stringify(S);
    if (cur === last) return;
    undoStack.push(last); redoStack = []; last = cur; buttons();
  }
  function restore(json) { S = JSON.parse(json); syncUI(); draw(); buttons(); }
  $('#undo').onclick = () => { if (!undoStack.length) return; redoStack.push(last); last = undoStack.pop(); restore(last); };
  $('#redo').onclick = () => { if (!redoStack.length) return; undoStack.push(last); last = redoStack.pop(); restore(last); };

  // ---------- UI build ----------
  SLIDERS.forEach(([key, label, min, max]) => {
    const row = document.createElement('label');
    row.className = 'sl';
    row.innerHTML = `${label}<input type="range" min="${min}" max="${max}" value="0" data-k="${key}"><output>0</output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.oninput = () => { S.p[key] = +input.value; out.textContent = input.value; schedule(); };
    input.onchange = commit;
    $('#sliders').append(row);
  });

  Object.entries(NovaFilters.PRESETS).forEach(([name, preset]) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => { S.p = { ...blank(), ...preset }; syncUI(); draw(); commit(); };
    $('#looks').append(b);
  });

  function syncUI() {
    $$('#sliders input').forEach(i => { i.value = S.p[i.dataset.k]; i.nextElementSibling.textContent = i.value; });
    $$('#ratios button').forEach(b => b.classList.toggle('on', +b.dataset.r === S.ratio));
    $$('[data-pos]').forEach(b => b.classList.toggle('on', b.dataset.pos === S.tpos));
    $('#txt').value = S.text; $('#tsize').value = S.tsize; $('#tcolor').value = S.tcolor;
  }

  $$('#tabs button').forEach(t => t.onclick = () => {
    $$('#tabs button').forEach(x => x.classList.toggle('on', x === t));
    $$('[data-p]').forEach(p => p.hidden = p.dataset.p !== t.dataset.tab);
  });

  $('#reset').onclick = () => { S.p = blank(); syncUI(); draw(); commit(); };

  // crop / transform
  $$('#ratios button').forEach(b => b.onclick = () => { S.ratio = +b.dataset.r; syncUI(); draw(); commit(); });
  $('#rotL').onclick = () => { S.rot = (S.rot + 3) % 4; draw(); commit(); };
  $('#rotR').onclick = () => { S.rot = (S.rot + 1) % 4; draw(); commit(); };
  $('#flipH').onclick = () => { S.fx = !S.fx; draw(); commit(); };
  $('#flipV').onclick = () => { S.fy = !S.fy; draw(); commit(); };

  // text
  $('#txt').oninput = e => { S.text = e.target.value; schedule(); };
  $('#txt').onchange = commit;
  $('#tsize').oninput = e => { S.tsize = +e.target.value; schedule(); };
  $('#tsize').onchange = commit;
  $('#tcolor').oninput = e => { S.tcolor = e.target.value; schedule(); };
  $('#tcolor').onchange = commit;
  $$('[data-pos]').forEach(b => b.onclick = () => { S.tpos = b.dataset.pos; syncUI(); draw(); commit(); });

  // ---------- load & save ----------
  function load(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const im = new Image();
    im.onload = () => {
      img = im; S = fresh(); undoStack = []; redoStack = []; last = JSON.stringify(S);
      $('#drop').hidden = true; cv.hidden = false; $('#save').disabled = false;
      syncUI(); draw(); buttons();
    };
    im.onerror = () => alert('This image could not be opened. Try a JPG, PNG or WebP file.');
    im.src = URL.createObjectURL(file);
  }
  $('#file').onchange = e => load(e.target.files[0]);
  const stage = $('#stage');
  stage.ondragover = e => { e.preventDefault(); $('#drop').classList.add('over'); };
  stage.ondragleave = () => $('#drop').classList.remove('over');
  stage.ondrop = e => { e.preventDefault(); $('#drop').classList.remove('over'); load(e.dataTransfer.files[0]); };

  $('#save').onclick = () => cv.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'photo-nova.jpg'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/jpeg', 0.92);
})();
