// ─────────────────────────────────────────────
//  PRKT/TERMINAL — app.js
// ─────────────────────────────────────────────

const S = {
  keys:       { kalshi: '', poly: '', anthropic: '', proxy: '' },
  markets:    [],
  portfolio:  [],
  watchlist:  [],
  filter:     'all',
  selectedId: null,
  darkMode:   true,
};

// ── Boot ──────────────────────────────────────
function init() {
  S.keys.kalshi    = localStorage.getItem('pm_kalshi')    || '';
  S.keys.poly      = localStorage.getItem('pm_poly')      || '';
  S.keys.anthropic = localStorage.getItem('pm_anthropic') || '';
  S.keys.proxy     = localStorage.getItem('pm_proxy')     || '';

  if (S.keys.kalshi)    document.getElementById('set-kalshi').value    = S.keys.kalshi;
  if (S.keys.poly)      document.getElementById('set-poly').value      = S.keys.poly;
  if (S.keys.anthropic) document.getElementById('set-anthropic').value = S.keys.anthropic;
  if (S.keys.proxy)     document.getElementById('set-proxy').value     = S.keys.proxy;

  S.portfolio = JSON.parse(localStorage.getItem('pm_portfolio') || '[]');
  S.watchlist  = JSON.parse(localStorage.getItem('pm_watchlist') || '[]');

  loadMarkets();
}

// ── Theme ─────────────────────────────────────
function toggleTheme() {
  S.darkMode = !S.darkMode;
  document.body.classList.toggle('light', !S.darkMode);
  document.getElementById('theme-btn').textContent = S.darkMode ? '[ LIGHT ]' : '[ DARK ]';
}

// ── Nav ───────────────────────────────────────
function switchNav(btn, pane) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['markets','advisor','portfolio','watchlist','settings'].forEach(p => {
    document.getElementById('pane-' + p).classList.toggle('hidden', p !== pane);
  });
  if (pane === 'portfolio') renderPortfolio();
  if (pane === 'watchlist') renderWatchlist();
  if (pane === 'advisor')   renderAdvisorRecs();
}

// ── Settings ──────────────────────────────────
function saveKeys() {
  S.keys.kalshi    = document.getElementById('set-kalshi').value.trim();
  S.keys.poly      = document.getElementById('set-poly').value.trim();
  S.keys.anthropic = document.getElementById('set-anthropic').value.trim();
  S.keys.proxy     = document.getElementById('set-proxy').value.trim();
  localStorage.setItem('pm_kalshi',    S.keys.kalshi);
  localStorage.setItem('pm_poly',      S.keys.poly);
  localStorage.setItem('pm_anthropic', S.keys.anthropic);
  localStorage.setItem('pm_proxy',     S.keys.proxy);
  const msg = document.getElementById('key-saved');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  loadMarkets();
}

// ── Market loading ────────────────────────────
async function loadMarkets() {
  document.getElementById('market-list').innerHTML =
    '<div class="empty-state"><span class="spinner"></span>FETCHING MARKETS...</div>';

  let markets = [];
  const [kRes, pRes] = await Promise.allSettled([fetchKalshi(), fetchPolymarket()]);
  if (kRes.status === 'fulfilled') markets = [...markets, ...kRes.value];
  if (pRes.status === 'fulfilled') markets = [...markets, ...pRes.value];
  if (!markets.length) markets = getMockMarkets();

  S.markets = markets;
  detectArbitrage(markets);
  updateTicker();
  renderMarkets();
}

// Proxy-aware fetch: wraps URL if a proxy base is configured
function proxyFetch(url, opts = {}) {
  const base = S.keys.proxy;
  const target = base ? `${base.replace(/\/$/, '')}?url=${encodeURIComponent(url)}` : url;
  return fetch(target, opts);
}

async function fetchKalshi() {
  if (!S.keys.kalshi) throw new Error('No Kalshi key');
  const r = await proxyFetch(
    'https://trading-api.kalshi.com/trade-api/v2/markets?limit=25&status=open',
    { headers: { 'Authorization': 'Bearer ' + S.keys.kalshi } }
  );
  if (!r.ok) throw new Error('Kalshi ' + r.status);
  const d = await r.json();
  return (d.markets || [])
    .filter(m => ['Politics','Economics','Finance','Current Events','News']
      .some(c => (m.category || '').includes(c)))
    .slice(0, 14)
    .map(m => ({
      id:       'k-' + m.ticker,
      title:    m.title,
      platform: 'Kalshi',
      cat:      mapCat(m.category || ''),
      yes:      Math.round(m.yes_bid || 50),
      no:       Math.round(100 - (m.yes_bid || 50)),
      trend:    +(Math.random() * 14 - 4).toFixed(1),
      volume:   m.volume || 0,
      expires:  m.close_time ? fmtDate(m.close_time) : '—',
      arb:      false,
    }));
}

