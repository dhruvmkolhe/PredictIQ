/* ═══════════════════════════════════════════════════════
   PredictIQ — Customer Intelligence Dashboard
   JavaScript Core — All pages, live stream, charts, API
   ═══════════════════════════════════════════════════════ */

const API = 'http://localhost:8000';
let currentPage = 'dashboard';
let liveInterval = null;
let liveRunning = false;
let liveEvents = [];
let liveChart = null;
let chartInstances = {};
let segmentData = [];
let comparisonData = {};

// ─── Color Palette ──────────────────────────────────────
const SEG_COLORS = {
  0: { color: '#ef4444', label: 'Dormant',      emoji:'😴' },
  1: { color: '#6366f1', label: 'Loyalists',    emoji:'👑' },
  2: { color: '#10b981', label: 'Big Spenders',  emoji:'💎' },
  3: { color: '#f59e0b', label: 'New Customers', emoji:'🌟' },
};
const MODEL_COLORS = {
  'Random Forest':       '#6366f1',
  'XGBoost':             '#10b981',
  'Logistic Regression': '#f59e0b',
  'Decision Tree':       '#ec4899',
  'SVM':                 '#8b5cf6',
  'MLP Neural Network':  '#06b6d4',
};

// ─── Navigation ──────────────────────────────────────────
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  el.classList.add('active');
  currentPage = page;

  const titles = {
    dashboard: 'Dashboard Overview',
    segments:  'Customer Segmentation',
    predict:   'Prediction Engine',
    live:      'Live Monitor',
    reports:   'Reports & Insights',
    models:    'Model Comparison',
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;

  // Lazy-load page data
  if (page === 'dashboard') loadDashboard();
  if (page === 'segments')  loadSegments();
  if (page === 'reports')   loadReports();
  if (page === 'models')    loadModels();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function refreshCurrentPage() {
  navigate(currentPage, document.querySelector(`.nav-item[data-page="${currentPage}"]`));
  showToast('Data refreshed ✓');
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ─── API Health Check ─────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (data.models_loaded) {
      dot.className = 'status-dot online';
      txt.textContent = `${data.available_models.length} models ready`;
    } else {
      dot.className = 'status-dot offline';
      txt.textContent = 'Models not loaded';
    }
  } catch {
    document.getElementById('statusDot').className = 'status-dot offline';
    document.getElementById('statusText').textContent = 'API offline';
  }
}

// ─── Fetch Helpers ────────────────────────────────────────
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function updateTimestamp() {
  document.getElementById('lastUpdated').textContent =
    'Updated ' + new Date().toLocaleTimeString();
}

// ─── Destroy old chart ────────────────────────────────────
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ─── Chart Defaults ───────────────────────────────────────
Chart.defaults.color = '#64748b';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = '#111827';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
Chart.defaults.plugins.legend.display = false;

// ─── ════════  DASHBOARD  ════════ ──────────────────────
async function loadDashboard() {
  updateTimestamp();
  try {
    const [summary, segs, compare, scatter] = await Promise.all([
      fetchJSON(`${API}/analytics/summary`),
      fetchJSON(`${API}/analytics/segments`),
      fetchJSON(`${API}/models/compare`),
      fetchJSON(`${API}/analytics/rfm-scatter`),
    ]);

    segmentData = segs;
    comparisonData = compare;

    // KPI
    animateKPI('kpi-customers', summary.total_customers, '', '');
    animateKPI('kpi-revenue',   summary.total_revenue,   '₹', '');
    animateKPI('kpi-freq',      summary.avg_frequency,   '', 'x');
    animateKPI('kpi-highval',   summary.high_value_customers, '', '');

    renderSegmentDonut(segs);
    renderModelBar(compare);
    renderRFMScatter(scatter);
    renderSegRadar(segs);

  } catch (e) {
    console.warn('Dashboard load:', e.message);
    showToast('⚠️ Could not reach API — showing demo data');
    loadDemoDashboard();
  }
}

function animateKPI(id, target, prefix, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const duration = 900;
  const t0 = performance.now();
  const isFloat = target % 1 !== 0;

  function tick(now) {
    const p = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = start + (target - start) * ease;
    const formatted = target > 9999
      ? prefix + formatNumber(val) + suffix
      : prefix + (isFloat ? val.toFixed(1) : Math.round(val)) + suffix;
    el.textContent = formatted;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target > 9999
      ? prefix + formatNumber(target) + suffix
      : prefix + (isFloat ? target.toFixed(1) : target) + suffix;
  }
  requestAnimationFrame(tick);
}

