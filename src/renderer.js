// ── State ────────────────────────────────────────────────────────────────────
let isTracking = false;
let resultCount = 0;
let currentScreen = 'home';

// ── Neural Canvas Animation ──────────────────────────────────────────────────
(function initNeuralCanvas() {
  const canvas = document.getElementById('neural-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, nodes, animId;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    createNodes();
  }

  function createNodes() {
    nodes = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Update
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += 0.02;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    // Connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          const alpha = (1 - d / 120) * 0.15;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(124,92,252,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Nodes
    nodes.forEach(n => {
      const alpha = 0.2 + 0.15 * Math.sin(n.pulse);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(124,92,252,${alpha})`;
      ctx.fill();
    });

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ── Screen Navigation ────────────────────────────────────────────────────────
function showHome() {
  document.getElementById('screen-home').classList.remove('hidden');
  document.getElementById('screen-results').classList.add('hidden');
  currentScreen = 'home';
}

function showResults() {
  document.getElementById('screen-home').classList.add('hidden');
  document.getElementById('screen-results').classList.remove('hidden');
  currentScreen = 'results';
  loadResults();
}

// ── Load results from main process ──────────────────────────────────────────
async function loadResults() {
  const results = await window.electronAPI.getResults();
  resultCount = results.length;
  renderResults(results);
}

function renderResults(results) {
  const list = document.getElementById('results-list');
  const empty = document.getElementById('empty-state');
  const countLabel = document.getElementById('results-count-label');
  const homeCount = document.getElementById('result-count-home');

  countLabel.textContent = `${results.length} BATCH${results.length !== 1 ? 'ES' : ''} ANALYSED`;
  homeCount.textContent = `${results.length} batch${results.length !== 1 ? 'es' : ''}`;

  if (results.length === 0) {
    empty.style.display = 'flex';
    // Remove old cards
    [...list.querySelectorAll('.result-card')].forEach(el => el.remove());
    return;
  }

  empty.style.display = 'none';
  [...list.querySelectorAll('.result-card')].forEach(el => el.remove());

  results.slice().reverse().forEach(entry => {
    const card = buildCard(entry);
    list.appendChild(card);
  });
}

function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'result-card';
  card.id = `card-${entry.id}`;

  const isError = entry.result && entry.result.error;
  const bodyText = isError
    ? `ERROR: ${entry.result.error}`
    : JSON.stringify(entry.result, null, 2);

  card.innerHTML = `
    <div class="result-card-header">
      <span class="result-time">${entry.timestamp}</span>
      <span class="result-batch">${entry.batchSize}s BATCH</span>
    </div>
    <pre class="result-body${isError ? ' error' : ''}">${escapeHtml(bodyText)}</pre>
  `;

  return card;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Tracking Controls ────────────────────────────────────────────────────────
async function handleStart() {
  await window.electronAPI.startTracking();
}

async function handleStop() {
  await window.electronAPI.stopTracking();
}

async function clearResults() {
  await window.electronAPI.clearResults();
  resultCount = 0;
  renderResults([]);
  document.getElementById('result-count-home').textContent = '0 batches';
}

// ── IPC Listeners ─────────────────────────────────────────────────────────────
window.electronAPI.onTrackingState((active) => {
  isTracking = active;
  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const progressRow = document.getElementById('progress-row');
  const pill = document.getElementById('tracking-pill-results');

  if (active) {
    dot.classList.add('active');
    statusText.textContent = 'TRACKING';
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-block';
    progressRow.style.display = 'flex';
    pill.classList.add('visible');
  } else {
    dot.classList.remove('active');
    statusText.textContent = 'IDLE';
    btnStart.style.display = 'inline-block';
    btnStop.style.display = 'none';
    progressRow.style.display = 'none';
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-label').textContent = '0 / 30s';
    pill.classList.remove('visible');
  }
});

window.electronAPI.onTrackingProgress(({ secondsRecorded, totalNeeded }) => {
  const pct = Math.min((secondsRecorded / totalNeeded) * 100, 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-label').textContent = `${secondsRecorded} / ${totalNeeded}s`;
});

window.electronAPI.onMLProcessing((active) => {
  const badge = document.getElementById('ml-badge');
  if (active) {
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
});

window.electronAPI.onNewResult((entry) => {
  resultCount++;
  document.getElementById('result-count-home').textContent = `${resultCount} batch${resultCount !== 1 ? 'es' : ''}`;
  document.getElementById('results-count-label').textContent = `${resultCount} BATCH${resultCount !== 1 ? 'ES' : ''} ANALYSED`;

  // If results screen is open, prepend the new card
  if (currentScreen === 'results') {
    const list = document.getElementById('results-list');
    const empty = document.getElementById('empty-state');
    empty.style.display = 'none';
    const card = buildCard(entry);
    list.insertBefore(card, list.firstChild);
  }
});