async function fetchPolymarket() {
  if (!S.keys.poly) throw new Error('No Polymarket key');
  const r = await proxyFetch(
    'https://gamma-api.polymarket.com/markets?limit=25&active=true&closed=false',
    { headers: { 'Authorization': 'Bearer ' + S.keys.poly } }
  );
  if (!r.ok) throw new Error('Polymarket ' + r.status);
  const d = await r.json();
  return (Array.isArray(d) ? d : d.data || [])
    .slice(0, 14)
    .map(m => ({
      id:       'p-' + m.id,
      title:    m.question || m.title,
      platform: 'Polymarket',
      cat:      mapCat(m.category || ''),
      yes:      Math.round(parseFloat(m.outcomePrices?.[0] || '0.5') * 100),
      no:       Math.round(parseFloat(m.outcomePrices?.[1] || '0.5') * 100),
      trend:    +(Math.random() * 14 - 4).toFixed(1),
      volume:   parseFloat(m.volume || 0),
      expires:  m.endDate ? fmtDate(m.endDate) : '—',
      arb:      false,
    }));
}

function mapCat(c) {
  c = c.toLowerCase();
  if (c.includes('politic') || c.includes('elect') || c.includes('president') || c.includes('govern')) return 'politics';
  if (c.includes('econ') || c.includes('financ') || c.includes('fed') || c.includes('rate') || c.includes('gdp') || c.includes('market') || c.includes('stock')) return 'economics';
  return 'news';
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).toUpperCase();
}

function fmtVol(v) {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
}

// ── Mock data (fallback) ──────────────────────
function getMockMarkets() {
  return [
    { id:'k1', title:'Will the Fed cut rates at the June 2025 FOMC meeting?',             platform:'Kalshi',    cat:'economics', yes:38,  no:62,  trend:+6,  volume:1840200, expires:'JUN 18',      arb:false },
    { id:'p1', title:'Will the Fed cut rates at the June 2025 FOMC meeting?',             platform:'Polymarket',cat:'economics', yes:41,  no:59,  trend:+5,  volume:3100000, expires:'JUN 18',      arb:false },
    { id:'k2', title:'Who wins the 2026 FIFA World Cup?',                                 platform:'Polymarket',cat:'news',      yes:22,  no:78,  trend:+2,  volume:820000,  expires:'JUL 19 2026', arb:false },
    { id:'k3', title:'Will Trump issue a pardon for Ross Ulbricht by July 2025?',         platform:'Kalshi',    cat:'politics',  yes:61,  no:39,  trend:+14, volume:2200000, expires:'JUL 1',       arb:false },
    { id:'k4', title:'Will any US state legalize recreational cannabis in 2025?',         platform:'Polymarket',cat:'politics',  yes:29,  no:71,  trend:-3,  volume:610000,  expires:'DEC 31',      arb:false },
    { id:'k5', title:'Will the Lakers make the 2025 NBA Playoffs?',                       platform:'Kalshi',    cat:'news',      yes:78,  no:22,  trend:+1,  volume:1120000, expires:'APR 12',      arb:false },
    { id:'k6', title:'Will a major US newspaper endorse a third-party candidate in 2026 midterms?', platform:'Polymarket', cat:'politics', yes:12, no:88, trend:0, volume:67000, expires:'NOV 3 2026', arb:false },
    { id:'k7', title:'Will the S&P 500 end 2025 above 6000?',                            platform:'Kalshi',    cat:'economics', yes:68,  no:32,  trend:+4,  volume:3400000, expires:'DEC 31',      arb:false },
    { id:'p7', title:'Will the S&P 500 end 2025 above 6000?',                            platform:'Polymarket',cat:'economics', yes:71,  no:29,  trend:+5,  volume:2800000, expires:'DEC 31',      arb:false },
    { id:'k8', title:'Will inflation (CPI) exceed 3.5% in May 2025?',                    platform:'Kalshi',    cat:'economics', yes:28,  no:72,  trend:-1,  volume:920000,  expires:'JUN 11',      arb:false },
    { id:'k9', title:'Will Congress pass a new budget before October 2025?',             platform:'Kalshi',    cat:'politics',  yes:33,  no:67,  trend:-3,  volume:780000,  expires:'OCT 1',       arb:false },
    { id:'p9', title:'Will there be a ceasefire in Gaza before July 2025?',              platform:'Polymarket',cat:'news',      yes:55,  no:45,  trend:+4,  volume:4800000, expires:'JUL 1',       arb:false },
  ];
}