function formatNumber(n) {
  if (n >= 1e7)  return (n/1e7).toFixed(1) + 'Cr';
  if (n >= 1e5)  return (n/1e5).toFixed(1) + 'L';
  if (n >= 1e3)  return (n/1e3).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function renderSegmentDonut(segs) {
  destroyChart('segmentDonut');
  const labels = segs.map(s => s.label);
  const values = segs.map(s => s.count);
  const colors = segs.map(s => SEG_COLORS[s.cluster]?.color || '#888');

  const legend = document.getElementById('segLegend');
  legend.innerHTML = segs.map((s, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      ${s.label} (${s.count.toLocaleString()})
    </div>`).join('');

  chartInstances['segmentDonut'] = new Chart(
    document.getElementById('segmentDonut').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8,
        hoverBorderWidth: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString()} customers (${((ctx.parsed / values.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
          }
        }
      },
      animation: { animateRotate: true, duration: 900 },
    }
  });
}

function renderModelBar(compare) {
  destroyChart('modelBar');
  const models = Object.keys(compare);
  const accs   = models.map(m => compare[m].accuracy);
  const colors  = models.map(m => MODEL_COLORS[m] || '#888');

  chartInstances['modelBar'] = new Chart(
    document.getElementById('modelBar').getContext('2d'), {
    type: 'bar',
    data: {
      labels: models.map(m => m.replace(' Neural Network','').replace(' Regression','')),
      datasets: [{
        data: accs,
        backgroundColor: colors.map(c => c + '55'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      scales: {
        x: {
          min: 75, max: 95,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => v + '%', font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toFixed(2)}% accuracy` } }
      },
      animation: { duration: 800 },
    }
  });
}

function renderRFMScatter(scatter) {
  destroyChart('rfmScatter');
  const datasets = Object.entries(SEG_COLORS).map(([id, info]) => ({
    label: info.label,
    data: scatter.filter(p => p.Cluster == id).map(p => ({ x: p.Recency, y: p.Monetary })),
    backgroundColor: info.color + '66',
    borderColor: info.color,
    borderWidth: 1,
    pointRadius: 4,
    pointHoverRadius: 6,
  }));

  chartInstances['rfmScatter'] = new Chart(
    document.getElementById('rfmScatter').getContext('2d'), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Recency (days)', color:'#64748b', font:{size:11} }, grid: { color:'rgba(255,255,255,0.04)' }, ticks:{ font:{size:11} } },
        y: { title: { display: true, text: 'Monetary (₹)', color:'#64748b', font:{size:11} }, grid: { color:'rgba(255,255,255,0.04)' }, ticks:{ callback: v => '₹'+formatNumber(v), font:{size:11} } }
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font:{size:11} } },
        tooltip: { callbacks: { label: ctx => ` Recency: ${ctx.parsed.x}d, ₹${ctx.parsed.y.toLocaleString()}` } }
      },
      animation: { duration: 600 },
    }
  });
}

function renderSegRadar(segs) {
  destroyChart('segRadar');
  const labels = ['Recency ↓', 'Frequency ↑', 'Monetary ↑'];
  const maxR = Math.max(...segs.map(s => s.avg_recency));
  const maxF = Math.max(...segs.map(s => s.avg_frequency));
  const maxM = Math.max(...segs.map(s => s.avg_monetary));

  const datasets = segs.map(s => ({
    label: s.label,
    data: [
      Math.round((1 - s.avg_recency / maxR) * 100),
      Math.round((s.avg_frequency / maxF) * 100),
      Math.round((s.avg_monetary / maxM) * 100),
    ],
    backgroundColor: (SEG_COLORS[s.cluster]?.color || '#888') + '22',
    borderColor: SEG_COLORS[s.cluster]?.color || '#888',
    borderWidth: 2,
    pointRadius: 3,
  }));

  chartInstances['segRadar'] = new Chart(
    document.getElementById('segRadar').getContext('2d'), {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: 'rgba(255,255,255,0.07)' },
          grid: { color: 'rgba(255,255,255,0.07)' },
          pointLabels: { color: '#94a3b8', font: { size: 11 } },
          ticks: { display: false },
          suggestedMin: 0, suggestedMax: 100,
        }
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font:{size:11} } }
      },
      animation: { duration: 700 },
    }
  });
}

// Demo data if API is offline
function loadDemoDashboard() {
  animateKPI('kpi-customers', 4338, '', '');
  animateKPI('kpi-revenue',   2847293, '₹', '');
  animateKPI('kpi-freq',      4.2, '', 'x');
  animateKPI('kpi-highval',   1084, '', '');
  const demoSegs = [
    { cluster:0, label:'Dormant',      count:820,  avg_recency:310, avg_frequency:1.2, avg_monetary:4500  },
    { cluster:1, label:'Loyalists',    count:1250, avg_recency:18,  avg_frequency:9.4, avg_monetary:28000 },
    { cluster:2, label:'Big Spenders', count:560,  avg_recency:45,  avg_frequency:5.1, avg_monetary:72000 },
    { cluster:3, label:'New Customers',count:1708, avg_recency:8,   avg_frequency:1.8, avg_monetary:6200  },
  ];
  segmentData = demoSegs;
  comparisonData = demoCompare();
  renderSegmentDonut(demoSegs);
  renderModelBar(demoCompare());
  const demoScatter = [];
  demoSegs.forEach(s => {
    for (let i=0;i<50;i++) demoScatter.push({
      Recency: Math.max(0,s.avg_recency + (Math.random()-0.5)*60),
      Monetary: Math.max(0,s.avg_monetary + (Math.random()-0.5)*s.avg_monetary*0.6),
      Cluster: s.cluster,
    });
  });
  renderRFMScatter(demoScatter);
  renderSegRadar(demoSegs);
}

