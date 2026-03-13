// ── CONFIG — replace with your deployed Cloudflare Worker URL ──
const WORKER_URL = 'https://photovault-community.wesleyfairfax.workers.dev';

const MAX = 4;
let stream, shots = [], currentFilter = 'none', shotCount = 0, busy = false;
let finishedStripDataUrl = null;

const video       = document.getElementById('video');
const flash       = document.getElementById('flash');
const cdDisplay   = document.getElementById('countdown-display');
const stripPreview = document.getElementById('stripPreview');
const stripOuter  = document.getElementById('stripOuter');

// ── PAGE NAV ──
function showPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(p).classList.add('active');
  document.querySelectorAll('nav ul a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + (p === 'landing' ? 'home' : p)).classList.add('active');
  if (p === 'booth')   startCamera();
  if (p === 'landing') loadWall();
}

// ── CAMERA ──
async function startCamera() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', syncStripHeight, { once: true });
  } catch(e) {
    alert('Camera access needed. Please allow permissions and refresh.');
  }
}

function syncStripHeight() {
  const slotW = 164, slotH = Math.round(slotW * 3 / 4);
  stripOuter.style.height = (8 + (slotH + 5) * 4 + 28 + 12 + 14) + 'px';
  stripPreview.style.transform = 'translateY(-100%)';
  stripPreview.style.transition = 'transform 0s';
}

function setFilter(f, btn) {
  currentFilter = f;
  video.className = f === 'none' ? '' : f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── COUNTDOWN + SHOOT ──
function startCountdown() {
  if (busy || shotCount >= MAX) return;
  busy = true;
  document.getElementById('shootBtn').disabled = true;
  let n = 3;
  cdDisplay.textContent = n;
  cdDisplay.classList.add('show');
  const iv = setInterval(() => {
    n--;
    if (n > 0) {
      cdDisplay.textContent = n;
    } else {
      clearInterval(iv);
      cdDisplay.classList.remove('show');
      takeShot();
    }
  }, 900);
}

function takeShot() {
  flash.classList.add('pop');
  setTimeout(() => flash.classList.remove('pop'), 150);

  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  let sw = vw, sh = Math.round(vw * 3 / 4), sx = 0, sy = Math.round((vh - sh) / 2);
  if (sh > vh) { sh = vh; sw = Math.round(vh * 4 / 3); sx = Math.round((vw - sw) / 2); sy = 0; }

  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d');
  ctx.save(); ctx.translate(sw, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();

  if (currentFilter === 'grayscale') applyGrayscale(ctx, c);
  if (currentFilter === 'sepia')     applySepia(ctx, c);

  const url = c.toDataURL('image/jpeg', 0.92);
  shots.push(url);

  const slot = document.getElementById('slot' + shotCount);
  const img = new Image(); img.src = url;
  slot.innerHTML = ''; slot.appendChild(img);
  document.getElementById('dot' + shotCount).classList.add('taken');
  shotCount++; busy = false;

  if (shotCount < MAX) {
    document.getElementById('shootBtn').disabled = false;
  } else {
    document.getElementById('shootBtn').style.display = 'none';
    buildFinalStrip();
  }
}

// ── BUILD FINAL STRIP ──
function buildFinalStrip() {
  const PAD = 16, GAP = 8, BOTTOM = 72, SW = 500;
  const FW = SW - PAD * 2, FH = Math.round(FW * 3 / 4);
  const H = PAD + (FH + GAP) * 4 - GAP + BOTTOM;

  const canvas = document.getElementById('offscreen');
  canvas.width = SW; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SW, H);

  let loaded = 0;
  shots.forEach((src, i) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, PAD, PAD + i * (FH + GAP), FW, FH);
      loaded++;
      if (loaded === shots.length) {
        const cap = document.getElementById('caption').value;
        const showDate = document.getElementById('dateToggle').checked;
        const baseY = PAD + (FH + GAP) * 4 - GAP;
        if (cap) {
          ctx.fillStyle = '#333';
          ctx.font = '20px "Special Elite", serif';
          ctx.textAlign = 'center';
          ctx.fillText(cap, SW / 2, baseY + 28);
        }
        if (showDate) {
          ctx.fillStyle = '#aaa';
          ctx.font = '14px "Special Elite", serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
            SW / 2, baseY + 52
          );
        }
        finishedStripDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        animatePrint();
      }
    };
    img.src = src;
  });
}

function animatePrint() {
  stripPreview.style.transition = 'transform 0s';
  stripPreview.style.transform = 'translateY(-100%)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    stripPreview.style.transition = 'transform 2s cubic-bezier(0.33,1,0.68,1)';
    stripPreview.style.transform = 'translateY(0%)';
  }));
  setTimeout(() => {
    ['downloadBtn','downloadPrintBtn','shareBtn','retakeBtn'].forEach(id => {
      document.getElementById(id).style.display = 'block';
    });
  }, 2200);
}

// ── FILTERS ──
function applyGrayscale(ctx, c) {
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const g = d.data[i]*0.299 + d.data[i+1]*0.587 + d.data[i+2]*0.114;
    d.data[i] = d.data[i+1] = d.data[i+2] = g;
  }
  ctx.putImageData(d, 0, 0);
}