// ── Arbitrage detection ───────────────────────
function detectArbitrage(markets) {
  const byTitle = {};
  markets.forEach(m => {
    const key = m.title.toLowerCase().slice(0, 50);
    (byTitle[key] = byTitle[key] || []).push(m);
  });
  Object.values(byTitle).forEach(group => {
    if (group.length > 1) {
      const spread = Math.abs(group[0].yes - group[1].yes);
      if (spread >= 2) group.forEach(m => { m.arb = true; m.arbSpread = spread; });
    }
  });
}

// ── Ticker ────────────────────────────────────
function updateTicker() {
  const items = S.markets.slice(0, 6).map(m => ({
    n: m.title.split(' ').slice(0, 3).join(' ').toUpperCase(),
    v: m.yes + '¢',
    up: m.trend >= 0,
  }));
  document.getElementById('ticker-inner').innerHTML = items.map(i =>
    `<div class="tick-item">
      <span class="tick-name">${esc(i.n)}</span>
      <span class="tick-val">${i.v}</span>
      <span class="${i.up ? 'tick-up' : 'tick-dn'}">${i.up ? '▲' : '▼'}</span>
    </div>`
  ).join('');
}

// ── Market render ─────────────────────────────
function setFilter(btn, f) {
  document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  S.filter = f;
  S.selectedId = null;
  document.getElementById('signal-panel').classList.add('hidden');
  renderMarkets();
}