function demoCompare() {
  return {
    'Random Forest':       { accuracy:88.86, precision:86.87, recall:94.79, f1:90.66, auc_roc:96.26, needs_scaling:false },
    'XGBoost':             { accuracy:88.11, precision:88.78, recall:90.62, f1:89.69, auc_roc:96.03, needs_scaling:false },
    'Logistic Regression': { accuracy:86.63, precision:86.39, recall:90.89, f1:88.58, auc_roc:89.57, needs_scaling:true  },
    'Decision Tree':       { accuracy:87.96, precision:87.22, recall:92.45, f1:89.76, auc_roc:94.13, needs_scaling:false },
    'SVM':                 { accuracy:89.90, precision:85.11, recall:99.74, f1:91.85, auc_roc:95.63, needs_scaling:true  },
    'MLP Neural Network':  { accuracy:88.56, precision:83.59, recall:99.48, f1:90.84, auc_roc:87.62, needs_scaling:true  },
  };
}

// ─── ════════  SEGMENTATION  ════════ ───────────────────
async function loadSegments() {
  try {
    let segs = segmentData;
    if (!segs.length) segs = await fetchJSON(`${API}/analytics/segments`);

    const container = document.getElementById('segOverview');
    const total = segs.reduce((a, s) => a + s.count, 0);

    container.innerHTML = segs.map(s => {
      const info  = SEG_COLORS[s.cluster] || { color:'#888', emoji:'?' };
      const pct   = ((s.count / total) * 100).toFixed(1);
      return `
      <div class="seg-card" style="border-top: 2px solid ${info.color}20; background: linear-gradient(135deg, ${info.color}0a, transparent)">
        <div class="seg-label-row">
          <span class="seg-dot" style="background:${info.color}"></span>
          <span class="seg-label">${info.emoji} ${s.label}</span>
        </div>
        <div class="seg-count" style="color:${info.color}">${s.count.toLocaleString()}</div>
        <div class="seg-subtext">${pct}% of total customers</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px;">
          <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px;">
            <div style="font-size:13px;font-weight:700;color:#f1f5f9">${s.avg_recency.toFixed(0)}d</div>
            <div style="font-size:10px;color:#64748b">Recency</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px;">
            <div style="font-size:13px;font-weight:700;color:#f1f5f9">${s.avg_frequency.toFixed(1)}x</div>
            <div style="font-size:10px;color:#64748b">Frequency</div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px;">
            <div style="font-size:13px;font-weight:700;color:#f1f5f9">₹${formatNumber(s.avg_monetary)}</div>
            <div style="font-size:10px;color:#64748b">Monetary</div>
          </div>
        </div>
        <div class="seg-bar-wrap"><div class="seg-bar" style="width:${pct}%;background:${info.color}"></div></div>
      </div>`;
    }).join('');

    renderSegGroupedBar(segs);
    renderSegScatter2();

  } catch(e) {
    console.warn('Segments:', e);
    showToast('⚠️ Using demo segment data');
    const demoSegs = [
      { cluster:0, label:'Dormant',      count:820,  avg_recency:310, avg_frequency:1.2, avg_monetary:4500  },
      { cluster:1, label:'Loyalists',    count:1250, avg_recency:18,  avg_frequency:9.4, avg_monetary:28000 },
      { cluster:2, label:'Big Spenders', count:560,  avg_recency:45,  avg_frequency:5.1, avg_monetary:72000 },
      { cluster:3, label:'New Customers',count:1708, avg_recency:8,   avg_frequency:1.8, avg_monetary:6200  },
    ];
    loadSegments.demoSegs = demoSegs;
    segmentData = demoSegs;
    loadSegments();
  }
}