function applySepia(ctx, c) {
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], g = d.data[i+1], b = d.data[i+2];
    d.data[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
    d.data[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
    d.data[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
  }
  ctx.putImageData(d, 0, 0);
}

// ── STRIP META ──
function updateStripMeta() {
  const cap = document.getElementById('caption').value;
  const showDate = document.getElementById('dateToggle').checked;
  document.getElementById('stripCaption').textContent = cap;
  document.getElementById('stripDate').textContent = showDate
    ? new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
    : '';
}

// ── DOWNLOADS ──
function downloadStrip() {
  const a = document.createElement('a');
  a.download = 'photovault-strip.jpg';
  a.href = finishedStripDataUrl;
  a.click();
}

function downloadPrint() {
  // 4×6 at 300 DPI = 1200×1800px, two strips side by side
  const DPI = 300;
  const W = 4 * DPI, H = 6 * DPI;
  const MARGIN = Math.round(0.2 * DPI);
  const GAP    = Math.round(0.15 * DPI);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);

  const availW = W - MARGIN * 2 - GAP;
  const stripW = Math.floor(availW / 2);

  const img = new Image();
  img.onload = () => {
    const aspectRatio = img.height / img.width;
    const stripH = Math.min(Math.round(stripW * aspectRatio), H - MARGIN * 2);
    const yOffset = Math.round((H - stripH) / 2);

    // Two strips
    ctx.drawImage(img, MARGIN,                   yOffset, stripW, stripH);
    ctx.drawImage(img, MARGIN + stripW + GAP,    yOffset, stripW, stripH);

    // Dashed cut line
    const cutX = MARGIN + stripW + Math.round(GAP / 2);
    ctx.save();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.moveTo(cutX, MARGIN);
    ctx.lineTo(cutX, H - MARGIN);
    ctx.stroke();
    ctx.restore();

    // Scissors icon
    ctx.font = `${Math.round(0.18 * DPI)}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✂', cutX, MARGIN - 10);

    // Watermark
    ctx.fillStyle = '#cccccc';
    ctx.font = `${Math.round(0.08 * DPI)}px "Special Elite", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('photo vault', W / 2, H - Math.round(0.08 * DPI));

    const a = document.createElement('a');
    a.download = 'photovault-4x6-print.jpg';
    a.href = canvas.toDataURL('image/jpeg', 0.97);
    a.click();
  };
  img.src = finishedStripDataUrl;
}

// ── SHARE MODAL ──
function openShareModal() {
  document.getElementById('modalPreviewImg').src = finishedStripDataUrl;
  document.getElementById('shareModal').classList.add('show');
}
function closeShareModal() {
  document.getElementById('shareModal').classList.remove('show');
}

async function confirmShare() {
  const btn = document.getElementById('confirmShareBtn');
  btn.textContent = 'sharing...'; btn.disabled = true;
  try {
    const res = await fetch(WORKER_URL + '/strips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image:   finishedStripDataUrl,
        caption: document.getElementById('caption').value,
        date:    new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      }),
    });
    if (!res.ok) throw new Error('Upload failed');
    closeShareModal();
    btn.textContent = 'yes, share it'; btn.disabled = false;
    showPage('landing');
  } catch(e) {
    console.error(e);
    btn.textContent = 'try again'; btn.disabled = false;
  }
}

// ── COMMUNITY WALL ──
const ROTATIONS = [-2.5, 1.8, -1.2, 2.1, -0.8, 1.5, -2, 0.9];

async function loadWall() {
  const grid = document.getElementById('wallGrid');
  grid.innerHTML = '<div class="wall-loading">developing film...</div>';
  try {
    const res = await fetch(WORKER_URL + '/strips');
    const strips = await res.json();

    if (!strips.length) {
      grid.innerHTML = '<div class="wall-empty">no strips yet — be the first to share one.</div>';
      return;
    }

    const now = Date.now();
    grid.innerHTML = '';
    strips.forEach((entry, i) => {
      const daysLeft = Math.ceil((entry.expiresAt - now) / (24*60*60*1000));
      const rot = ROTATIONS[i % ROTATIONS.length];
      const div = document.createElement('div');
      div.className = 'wall-strip';
      div.style.setProperty('--r', rot + 'deg');
      div.style.animationDelay = (i * 0.06) + 's';
      div.innerHTML = `
        <img src="${entry.image}" alt="photo strip" loading="lazy">
        ${entry.caption ? `<div class="wall-strip-caption">${entry.caption}</div>` : ''}
        <div class="wall-strip-date">${entry.date || ''}</div>
        <div class="wall-strip-expiry">expires in ${daysLeft}d</div>
      `;
      div.onclick = () => openLightbox(entry.image);
      grid.appendChild(div);
    });
  } catch(e) {
    grid.innerHTML = '<div class="wall-empty">couldn\'t load strips right now.</div>';
    console.error(e);
  }
}

// ── LIGHTBOX ──
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
}

// ── RESET ──
function resetBooth() {
  shots = []; shotCount = 0; busy = false; finishedStripDataUrl = null;
  for (let i = 0; i < MAX; i++) {
    document.getElementById('slot' + i).innerHTML = '<span class="empty-icon">○</span>';
    document.getElementById('dot' + i).classList.remove('taken');
  }
  stripPreview.style.transition = 'transform 0s';
  stripPreview.style.transform = 'translateY(-100%)';
  document.getElementById('shootBtn').style.display = '';
  document.getElementById('shootBtn').disabled = false;
  ['downloadBtn','downloadPrintBtn','shareBtn','retakeBtn'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById('caption').value = '';
  updateStripMeta();
}

// ── INIT ──
updateStripMeta();
stripPreview.style.transform = 'translateY(-100%)';
stripPreview.style.transition = 'transform 0s';
loadWall();