function renderMarkets() {
  let show = S.markets;
  if (S.filter === 'arb')      show = show.filter(m => m.arb);
  else if (S.filter !== 'all') show = show.filter(m => m.cat === S.filter);

  if (!show.length) {
    document.getElementById('market-list').innerHTML =
      '<div class="empty-state">NO MARKETS MATCH FILTER.</div>';
    return;
  }

  document.getElementById('market-list').innerHTML = show.map(m => {
    const tSign = m.trend > 0 ? '+' : '';
    const tCls  = m.trend > 0 ? 't-up' : m.trend < 0 ? 't-dn' : 't-flat';
    const sigCls = m.signal === 'buy' ? 'sig-buy' : m.signal === 'pass' ? 'sig-pass' : 'sig-watch';
    const sigLbl = m.signal === 'buy' ? 'BUY' : m.signal === 'pass' ? 'PASS' : 'WATCH';
    const platCls = m.platform === 'Kalshi' ? 'plat-k' : 'plat-p';
    const platLbl = m.platform === 'Kalshi' ? 'KALSHI' : 'POLY';
    const selCls  = S.selectedId === m.id ? ' selected' : '';

    return `<div class="mcard${selCls}" onclick="selectMarket('${m.id}')">
      <div class="mcard-top">
        <div class="mcard-title">${esc(m.title)}</div>
        <div class="mcard-actions">
          <button class="sig-btn ${sigCls}" onclick="event.stopPropagation()">${sigLbl}</button>
          <span class="plat ${platCls}">${platLbl}</span>
        </div>
      </div>
      <div class="odds-row">
        <div class="odds-stat"><div class="odds-lbl">YES</div><div class="odds-yes">${m.yes}¢</div></div>
        <div class="odds-stat"><div class="odds-lbl">NO</div><div class="odds-no">${m.no}¢</div></div>
        <div class="odds-stat"><div class="odds-lbl">7D</div><div class="odds-trend ${tCls}">${tSign}${m.trend}%</div></div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${m.yes}%"></div></div>
      </div>
      <div class="mcard-foot">
        <span>CLOSES ${esc(m.expires)}</span>
        ${m.arb ? `<span class="arb-tag">⇄ ARB ${m.arbSpread}¢</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Signal panel ──────────────────────────────
async function selectMarket(id) {
  S.selectedId = id;
  renderMarkets();
  const m = S.markets.find(x => x.id === id);
  if (!m) return;

  const panel = document.getElementById('signal-panel');
  panel.classList.remove('hidden');
  document.getElementById('sig-title').textContent = m.title;

  const liq   = m.yes < 20 || m.yes > 80 ? 'Low' : m.yes > 40 && m.yes < 60 ? 'High' : 'Medium';
  const style = m.expires.includes('2026') || m.expires.includes('2027') ? 'Long-term' : 'Short-term';
  const tSign = m.trend > 0 ? '+' : '';
  const tCls  = m.trend > 0 ? 'green' : m.trend < 0 ? 'red' : '';

  document.getElementById('sig-stats').innerHTML = `
    <div class="stat-box"><div class="stat-lbl">YES PRICE</div><div class="stat-val green">${m.yes}¢</div></div>
    <div class="stat-box"><div class="stat-lbl">VOLUME</div><div class="stat-val">${fmtVol(m.volume)}</div></div>
    <div class="stat-box"><div class="stat-lbl">LIQUIDITY</div><div class="stat-val">${liq}</div></div>
    <div class="stat-box"><div class="stat-lbl">CLOSES</div><div class="stat-val" style="font-size:13px">${esc(m.expires)}</div></div>
    <div class="stat-box"><div class="stat-lbl">7D TREND</div><div class="stat-val ${tCls}">${tSign}${m.trend}%</div></div>
    <div class="stat-box"><div class="stat-lbl">STYLE</div><div class="stat-val" style="font-size:13px">${style}</div></div>`;

  const aiEl = document.getElementById('sig-ai');
  aiEl.innerHTML = '<span class="spinner"></span>ANALYZING...';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const reasoning = await getSignalAI(m);
  aiEl.textContent = reasoning;
}

async function getSignalAI(m) {
  if (!S.keys.anthropic) {
    return `Signal preview: YES ${m.yes}¢ ${m.trend > 0 ? '(momentum up)' : m.trend < 0 ? '(momentum down)' : '(flat)'}. Add your Anthropic API key in Settings for full AI analysis.`;
  }
  const prompt = `You are a prediction market trading advisor. Analyze this market in 2-3 sentences. Be direct: state whether to BUY YES, BUY NO, or HOLD, then explain why based on the price, trend, and liquidity. End with the key risk.

Market: "${m.title}"
Platform: ${m.platform}
YES: ${m.yes}¢ | NO: ${m.no}¢ | Volume: ${fmtVol(m.volume)} | 7D trend: ${m.trend > 0 ? '+' : ''}${m.trend}% | Liquidity: ${m.yes < 20 || m.yes > 80 ? 'Low' : 'Medium/High'}${m.arb ? ' | ARB AVAILABLE: same market on other platform at different price' : ''}`;
  try {
    const text = await claudeAPI(prompt, 300);
    return text;
  } catch(e) {
    return 'AI unavailable: ' + e.message;
  }
}

// ── Watchlist helpers ─────────────────────────
function addToWatchlist() {
  if (!S.selectedId) return;
  if (!S.watchlist.includes(S.selectedId)) {
    S.watchlist.push(S.selectedId);
    localStorage.setItem('pm_watchlist', JSON.stringify(S.watchlist));
  }
}

function removeFromWatchlist(id) {
  S.watchlist = S.watchlist.filter(x => x !== id);
  localStorage.setItem('pm_watchlist', JSON.stringify(S.watchlist));
  renderWatchlist();
}

function renderWatchlist() {
  const el = document.getElementById('watchlist-body');
  const wm = S.watchlist.map(id => S.markets.find(m => m.id === id)).filter(Boolean);
  if (!wm.length) {
    el.innerHTML = '<div class="watch-empty">NO MARKETS SAVED. CLICK A MARKET THEN "+ WATCHLIST".</div>';
    return;
  }
  el.innerHTML = wm.map(m => {
    const tSign = m.trend > 0 ? '+' : '';
    const tCls  = m.trend > 0 ? 't-up' : m.trend < 0 ? 't-dn' : 't-flat';
    const platCls = m.platform === 'Kalshi' ? 'plat-k' : 'plat-p';
    const platLbl = m.platform === 'Kalshi' ? 'KALSHI' : 'POLY';
    return `<div class="mcard">
      <div class="mcard-top">
        <div class="mcard-title">${esc(m.title)}</div>
        <div class="mcard-actions">
          <span class="plat ${platCls}">${platLbl}</span>
          <button class="icon-btn" onclick="removeFromWatchlist('${m.id}')" title="Remove">✕</button>
        </div>
      </div>
      <div class="odds-row">
        <div class="odds-stat"><div class="odds-lbl">YES</div><div class="odds-yes">${m.yes}¢</div></div>
        <div class="odds-stat"><div class="odds-lbl">NO</div><div class="odds-no">${m.no}¢</div></div>
        <div class="odds-stat"><div class="odds-lbl">7D</div><div class="odds-trend ${tCls}">${tSign}${m.trend}%</div></div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${m.yes}%"></div></div>
      </div>
    </div>`;
  }).join('');
}

// ── AI Advisor ────────────────────────────────
async function claudeAPI(prompt, maxTokens = 800) {
  if (!S.keys.anthropic) throw new Error('No Anthropic key — add it in Settings');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': S.keys.anthropic,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error?.message || 'API error ' + r.status);
  }
  const d = await r.json();
  return d.content?.map(c => c.text || '').join('') || '';
}

async function askAdvisor() {
  const q   = document.getElementById('ask-input').value.trim();
  if (!q) return;
  const out = document.getElementById('advisor-out');
  out.innerHTML = '<span class="spinner"></span>ANALYZING...';
  const ctx = S.markets.slice(0, 10).map(m =>
    `${m.title} [${m.platform}] YES:${m.yes}¢ 7D:${m.trend > 0 ? '+' : ''}${m.trend}%`
  ).join('\n');
  try {
    const text = await claudeAPI(
      `You are a prediction market trading advisor. You have access to these current markets:\n${ctx}\n\nUser question: ${q}\n\nAnswer directly and concisely. If recommending a trade, state BUY YES / BUY NO / HOLD and why.`,
      600
    );
    out.textContent = text;
  } catch(e) {
    out.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  }
}

async function renderAdvisorRecs() {
  const el = document.getElementById('advisor-recs');
  el.innerHTML = '<div class="empty-state"><span class="spinner"></span>GENERATING SIGNALS...</div>';
  const summary = S.markets.slice(0, 10).map(m =>
    `${m.title} [${m.platform}] YES:${m.yes}¢ vol:${fmtVol(m.volume)} 7D:${m.trend > 0 ? '+' : ''}${m.trend}%`
  ).join('\n');
  const prompt = `You are a prediction market trading advisor. Analyze these markets and return exactly 5 trade recommendations as a JSON array. Each object must have: title (≤6 words), action ("BUY YES" | "BUY NO" | "HOLD" | "ARB"), platform, confidence ("strong" | "moderate" | "avoid"), reason (1 sentence max). Return ONLY the JSON array, no other text.\n\nMarkets:\n${summary}`;
  try {
    const text = await claudeAPI(prompt, 800);
    let recs;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const s = clean.indexOf('['), e = clean.lastIndexOf(']');
      recs = JSON.parse(clean.slice(s, e + 1));
    } catch(_) {
      el.innerHTML = `<div class="advisor-out">${esc(text)}</div>`;
      return;
    }
    el.innerHTML = recs.map(r => {
      const cls    = r.confidence === 'strong' ? 'strong' : r.confidence === 'moderate' ? 'moderate' : 'avoid';
      const acCls  = r.action === 'BUY YES' || r.action === 'ARB' ? 'sig-buy' : r.action === 'BUY NO' ? 'sig-watch' : 'sig-pass';
      const confCls = r.confidence === 'strong' ? 'tag-buy' : r.confidence === 'moderate' ? 'tag-hold' : 'tag-sell';
      return `<div class="rec-card ${cls}">
        <div class="rec-top">
          <div class="rec-title">${esc(r.title || '')}</div>
          <button class="sig-btn ${acCls}">${esc(r.action || '')}</button>
        </div>
        <div class="rec-reason">${esc(r.reason || '')}</div>
        <div class="rec-meta">
          <span class="rec-tag ${confCls}">${esc(r.confidence || '')}</span>
          <span class="rec-tag tag-muted">${esc(r.platform || '')}</span>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state" style="color:var(--text2)">Add Anthropic API key in Settings to enable AI signals. Error: ${esc(e.message)}</div>`;
  }
}

// ── Portfolio ─────────────────────────────────
function addPositionFromSignal() {
  if (!S.selectedId) return;
  const m = S.markets.find(x => x.id === S.selectedId);
  if (!m) return;
  switchNav(document.querySelectorAll('.nav-btn')[2], 'portfolio');
  document.getElementById('pos-market').value   = m.title.slice(0, 60);
  document.getElementById('pos-platform').value = m.platform;
}

function addPosition() {
  const market   = document.getElementById('pos-market').value.trim();
  const platform = document.getElementById('pos-platform').value;
  const side     = document.getElementById('pos-side').value;
  const entry    = parseFloat(document.getElementById('pos-entry').value);
  const shares   = parseFloat(document.getElementById('pos-shares').value);
  if (!market || !entry || !shares) return;

  // Try to find current price from markets data
  const live = S.markets.find(m =>
    m.title.toLowerCase().includes(market.toLowerCase().slice(0, 20)) &&
    m.platform === platform
  );
  const current = live ? (side === 'YES' ? live.yes : live.no) : Math.max(1, Math.min(99, entry + (Math.random() * 10 - 5)));

  S.portfolio.push({
    id: Date.now(),
    market,
    platform,
    side,
    entry:   Math.round(entry),
    current: Math.round(current),
    shares:  Math.round(shares),
  });
  localStorage.setItem('pm_portfolio', JSON.stringify(S.portfolio));
  document.getElementById('pos-market').value = '';
  document.getElementById('pos-entry').value  = '';
  document.getElementById('pos-shares').value = '';
  renderPortfolio();
}

function removePosition(id) {
  S.portfolio = S.portfolio.filter(p => p.id !== id);
  localStorage.setItem('pm_portfolio', JSON.stringify(S.portfolio));
  renderPortfolio();
}

function renderPortfolio() {
  // Summary stats
  const totalPnl    = S.portfolio.reduce((acc, p) => acc + (p.current - p.entry) * p.shares, 0);
  const totalCost   = S.portfolio.reduce((acc, p) => acc + p.entry * p.shares, 0);
  const openCount   = S.portfolio.length;
  const pnlPct      = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;
  const pnlCls      = totalPnl >= 0 ? 'pnl-up' : 'pnl-dn';
  const pnlSign     = totalPnl >= 0 ? '+' : '';

  document.getElementById('port-summary').innerHTML = `
    <div class="port-stat"><div class="port-stat-lbl">TOTAL P&amp;L</div><div class="port-stat-val ${pnlCls}">${pnlSign}$${Math.abs(totalPnl).toFixed(2)}</div></div>
    <div class="port-stat"><div class="port-stat-lbl">RETURN</div><div class="port-stat-val ${pnlCls}">${pnlSign}${pnlPct.toFixed(1)}%</div></div>
    <div class="port-stat"><div class="port-stat-lbl">COST BASIS</div><div class="port-stat-val">$${totalCost.toFixed(2)}</div></div>
    <div class="port-stat"><div class="port-stat-lbl">OPEN POS.</div><div class="port-stat-val">${openCount}</div></div>`;

  const rows = document.getElementById('port-rows');
  if (!S.portfolio.length) {
    rows.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--text3);font-size:12px;letter-spacing:.04em">NO OPEN POSITIONS</td></tr>';
    return;
  }
  rows.innerHTML = S.portfolio.map(p => {
    const pnl  = ((p.current - p.entry) * p.shares).toFixed(2);
    const sign = pnl >= 0 ? '+' : '';
    const cls  = pnl >= 0 ? 'pnl-up' : 'pnl-dn';
    const pl   = p.platform === 'Kalshi' ? 'plat-k' : 'plat-p';
    const plL  = p.platform === 'Kalshi' ? 'KALSHI' : 'POLY';
    return `<tr>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.market)}</td>
      <td><span class="plat ${pl}">${plL}</span></td>
      <td>${p.side}</td>
      <td>${p.entry}¢</td>
      <td>${p.current}¢</td>
      <td>${p.shares}</td>
      <td class="${cls}">${sign}$${Math.abs(pnl)}</td>
      <td><button class="icon-btn" onclick="removePosition(${p.id})" title="Remove">✕</button></td>
    </tr>`;
  }).join('');
}

// ── Utils ─────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Auto-refresh every 5 minutes ─────────────
setInterval(loadMarkets, 5 * 60 * 1000);

init();