function renderSegGroupedBar(segs) {
  destroyChart('segGroupedBar');
  const labels = segs.map(s => SEG_COLORS[s.cluster]?.emoji + ' ' + s.label);
  chartInstances['segGroupedBar'] = new Chart(
    document.getElementById('segGroupedBar').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Avg Recency (days)', data: segs.map(s => s.avg_recency),   backgroundColor: '#ef444466',  borderColor: '#ef4444', borderWidth:1.5, borderRadius:5, borderSkipped:false },
        { label:'Avg Frequency (×)',  data: segs.map(s => s.avg_frequency * 10), backgroundColor: '#6366f166', borderColor: '#6366f1', borderWidth:1.5, borderRadius:5, borderSkipped:false },
        { label:'Avg Monetary (÷100 ₹)', data: segs.map(s => s.avg_monetary / 100), backgroundColor: '#10b98166', borderColor: '#10b981', borderWidth:1.5, borderRadius:5, borderSkipped:false },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:12}} },
        y: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{font:{size:11}} }
      },
      plugins: {
        legend: { display:true, position:'bottom', labels: { boxWidth:10, boxHeight:10, font:{size:11} } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const labels = ['days','×10 (scaled)','÷100 (scaled)'];
              return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} ${labels[ctx.datasetIndex]||''}`;
            }
          }
        }
      },
      animation:{duration:700},
    }
  });
}

function renderSegScatter2() {
  destroyChart('segScatter2');
  const ds = Object.entries(SEG_COLORS).map(([id, info]) => {
    const seg = segmentData.find(s => s.cluster == id);
    if (!seg) return null;
    // generate synthetic cloud around centroid
    const pts = Array.from({length: 40}, () => ({
      x: Math.max(0, seg.avg_recency   + (Math.random()-.5)*seg.avg_recency*0.7),
      y: Math.max(0, seg.avg_monetary  + (Math.random()-.5)*seg.avg_monetary*0.65),
      r: Math.max(4, Math.min(12, seg.avg_frequency * 1.2)),
    }));
    return {
      label: info.emoji + ' ' + info.label,
      data: pts,
      backgroundColor: info.color + '55',
      borderColor: info.color,
      borderWidth: 1.5,
    };
  }).filter(Boolean);

  chartInstances['segScatter2'] = new Chart(
    document.getElementById('segScatter2').getContext('2d'), {
    type: 'bubble',
    data: { datasets: ds },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { title:{display:true,text:'Recency (days)',color:'#64748b',font:{size:11}}, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{font:{size:11}} },
        y: { title:{display:true,text:'Monetary (₹)',color:'#64748b',font:{size:11}},   grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>'₹'+formatNumber(v),font:{size:11}} }
      },
      plugins: {
        legend:{display:true,position:'bottom',labels:{boxWidth:10,boxHeight:10,font:{size:11}}},
        tooltip:{ callbacks:{ label: ctx => ` ${ctx.dataset.label}: R=${ctx.parsed.x.toFixed(0)}d, M=₹${ctx.parsed.y.toFixed(0)}` } }
      },
      animation:{duration:700},
    }
  });
}

// ─── ════════  PREDICTION ENGINE  ════════ ──────────────
let selectedModel = 'Random Forest';

function selectModel(el) {
  document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedModel = el.dataset.model;
}

function syncSlider(field, val) {
  if (field === 'recency') {
    document.getElementById('f-recency').value = val;
    document.getElementById('sl-recency-val').textContent = val;
  } else if (field === 'spend') {
    document.getElementById('f-spend').value = val;
    document.getElementById('sl-spend-val').textContent = parseInt(val).toLocaleString();
  }
}

// Sync inputs → sliders
document.getElementById('f-recency')?.addEventListener('input', e => {
  document.getElementById('sl-recency').value = e.target.value;
  document.getElementById('sl-recency-val').textContent = e.target.value;
});
document.getElementById('f-spend')?.addEventListener('input', e => {
  document.getElementById('sl-spend').value = e.target.value;
  document.getElementById('sl-spend-val').textContent = parseInt(e.target.value).toLocaleString();
});

async function runPrediction(e) {
  e.preventDefault();
  const btn = document.getElementById('predictBtn');
  btn.classList.add('loading');
  btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Predicting…`;

  const body = {
    recency:         +document.getElementById('f-recency').value,
    frequency:       +document.getElementById('f-frequency').value,
    total_spend:     +document.getElementById('f-spend').value,
    avg_order_value: +document.getElementById('f-aov').value,
    unique_products: +document.getElementById('f-products').value,
    avg_quantity:    +document.getElementById('f-qty').value,
    model_name:      selectedModel,
  };

  try {
    let result;
    try {
      const res = await fetch(`${API}/predict`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      result = await res.json();
    } catch {
      // Fallback demo
      const prob = Math.min(99, Math.max(5, 100 - body.recency * 0.15 + body.frequency * 3 + body.total_spend * 0.001));
      result = {
        probability: +prob.toFixed(1),
        cluster: prob > 70 ? 1 : prob > 40 ? 3 : 0,
        segment: prob > 70 ? 'Loyalists' : prob > 40 ? 'New Customers' : 'Dormant',
        intent: prob >= 70 ? 'High' : prob >= 40 ? 'Medium' : 'Low',
        action: prob >= 70
          ? 'Customer shows strong intent. No discount needed — preserve margins. Consider a personalised newsletter.'
          : prob >= 40
          ? 'Customer is on the fence. Trigger a time-limited 10% discount code via automated email.'
          : 'High churn risk. Deploy win-back campaign: 20% discount + personalised product bundle.',
        color: prob >= 70 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444',
        model_used: selectedModel,
      };
    }
    displayPredictionResult(result, body);
  } catch (err) {
    showToast('❌ Prediction failed: ' + err.message);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Run Prediction`;
  }
}

function displayPredictionResult(result, input) {
  const placeholder = document.getElementById('resultPlaceholder');
  const content = document.getElementById('resultContent');

  if (placeholder) placeholder.classList.add('hidden');
  if (content) {
    content.classList.remove('hidden');
    content.style.display = 'block';
  }

  const pct = result.probability;
  const circumference = 2 * Math.PI * 50; // 314.16
  const offset = circumference * (1 - pct / 100);
  const ringFg = document.getElementById('ringFg');
  if (ringFg) {
    ringFg.style.strokeDashoffset = offset;
    ringFg.style.stroke = result.color;
  }
  const ringPct = document.getElementById('ringPct');
  if (ringPct) ringPct.textContent = pct + '%';

  const intentBadge = document.getElementById('intentBadge');
  if (intentBadge) {
    intentBadge.textContent = result.intent + ' Intent';
    intentBadge.style.background = result.color + '22';
    intentBadge.style.color = result.color;
    intentBadge.style.border = `1px solid ${result.color}44`;
  }

  const resultSeg = document.getElementById('resultSeg');
  if (resultSeg) resultSeg.textContent = (SEG_COLORS[result.cluster]?.emoji || '📦') + ' ' + result.segment;

  const resultModelUsed = document.getElementById('resultModelUsed');
  if (resultModelUsed) resultModelUsed.textContent = '⚙ ' + result.model_used;

  const resultAction = document.getElementById('resultAction');
  if (resultAction) {
    resultAction.style.borderColor = result.color + '44';
    resultAction.style.background  = result.color + '11';
  }
  const actionText = document.getElementById('actionText');
  if (actionText) actionText.textContent = result.action;

  const resultMetrics = document.getElementById('resultMetrics');
  if (resultMetrics) {
    resultMetrics.innerHTML = `
      <div class="metric-mini">
        <div class="metric-mini-val" style="color:#6366f1">${input.recency}d</div>
        <div class="metric-mini-label">Recency</div>
      </div>
      <div class="metric-mini">
        <div class="metric-mini-val" style="color:#10b981">${input.frequency}×</div>
        <div class="metric-mini-label">Frequency</div>
      </div>
      <div class="metric-mini">
        <div class="metric-mini-val" style="color:#f59e0b">₹${formatNumber(input.total_spend)}</div>
        <div class="metric-mini-label">Total Spend</div>
      </div>`;
  }

  // Scroll result into view smoothly
  const resultCard = document.getElementById('predictResult');
  if (resultCard) resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Scenario Presets
const SCENARIOS = [
  { name:'👑 Champion',        recency:5,   frequency:22, total_spend:95000, avg_order_value:4318, unique_products:18, avg_quantity:3.5 },
  { name:'💎 Big Spender',     recency:20,  frequency:6,  total_spend:82000, avg_order_value:13667,unique_products:5,  avg_quantity:1.8 },
  { name:'🌟 Promising New',   recency:3,   frequency:2,  total_spend:7500,  avg_order_value:3750, unique_products:4,  avg_quantity:2.0 },
  { name:'😴 At-Risk',         recency:180, frequency:3,  total_spend:12000, avg_order_value:4000, unique_products:3,  avg_quantity:1.5 },
  { name:'💤 Dormant',         recency:350, frequency:1,  total_spend:2500,  avg_order_value:2500, unique_products:1,  avg_quantity:1.0 },
  { name:'🔄 Regular Shopper', recency:30,  frequency:9,  total_spend:27000, avg_order_value:3000, unique_products:12, avg_quantity:2.8 },
];

async function runScenarios() {
  const container = document.getElementById('scenariosTable');
  container.innerHTML = `<div class="table-placeholder">Running ${SCENARIOS.length} scenarios…</div>`;

  const results = await Promise.all(SCENARIOS.map(async sc => {
    const body = { ...sc, model_name: selectedModel };
    try {
      const r = await fetch(`${API}/predict`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      return { ...sc, ...(await r.json()) };
    } catch {
      const prob = Math.min(99, Math.max(5, 100 - sc.recency * 0.15 + sc.frequency * 3 + sc.total_spend * 0.001));
      return {
        ...sc,
        probability: +prob.toFixed(1),
        intent: prob >= 70 ? 'High' : prob >= 40 ? 'Medium' : 'Low',
        color: prob >= 70 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444',
        segment: prob > 70 ? 'Loyalists' : prob > 40 ? 'New Customers' : 'Dormant',
      };
    }
  }));

  container.innerHTML = `
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr>
        ${['Profile','Recency','Frequency','Spend','Segment','Probability','Intent']
          .map(h=>`<th style="text-align:left;padding:10px 12px;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.07)">${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${results.map(r => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="padding:11px 12px;font-weight:700;color:#f1f5f9">${r.name}</td>
          <td style="padding:11px 12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">${r.recency}d</td>
          <td style="padding:11px 12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">${r.frequency}×</td>
          <td style="padding:11px 12px;color:#94a3b8;font-family:'JetBrains Mono',monospace">₹${r.total_spend.toLocaleString()}</td>
          <td style="padding:11px 12px;color:#94a3b8">${r.segment || '–'}</td>
          <td style="padding:11px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:5px;background:rgba(255,255,255,0.07);border-radius:5px;min-width:50px">
                <div style="width:${r.probability}%;height:5px;background:${r.color};border-radius:5px"></div>
              </div>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${r.color};font-size:13px">${r.probability}%</span>
            </div>
          </td>
          <td style="padding:11px 12px">
            <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;background:${r.color}22;color:${r.color}">${r.intent}</span>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

// ─── ════════  LIVE MONITOR  ════════ ───────────────────
const LIVE_SCENARIOS = [
  { recency:5,  frequency:18, total_spend:72000, avg_order_value:4000, unique_products:14, avg_quantity:2.8 },
  { recency:180,frequency:2,  total_spend:6000,  avg_order_value:3000, unique_products:2,  avg_quantity:1.2 },
  { recency:12, frequency:9,  total_spend:31000, avg_order_value:3444, unique_products:10, avg_quantity:2.5 },
  { recency:60, frequency:4,  total_spend:15000, avg_order_value:3750, unique_products:5,  avg_quantity:1.8 },
  { recency:2,  frequency:1,  total_spend:3500,  avg_order_value:3500, unique_products:3,  avg_quantity:1.0 },
  { recency:30, frequency:12, total_spend:45000, avg_order_value:3750, unique_products:15, avg_quantity:3.2 },
  { recency:90, frequency:7,  total_spend:22000, avg_order_value:3143, unique_products:8,  avg_quantity:2.1 },
];

function initLiveChart() {
  destroyChart('liveLineChart');
  chartInstances['liveLineChart'] = new Chart(
    document.getElementById('liveLineChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Purchase Probability (%)',
        data: [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{font:{size:10},maxTicksLimit:10} },
        y: { min:0, max:100, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>v+'%',font:{size:11}} }
      },
      animation: { duration: 300 },
      plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}% purchase probability` } } }
    }
  });
}

function toggleLiveStream() {
  if (liveRunning) stopLiveStream();
  else startLiveStream();
}

function startLiveStream() {
  liveRunning = true;
  liveEvents = [];
  const btn = document.getElementById('liveToggleBtn');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop Stream`;
  btn.classList.add('stop');
  document.getElementById('liveFeed').innerHTML = '';
  initLiveChart();

  liveInterval = setInterval(fireLiveEvent, 1200);
}

function stopLiveStream() {
  liveRunning = false;
  clearInterval(liveInterval);
  const btn = document.getElementById('liveToggleBtn');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Stream`;
  btn.classList.remove('stop');
}

async function fireLiveEvent() {
  const sc = LIVE_SCENARIOS[Math.floor(Math.random() * LIVE_SCENARIOS.length)];
  const body = { ...sc, model_name: 'Random Forest' };
  let prob, intent, color, segment;

  try {
    const r = await fetch(`${API}/predict`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    const d = await r.json();
    prob    = d.probability;
    intent  = d.intent;
    color   = d.color;
    segment = d.segment;
  } catch {
    prob    = +(Math.random() * 100).toFixed(1);
    intent  = prob >= 70 ? 'High' : prob >= 40 ? 'Medium' : 'Low';
    color   = prob >= 70 ? '#10b981' : prob >= 40 ? '#f59e0b' : '#ef4444';
    segment = prob > 70 ? 'Loyalists' : prob > 40 ? 'New Customers' : 'Dormant';
  }

  liveEvents.push({ prob, intent, color, segment, time: new Date() });

  // Update counters
  document.getElementById('liveEventCount').textContent = liveEvents.length;
  const avg = (liveEvents.reduce((a,e)=>a+e.prob,0)/liveEvents.length).toFixed(1);
  document.getElementById('liveAvgProb').textContent = avg + '%';
  document.getElementById('liveHighIntent').textContent = liveEvents.filter(e=>e.intent==='High').length;

  // Update chart (keep last 30)
  const chart = chartInstances['liveLineChart'];
  if (chart) {
    if (chart.data.labels.length >= 30) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    chart.data.labels.push(timeStr);
    chart.data.datasets[0].data.push(prob);
    chart.update('none');
  }

  // Add feed row
  const feed = document.getElementById('liveFeed');
  const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const row = document.createElement('div');
  row.className = 'feed-event';
  row.innerHTML = `
    <span class="feed-time">${timeStr}</span>
    <span class="feed-prob" style="color:${color}">${prob}%</span>
    <span class="feed-seg">${segment} · R:${sc.recency}d F:${sc.frequency}×</span>
    <span class="feed-intent intent-${intent.toLowerCase()}">${intent}</span>`;
  feed.prepend(row);

  // Trim feed
  while (feed.children.length > 40) feed.removeChild(feed.lastChild);
}

// ─── ════════  REPORTS  ════════ ────────────────────────
async function loadReports() {
  try {
    let compare = comparisonData;
    let summary;
    if (!Object.keys(compare).length) {
      [compare, summary] = await Promise.all([
        fetchJSON(`${API}/models/compare`),
        fetchJSON(`${API}/analytics/summary`).catch(()=>null),
      ]);
      comparisonData = compare;
    } else {
      summary = await fetchJSON(`${API}/analytics/summary`).catch(()=>null);
    }

    if (summary) {
      document.getElementById('ins-avgVal').textContent  = '₹' + formatNumber(summary.avg_monetary);
      document.getElementById('ins-recency').textContent = summary.avg_recency + ' days';
      document.getElementById('ins-freq').textContent    = summary.avg_frequency + '×';
    }

    renderPerfTable(compare);
    renderF1Chart(compare);
    renderAUCChart(compare);

  } catch(e) {
    console.warn('Reports:', e);
    comparisonData = demoCompare();
    loadReports();
  }
}

function renderPerfTable(compare) {
  const tbody = document.getElementById('perfTableBody');
  const models = Object.entries(compare);
  const best = models.reduce((a,b) => a[1].accuracy > b[1].accuracy ? a : b);

  tbody.innerHTML = models.map(([name, m]) => {
    const color = MODEL_COLORS[name] || '#888';
    const isBest = name === best[0];
    const stars = m.accuracy >= 89 ? '★★★★★' : m.accuracy >= 87 ? '★★★★☆' : '★★★☆☆';

    return `<tr ${isBest ? 'style="background:rgba(99,102,241,0.05)"' : ''}>
      <td>
        <div class="model-name-cell">
          <span class="model-color-dot" style="background:${color}"></span>
          ${name} ${isBest ? '🏆' : ''}
        </div>
      </td>
      ${['accuracy','precision','recall','f1','auc_roc'].map(k => `
        <td>
          <div class="metric-bar-wrap">
            <div class="metric-bar-bg">
              <div class="metric-bar-fill" style="width:${m[k]}%;background:${color}"></div>
            </div>
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#f1f5f9;min-width:44px;text-align:right">${m[k].toFixed(1)}%</span>
          </div>
        </td>`).join('')}
      <td><span class="badge-bool ${m.needs_scaling?'badge-yes':'badge-no'}">${m.needs_scaling?'Yes':'No'}</span></td>
      <td><span class="star-rating">${stars}</span></td>
    </tr>`;
  }).join('');
}

function renderF1Chart(compare) {
  destroyChart('f1Chart');
  const labels = Object.keys(compare);
  const f1s    = labels.map(l => compare[l].f1);
  const colors = labels.map(l => MODEL_COLORS[l] || '#888');
  chartInstances['f1Chart'] = new Chart(
    document.getElementById('f1Chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels.map(l => l.replace(' Neural Network','').replace(' Regression','')),
      datasets: [{ data: f1s, backgroundColor: colors.map(c=>c+'55'), borderColor: colors, borderWidth:1.5, borderRadius:6, borderSkipped:false }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:11}} },
        y: { min:85, max:95, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>v+'%',font:{size:11}} }
      },
      plugins: { tooltip:{callbacks:{label:ctx=>` F1: ${ctx.parsed.y.toFixed(2)}%`}} },
      animation:{duration:600},
    }
  });
}

function renderAUCChart(compare) {
  destroyChart('aucChart');
  const labels = Object.keys(compare);
  const aucs   = labels.map(l => compare[l].auc_roc);
  const colors = labels.map(l => MODEL_COLORS[l] || '#888');
  chartInstances['aucChart'] = new Chart(
    document.getElementById('aucChart').getContext('2d'), {
    type: 'radar',
    data: {
      labels: labels.map(l => l.replace(' Neural Network','').replace(' Regression','')),
      datasets: [{
        data: aucs,
        backgroundColor: 'rgba(99,102,241,0.12)',
        borderColor: '#6366f1',
        borderWidth: 2,
        pointBackgroundColor: colors,
        pointRadius: 5,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        r: {
          angleLines:{color:'rgba(255,255,255,0.07)'},
          grid:{color:'rgba(255,255,255,0.07)'},
          pointLabels:{color:'#94a3b8',font:{size:11}},
          ticks:{display:false},
          suggestedMin:85, suggestedMax:98,
        }
      },
      plugins: { tooltip:{callbacks:{label:ctx=>` AUC-ROC: ${ctx.parsed.r.toFixed(2)}%`}} },
      animation:{duration:600},
    }
  });
}

// ─── ════════  MODEL COMPARISON  ════════ ───────────────
async function loadModels() {
  try {
    let compare = comparisonData;
    if (!Object.keys(compare).length) {
      compare = await fetchJSON(`${API}/models/compare`);
      comparisonData = compare;
    }
    renderModelCards(compare);
    renderModelRadar(compare);
    renderPRBubble(compare);
  } catch(e) {
    console.warn('Models:', e);
    comparisonData = demoCompare();
    loadModels();
  }
}

function renderModelCards(compare) {
  const grid = document.getElementById('modelCardsGrid');
  const bestModel = Object.entries(compare).reduce((a,b) => a[1].accuracy > b[1].accuracy ? a : b)[0];

  grid.innerHTML = Object.entries(compare).map(([name, m]) => {
    const color   = MODEL_COLORS[name] || '#888';
    const isBest  = name === bestModel;
    return `
    <div class="model-card ${isBest?'best':''}">
      <div class="model-card-name">
        <span class="color-badge" style="background:${color}"></span>
        ${name}
      </div>
      ${[
        ['Accuracy',  m.accuracy  + '%'],
        ['Precision', m.precision + '%'],
        ['Recall',    m.recall    + '%'],
        ['F1 Score',  m.f1        + '%'],
        ['AUC-ROC',   m.auc_roc   + '%'],
        ['Scaling',   m.needs_scaling ? '✓ Required' : '✗ Not needed'],
      ].map(([k,v]) => `
        <div class="metric-row">
          <span class="metric-row-label">${k}</span>
          <span class="metric-row-val" style="${k==='Scaling'?'font-family:Inter':'font-family:JetBrains Mono,monospace'}">${v}</span>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderModelRadar(compare) {
  destroyChart('modelRadar');
  const metrics = ['accuracy','precision','recall','f1','auc_roc'];
  const metricLabels = ['Accuracy','Precision','Recall','F1 Score','AUC-ROC'];

  const datasets = Object.entries(compare).map(([name, m]) => ({
    label: name,
    data: metrics.map(k => m[k]),
    backgroundColor: (MODEL_COLORS[name] || '#888') + '18',
    borderColor: MODEL_COLORS[name] || '#888',
    borderWidth: 2,
    pointRadius: 4,
    pointBackgroundColor: MODEL_COLORS[name] || '#888',
  }));

  chartInstances['modelRadar'] = new Chart(
    document.getElementById('modelRadar').getContext('2d'), {
    type: 'radar',
    data: { labels: metricLabels, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        r: {
          angleLines:{color:'rgba(255,255,255,0.07)'},
          grid:{color:'rgba(255,255,255,0.07)'},
          pointLabels:{color:'#94a3b8',font:{size:12}},
          ticks:{display:false},
          suggestedMin:82, suggestedMax:100,
        }
      },
      plugins: {
        legend:{display:true,position:'bottom',labels:{boxWidth:10,boxHeight:10,font:{size:11}}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.r.toFixed(2)}%`}}
      },
      animation:{duration:700},
    }
  });
}

function renderPRBubble(compare) {
  destroyChart('prBubble');
  const datasets = Object.entries(compare).map(([name, m]) => ({
    label: name,
    data: [{
      x: m.precision,
      y: m.recall,
      r: Math.max(8, (m.auc_roc - 85) * 2.5),
    }],
    backgroundColor: (MODEL_COLORS[name] || '#888') + '66',
    borderColor: MODEL_COLORS[name] || '#888',
    borderWidth: 2,
  }));

  chartInstances['prBubble'] = new Chart(
    document.getElementById('prBubble').getContext('2d'), {
    type: 'bubble',
    data: { datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { min:82,max:92, title:{display:true,text:'Precision (%)',color:'#64748b',font:{size:11}}, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>v+'%',font:{size:11}} },
        y: { min:88,max:102,title:{display:true,text:'Recall (%)',color:'#64748b',font:{size:11}},    grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>v+'%',font:{size:11}} }
      },
      plugins: {
        legend:{display:true,position:'bottom',labels:{boxWidth:10,boxHeight:10,font:{size:11}}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label} — P:${ctx.parsed.x.toFixed(1)}% R:${ctx.parsed.y.toFixed(1)}%`}}
      },
      animation:{duration:700},
    }
  });
}

// Add spin keyframe
const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

// ─── Init ────────────────────────────────────────────────
(function init() {
  checkHealth();
  setInterval(checkHealth, 15000);
  loadDashboard();
})();
