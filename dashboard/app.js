/* 醫院總額申報儀表板 — 純前端，讀取 data.json */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const state = {
    view: 'overview',
    mode: 'month',
    start: 0,
    end: 0,
    type: 'all',
    region: '',
    level: '',
    system: '',
    search: '',
    sortKey: 'tot',
    sortDir: -1,
    ovMetric: 'pts',
    tmuMetric: 'pts',
  };

  let D = null; // data.json
  const TMU = '北醫大體系';
  const TMU_ORDER = [
    ['臺北醫學大學附設', '附醫'],
    ['萬芳', '萬芳'],
    ['雙和', '雙和'],
    ['新國民', '新國民'],
  ];

  // ---------- 格式化 ----------
  const ymLabel = (ym) => `${Math.floor(ym / 100) + 1911}/${String(ym % 100).padStart(2, '0')}`;
  const rocLabel = (ym) => `${Math.floor(ym / 100)} 年 ${ym % 100} 月`;
  const nf = (d) => new Intl.NumberFormat('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NF = [nf(0), nf(1), nf(2)];
  const fmt = (v, d = 0) => (v == null || !isFinite(v) ? '–' : NF[d].format(v));
  const fmtSigned = (v, d = 0) => (v == null || !isFinite(v) ? '–' : (v > 0 ? '+' : '') + NF[d].format(v));
  const growth = (cur, prev) => (prev ? (cur - prev) / prev * 100 : null);
  const pctCell = (g) => {
    if (g == null || !isFinite(g)) return '<td>–</td>';
    return `<td class="${g < 0 ? 'down' : ''}">${fmt(g, 1)}%</td>`;
  };
  const chip = (g) => {
    if (g == null || !isFinite(g)) return '<span class="chip">–</span>';
    const up = g >= 0;
    return `<span class="chip ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${fmt(Math.abs(g), 1)}%</span>`;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 計算 ----------
  function period() {
    const e = state.end;
    let s = e;
    if (state.mode === 'ytd') {
      const y = Math.floor(D.months[e] / 100);
      s = D.months.findIndex((m) => Math.floor(m / 100) === y);
    } else if (state.mode === 'range') {
      s = Math.min(state.start, e);
    }
    return [s, e];
  }

  // 回傳某醫院在期間 [s,e] 的月平均：{op, oc, ip, ic}
  function hospAvg(h, s, e) {
    if (s < 0) return null;
    const n = e - s + 1;
    const r = { op: 0, oc: 0, ip: 0, ic: 0 };
    for (const k in r) {
      const arr = h[k];
      let t = 0;
      for (let i = s; i <= e; i++) t += arr[i] || 0;
      r[k] = t / n;
    }
    return r;
  }

  function sumAvg(hs, s, e) {
    const r = { op: 0, oc: 0, ip: 0, ic: 0 };
    if (s < 0) return null;
    for (const h of hs) {
      const a = hospAvg(h, s, e);
      for (const k in r) r[k] += a[k];
    }
    return r;
  }

  // 依門/住篩選取出點數與件數
  function pick(a, type = state.type) {
    if (!a) return null;
    if (type === 'op') return { pts: a.op, cases: a.oc };
    if (type === 'ip') return { pts: a.ip, cases: a.ic };
    return { pts: a.op + a.ip, cases: a.oc + a.ic };
  }

  function metrics(hs, type) {
    const [s, e] = period();
    const cur = pick(sumAvg(hs, s, e), type);
    const prev = pick(sumAvg(hs, s - 12, e - 12), type);
    const avg = (x) => (x && x.cases ? x.pts / x.cases : null);
    return {
      pts: cur.pts, ptsPrev: prev ? prev.pts : null,
      cases: cur.cases, casesPrev: prev ? prev.cases : null,
      avg: avg(cur), avgPrev: avg(prev),
    };
  }

  const filterHosp = ({ region = state.region, level = state.level, system = '' } = {}) =>
    D.hospitals.filter((h) => (!region || h.region === region) && (!level || h.level === level) && (!system || h.system === system));

  // 單一醫院群的每月數列（指定指標）
  function monthlySeries(hs, metric, type = state.type) {
    return D.months.map((_, i) => {
      let pts = 0, cases = 0;
      for (const h of hs) {
        const p = pick({ op: h.op[i] || 0, oc: h.oc[i] || 0, ip: h.ip[i] || 0, ic: h.ic[i] || 0 }, type);
        pts += p.pts; cases += p.cases;
      }
      if (metric === 'pts') return pts / 1e8;
      if (metric === 'cases') return cases / 1e3;
      return cases ? pts / cases : null;
    });
  }

  // 取結束月份所屬年度與前一年度的 1–12 月數列
  function yearPair(series) {
    const y = Math.floor(D.months[state.end] / 100);
    const out = { cur: Array(12).fill(null), prev: Array(12).fill(null), y };
    D.months.forEach((m, i) => {
      const yy = Math.floor(m / 100), mm = (m % 100) - 1;
      if (yy === y && i <= state.end) out.cur[mm] = series[i];
      if (yy === y - 1) out.prev[mm] = series[i];
    });
    return out;
  }

  // ---------- 圖表 ----------
  const tip = $('#tooltip');
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  function niceTicks(min, max, count = 4) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { ticks, lo, hi, step };
  }

  function lineChart(el, { labels, series, digits, unit, height = 260 }) {
    const W = Math.max(280, el.clientWidth || 600);
    const H = height;
    const pad = { l: 48, r: 18, t: 18, b: 28 };
    const all = series.flatMap((s) => s.values).filter((v) => v != null && isFinite(v));
    if (!all.length) { el.innerHTML = '<p class="muted">此條件無資料</p>'; return; }
    let min = Math.min(...all), max = Math.max(...all);
    const padV = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;
    const { ticks, lo, hi, step } = niceTicks(min - padV, max + padV);
    const x = (i) => pad.l + (W - pad.l - pad.r) * (i / (labels.length - 1));
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
    const tickDigits = Math.max(0, Math.min(3, -Math.floor(Math.log10(step) + 1e-9)));

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
    for (const t of ticks) {
      svg += `<line class="gridline" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>`;
      svg += `<text class="axis-label" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t, tickDigits)}</text>`;
    }
    labels.forEach((lb, i) => {
      svg += `<text class="axis-label" x="${x(i)}" y="${H - 8}" text-anchor="middle">${lb}</text>`;
    });
    svg += `<line class="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>`;
    for (const s of series) {
      let d = '', pen = false;
      s.values.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      svg += `<path class="line" d="${d}" stroke="${s.color}" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      s.values.forEach((v, i) => {
        if (v == null) return;
        svg += `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="${s.dash ? 3 : 4}" fill="${s.color}"/>`;
      });
      // 只標註每條線最後一點
      let li = -1;
      s.values.forEach((v, i) => { if (v != null) li = i; });
      if (li >= 0) {
        const above = s.labelAbove !== false;
        svg += `<text class="val-label" x="${x(li)}" y="${y(s.values[li]) + (above ? -10 : 18)}" text-anchor="middle">${fmt(s.values[li], digits)}</text>`;
      }
    }
    svg += `<rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent" class="hit"/>`;
    svg += '</svg>';
    const legend = '<div class="legend">' + series.map((s) =>
      `<span><i class="${s.dash ? 'dash' : ''}" style="background:${s.color};color:${s.color}"></i>${esc(s.name)}</span>`).join('') + '</div>';
    el.innerHTML = legend + svg;

    const svgEl = el.querySelector('svg');
    const cross = svgEl.querySelector('.crosshair');
    const hit = svgEl.querySelector('.hit');
    hit.addEventListener('mousemove', (ev) => {
      const rect = svgEl.getBoundingClientRect();
      const px = (ev.clientX - rect.left) * (W / rect.width);
      const i = Math.max(0, Math.min(labels.length - 1, Math.round((px - pad.l) / ((W - pad.l - pad.r) / (labels.length - 1)))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      const rows = series.map((s) =>
        `<div class="t-row"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b>${fmt(s.values[i], digits)}</b></div>`).join('');
      const [a, b] = series.map((s) => s.values[i]);
      const g = series.length === 2 && a != null && b != null ? growth(b, a) : null;
      showTip(`<div class="t-head">${labels[i]} 月 ${unit ? '（' + unit + '）' : ''}</div>${rows}` +
        (g != null ? `<div class="t-row"><span>成長</span><b>${fmtSigned(g, 1)}%</b></div>` : ''), ev.clientX, ev.clientY);
    });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }

  const METRIC = {
    pts: { label: '點數', unit: '億點', digits: 1 },
    cases: { label: '件數', unit: '千件', digits: 0 },
    avg: { label: '點/件', unit: '點/件', digits: 0 },
  };

  // 數值小時多給小數位，避免單一小醫院的圖全部顯示成同一個數字
  function chartDigits(pair, metric, base) {
    if (metric === 'avg') return base;
    const max = Math.max(...pair.cur.concat(pair.prev).filter((v) => v != null));
    if (max < 1) return 2;
    if (max < 20) return 1;
    return base;
  }

  function yearChart(el, hs, metric, type, height) {
    const pair = yearPair(monthlySeries(hs, metric, type));
    const m = METRIC[metric];
    const prevAbove = pair.prev[11] != null && pair.cur.some((v) => v != null);
    lineChart(el, {
      labels: Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')),
      series: [
        { name: `${pair.y - 1 + 1911} 年（同期）`, color: 'var(--series-prev)', values: pair.prev, dash: true, labelAbove: prevAbove },
        { name: `${pair.y + 1911} 年`, color: 'var(--series-cur)', values: pair.cur },
      ],
      digits: chartDigits(pair, metric, m.digits),
      unit: m.unit,
      height,
    });
  }

  // ---------- 表格：分區 / 層級 ----------
  function summaryTable(el, rows, firstHead) {
    const head = `<thead>
      <tr><th></th><th class="group sep" colspan="4">點數</th><th class="group sep" colspan="4">件數</th><th class="group sep" colspan="4">平均點數</th></tr>
      <tr><th>${firstHead}</th>
        <th class="sep">億點/月</th><th>同期</th><th>△億點</th><th>成長%</th>
        <th class="sep">千件/月</th><th>同期</th><th>△件數</th><th>成長%</th>
        <th class="sep">點/件</th><th>同期</th><th>△點</th><th>成長%</th></tr></thead>`;
    const body = rows.map(({ name, m, total }) => `<tr class="${total ? 'total' : ''}">
      <td>${esc(name)}</td>
      <td class="sep">${fmt(m.pts / 1e8, 1)}</td><td>${fmt(m.ptsPrev / 1e8, 1)}</td><td>${fmtSigned((m.pts - m.ptsPrev) / 1e8, 1)}</td>${pctCell(growth(m.pts, m.ptsPrev))}
      <td class="sep">${fmt(m.cases / 1e3)}</td><td>${fmt(m.casesPrev / 1e3)}</td><td>${fmtSigned((m.cases - m.casesPrev) / 1e3)}</td>${pctCell(growth(m.cases, m.casesPrev))}
      <td class="sep">${fmt(m.avg)}</td><td>${fmt(m.avgPrev)}</td><td>${fmtSigned(m.avg - m.avgPrev)}</td>${pctCell(growth(m.avg, m.avgPrev))}
    </tr>`).join('');
    el.innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  const ICONS = {
    pts: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-6"/></svg>',
    cases: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/></svg>',
    avg: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/></svg>',
  };

  function kpiCard({ label, icon, value, unit, g, foot, accent, sub }) {
    return `<div class="card kpi ${accent ? 'accent' : ''}">
      <div class="kpi-label"><span>${label}</span><span class="kpi-icon">${icon}</span></div>
      <div class="kpi-value">${value}<small>${unit || ''}</small></div>
      <div class="kpi-foot">${g !== undefined ? chip(g) : ''}<span>${foot || ''}</span></div>
      ${sub || ''}
    </div>`;
  }

  // ---------- 畫面：全國概況 ----------
  function renderOverview() {
    const hs = filterHosp();
    const m = metrics(hs, state.type);
    const tmu = metrics(D.hospitals.filter((h) => h.system === TMU), state.type);
    const tmuShare = m.pts ? tmu.pts / metrics(D.hospitals, state.type).pts * 100 : null;
    const scope = [state.region || '全國', state.level || '', { all: '', op: '門診', ip: '住診' }[state.type]].filter(Boolean).join(' · ');

    $('#kpis').innerHTML = [
      kpiCard({ label: `申報點數（${scope}）`, icon: ICONS.pts, value: fmt(m.pts / 1e8, 1), unit: '億點/月', g: growth(m.pts, m.ptsPrev), foot: `同期 ${fmt(m.ptsPrev / 1e8, 1)}　△ ${fmtSigned((m.pts - m.ptsPrev) / 1e8, 1)}` }),
      kpiCard({ label: '申報件數', icon: ICONS.cases, value: fmt(m.cases / 1e3), unit: '千件/月', g: growth(m.cases, m.casesPrev), foot: `同期 ${fmt(m.casesPrev / 1e3)}　△ ${fmtSigned((m.cases - m.casesPrev) / 1e3)}` }),
      kpiCard({ label: '平均點數', icon: ICONS.avg, value: fmt(m.avg), unit: '點/件', g: growth(m.avg, m.avgPrev), foot: `同期 ${fmt(m.avgPrev)}　△ ${fmtSigned(m.avg - m.avgPrev)}` }),
      kpiCard({ label: '北醫大體系', icon: ICONS.star, value: fmt(tmu.pts / 1e8, 1), unit: '億點/月', g: growth(tmu.pts, tmu.ptsPrev), foot: `全國佔率 ${fmt(tmuShare, 1)}%`, accent: true,
        sub: `<div class="kpi-sub"><div>千件/月<b>${fmt(tmu.cases / 1e3)}</b></div><div>點/件<b>${fmt(tmu.avg)}</b></div><div>件數成長<b>${fmtSigned(growth(tmu.cases, tmu.casesPrev), 1)}%</b></div></div>` }),
    ].join('');

    const met = METRIC[state.ovMetric];
    $('#trendNote').textContent = `${scope}・單位：${met.unit}（每月）`;
    yearChart($('#ovChart'), hs, state.ovMetric, state.type, 280);

    // 分區成長
    const regionRows = D.regions.map((r) => ({ name: r, m: metrics(filterHosp({ region: r }), state.type) }));
    const all = metrics(filterHosp({ region: '' }), state.type);
    const items = [{ name: '全國', m: all }, ...regionRows].map((r) => ({ name: r.name, g: growth(r.m.pts, r.m.ptsPrev) }));
    const maxAbs = Math.max(1, ...items.map((i) => Math.abs(i.g || 0)));
    const hasNeg = items.some((i) => (i.g || 0) < 0);
    const zero = hasNeg ? 50 : 0;
    const scale = hasNeg ? 50 : 100;
    $('#regionBars').innerHTML = '<div class="bars">' + items.map((i) => {
      const w = Math.abs(i.g || 0) / maxAbs * scale;
      const left = (i.g || 0) < 0 ? zero - w : zero;
      return `<div class="bar-row" title="${esc(i.name)}：${fmtSigned(i.g, 1)}%">
        <span>${esc(i.name)}</span>
        <div class="bar-track"><div class="zero" style="left:${zero}%"></div><div class="bar ${(i.g || 0) < 0 ? 'neg' : ''}" style="left:${left}%;width:${Math.max(w, 0.5)}%"></div></div>
        <span class="v ${(i.g || 0) < 0 ? 'down' : ''}">${fmtSigned(i.g, 1)}%</span></div>`;
    }).join('') + '</div>';

    summaryTable($('#regionTable'), [{ name: '全國', m: all, total: true }, ...regionRows], '分區');
    const levelRows = D.levels.map((l) => ({ name: l, m: metrics(filterHosp({ level: l }), state.type) }));
    summaryTable($('#levelTable'), [{ name: state.region || '全國', m: metrics(filterHosp({ level: '' }), state.type), total: true }, ...levelRows], '層級');
  }

  // ---------- 畫面：各醫院 ----------
  let hospRows = [];
  const HOSP_COLS = [
    { k: 'lv', t: '層級', cls: 'lv', s: true },
    { k: 'name', t: '醫院', cls: 'name', s: true },
    { k: 'region', t: '分區', cls: 'lv', s: true },
    { k: 'tot', t: '億點', g: 'tot', d: 1, sep: true },
    { k: 'totG', t: '成長%', pct: true },
    { k: 'share', t: '佔%', d: 1, unit: '%' },
    { k: 'op', t: '億點', g: 'op', d: 1, sep: true },
    { k: 'opG', t: '成長%', pct: true },
    { k: 'oc', t: '千件', d: 0 },
    { k: 'ocG', t: '成長%', pct: true },
    { k: 'oa', t: '點/件', d: 0 },
    { k: 'oaG', t: '成長%', pct: true },
    { k: 'ip', t: '億點', g: 'ip', d: 1, sep: true },
    { k: 'ipG', t: '成長%', pct: true },
    { k: 'ic', t: '千件', d: 1 },
    { k: 'icG', t: '成長%', pct: true },
    { k: 'ia', t: '點/件', d: 0 },
    { k: 'iaG', t: '成長%', pct: true },
  ];

  function buildHospRows() {
    const [s, e] = period();
    const nat = pick(sumAvg(D.hospitals, s, e), 'all').pts;
    const q = state.search.trim().toLowerCase();
    return D.hospitals
      .filter((h) => (!state.region || h.region === state.region) && (!state.level || h.level === state.level) &&
        (!state.system || h.system === state.system) && (!q || h.name.toLowerCase().includes(q)))
      .map((h) => {
        const c = hospAvg(h, s, e), p = hospAvg(h, s - 12, e - 12) || { op: 0, oc: 0, ip: 0, ic: 0 };
        const tot = c.op + c.ip, totP = p.op + p.ip;
        const oa = c.oc ? c.op / c.oc : null, oaP = p.oc ? p.op / p.oc : null;
        const ia = c.ic ? c.ip / c.ic : null, iaP = p.ic ? p.ip / p.ic : null;
        return {
          h, lv: h.level, name: h.name, region: h.region,
          tot: tot / 1e8, totG: growth(tot, totP), share: nat ? tot / nat * 100 : null,
          op: c.op / 1e8, opG: growth(c.op, p.op), oc: c.oc / 1e3, ocG: growth(c.oc, p.oc), oa, oaG: growth(oa, oaP),
          ip: c.ip / 1e8, ipG: growth(c.ip, p.ip), ic: c.ic / 1e3, icG: growth(c.ic, p.ic), ia, iaG: growth(ia, iaP),
        };
      })
      .filter((r) => r.tot > 0);
  }

  function renderHospitals() {
    hospRows = buildHospRows();
    const { sortKey: k, sortDir: dir } = state;
    const lvOrder = { 醫中: 0, 區域: 1, 地區: 2, 其他: 3 };
    hospRows.sort((a, b) => {
      let va = a[k], vb = b[k];
      if (k === 'lv') { va = lvOrder[va]; vb = lvOrder[vb]; }
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return va.localeCompare(vb, 'zh-Hant') * dir;
      return (va - vb) * dir;
    });
    $('#hospCount').textContent = `共 ${hospRows.length} 家・點數不含交付・點擊欄位標題可排序`;
    const sortCls = (c) => (c.k === k ? ' sorted' : '');
    const arrow = (c) => (c.k === k ? (dir < 0 ? ' ▼' : ' ▲') : '');
    const head = `<thead>
      <tr><th colspan="3"></th><th class="group sep" colspan="3">總申報點數（月均）</th><th class="group sep" colspan="6">門診（月均）</th><th class="group sep" colspan="6">住診（月均）</th></tr>
      <tr>${HOSP_COLS.map((c) => `<th class="sortable ${c.cls || ''}${c.sep ? ' sep' : ''}${sortCls(c)}" data-k="${c.k}">${c.t}${arrow(c)}</th>`).join('')}</tr></thead>`;
    const body = hospRows.map((r) => '<tr>' + HOSP_COLS.map((c) => {
      const v = r[c.k];
      const sep = c.sep ? ' sep' : '';
      if (c.k === 'lv') return `<td class="lv"><span class="lv-tag">${v}</span></td>`;
      if (c.k === 'name') return `<td class="name" title="${esc(v)}${r.h.system ? '｜' + esc(r.h.system) : ''}">${esc(v)}</td>`;
      if (c.k === 'region') return `<td class="lv">${esc(v)}</td>`;
      if (c.pct) return pctCell(v);
      return `<td class="${sep}">${fmt(v, c.d)}${c.unit || ''}</td>`;
    }).join('') + '</tr>').join('');
    const t = $('#hospTable');
    t.innerHTML = head + '<tbody>' + body + '</tbody>';
    t.querySelectorAll('th.sortable').forEach((th) => th.addEventListener('click', () => {
      const nk = th.dataset.k;
      if (state.sortKey === nk) state.sortDir *= -1;
      else { state.sortKey = nk; state.sortDir = ['lv', 'name', 'region'].includes(nk) ? 1 : -1; }
      renderHospitals();
    }));
  }

  function exportCsv() {
    const [s, e] = period();
    const heads = ['層級', '醫院', '分區', '體系', '總億點', '總成長%', '佔%', '門診億點', '門診點數成長%', '門診千件', '門診件數成長%', '門診點/件', '門診點/件成長%', '住診億點', '住診點數成長%', '住診千件', '住診件數成長%', '住診點/件', '住診點/件成長%'];
    const keys = ['lv', 'name', 'region', 'system', 'tot', 'totG', 'share', 'op', 'opG', 'oc', 'ocG', 'oa', 'oaG', 'ip', 'ipG', 'ic', 'icG', 'ia', 'iaG'];
    const lines = [heads.join(',')];
    for (const r of hospRows) {
      lines.push(keys.map((k) => {
        const v = k === 'system' ? r.h.system : r[k];
        if (v == null) return '';
        if (typeof v === 'number') return Number(v.toFixed(4));
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `各醫院申報_${D.months[s]}-${D.months[e]}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- 畫面：北醫體系 ----------
  function tmuHospitals() {
    const hs = D.hospitals.filter((h) => h.system === TMU);
    const named = hs.map((h) => {
      const idx = TMU_ORDER.findIndex(([k]) => h.name.includes(k));
      return { h, short: idx >= 0 ? TMU_ORDER[idx][1] : h.name, order: idx >= 0 ? idx : 99 };
    });
    return named.sort((a, b) => a.order - b.order);
  }

  function renderTmu() {
    const list = tmuHospitals();
    const hs = list.map((x) => x.h);
    const sys = metrics(hs, 'all');
    const nat = metrics(D.hospitals, 'all');
    const op = metrics(hs, 'op'), ip = metrics(hs, 'ip');
    $('#tmuKpis').innerHTML = [
      kpiCard({ label: '北醫大體系 總點數', icon: ICONS.star, value: fmt(sys.pts / 1e8, 1), unit: '億點/月', g: growth(sys.pts, sys.ptsPrev), foot: `同期 ${fmt(sys.ptsPrev / 1e8, 1)}`, accent: true,
        sub: `<div class="kpi-sub"><div>門診億點<b>${fmt(op.pts / 1e8, 1)}</b></div><div>住診億點<b>${fmt(ip.pts / 1e8, 1)}</b></div><div>院所數<b>${hs.length}</b></div></div>` }),
      kpiCard({ label: '總件數', icon: ICONS.cases, value: fmt(sys.cases / 1e3), unit: '千件/月', g: growth(sys.cases, sys.casesPrev), foot: `同期 ${fmt(sys.casesPrev / 1e3)}` }),
      kpiCard({ label: '平均點數', icon: ICONS.avg, value: fmt(sys.avg), unit: '點/件', g: growth(sys.avg, sys.avgPrev), foot: `同期 ${fmt(sys.avgPrev)}` }),
      kpiCard({ label: '全國佔率', icon: ICONS.share, value: fmt(sys.pts / nat.pts * 100, 2), unit: '%', foot: `同期 ${fmt(sys.ptsPrev / nat.ptsPrev * 100, 2)}%　全國成長 ${fmtSigned(growth(nat.pts, nat.ptsPrev), 1)}%` }),
    ].join('');

    const wrap = $('#tmuHospitals');
    wrap.innerHTML = list.map((x, i) => `
      <div class="card pad">
        <div class="hosp-title"><div class="hosp-badge">${esc(x.short.slice(0, 1))}</div>
          <div><h2>${esc(x.short)}</h2><div class="muted small">${esc(x.h.name)}・${esc(x.h.region)}・${esc(x.h.level)}</div></div></div>
        <div class="hosp-block">
          <div class="table-wrap"><table class="data" id="tmuT${i}"></table></div>
          <div class="chart" id="tmuC${i}"></div>
        </div>
      </div>`).join('');

    list.forEach((x, i) => {
      const rows = [['總計', 'all'], ['門診', 'op'], ['住診', 'ip']].map(([n, t]) => ({ n, m: metrics([x.h], t) }));
      const caseDigits = (v) => (v != null && v < 10 ? 1 : 0);
      $(`#tmuT${i}`).innerHTML = `<thead>
        <tr><th></th><th class="group sep" colspan="3">點數</th><th class="group sep" colspan="3">件數</th><th class="group sep" colspan="3">平均點數</th></tr>
        <tr><th></th><th class="sep">億點/月</th><th>同期</th><th>成長%</th><th class="sep">千件/月</th><th>同期</th><th>成長%</th><th class="sep">點/件</th><th>同期</th><th>成長%</th></tr></thead><tbody>` +
        rows.map(({ n, m }, ri) => `<tr class="${ri === 0 ? 'total' : ''}"><td>${n}</td>
          <td class="sep">${fmt(m.pts / 1e8, 2)}</td><td>${fmt(m.ptsPrev / 1e8, 2)}</td>${pctCell(growth(m.pts, m.ptsPrev))}
          <td class="sep">${fmt(m.cases / 1e3, caseDigits(m.cases / 1e3))}</td><td>${fmt(m.casesPrev / 1e3, caseDigits(m.cases / 1e3))}</td>${pctCell(growth(m.cases, m.casesPrev))}
          <td class="sep">${fmt(m.avg)}</td><td>${fmt(m.avgPrev)}</td>${pctCell(growth(m.avg, m.avgPrev))}</tr>`).join('') + '</tbody>';
      yearChart($(`#tmuC${i}`), [x.h], state.tmuMetric, 'all', 220);
    });
  }

  // ---------- 主流程 ----------
  const TITLES = {
    overview: ['全國申報概況', '依分區、層級檢視醫院總額申報點數與件數'],
    hospitals: ['各醫院申報概況', '全國各醫院門住診點數、件數與成長'],
    tmu: ['北醫體系申報概況', '附醫・萬芳・雙和・新國民'],
  };

  function render() {
    const [s, e] = period();
    const range = s === e ? ymLabel(D.months[e]) : `${ymLabel(D.months[s])} – ${ymLabel(D.months[e])}`;
    const [t, sub] = TITLES[state.view];
    $('#pageTitle').textContent = t;
    $('#pageSub').textContent = `${sub}｜${range}${s === e ? '' : `（${e - s + 1} 個月月平均）`}`;
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    $$('.view').forEach((v) => { v.hidden = v.id !== `view-${state.view}`; });
    $$('#filters .field').forEach((f) => { f.hidden = !f.dataset.for.split(' ').includes(state.view); });
    if (state.view === 'overview') renderOverview();
    else if (state.view === 'hospitals') renderHospitals();
    else renderTmu();
    try { history.replaceState(null, '', '#' + state.view); } catch (err) { /* ignore */ }
  }

  function fillSelect(sel, items, allLabel) {
    sel.innerHTML = (allLabel ? `<option value="">${allLabel}</option>` : '') +
      items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  }

  function setMode(mode) {
    state.mode = mode;
    $$('#periodMode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('#endWrap').hidden = mode !== 'range';
    $('#startLabel').textContent = mode === 'range' ? '起' : (mode === 'ytd' ? '累計至' : '月份');
    $('#startSel').value = mode === 'range' ? state.start : state.end;
  }

  function init(data) {
    D = data;
    const last = D.months.length - 1;
    state.end = last;
    state.start = Math.max(0, last - 11);
    const monthOpts = D.months.map((m, i) => [i, `${ymLabel(m)}（${Math.floor(m / 100)}/${String(m % 100).padStart(2, '0')}）`]).reverse();
    fillSelect($('#startSel'), monthOpts);
    fillSelect($('#endSel'), monthOpts);
    $('#startSel').value = last;
    $('#endSel').value = last;
    fillSelect($('#fRegion'), D.regions.map((r) => [r, r]), '全部');
    fillSelect($('#fLevel'), D.levels.map((l) => [l, l]), '全部');
    const systems = Array.from(new Set(D.hospitals.map((h) => h.system).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    fillSelect($('#fSystem'), systems.map((s) => [s, s]), '全部');

    $$('.tab').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));
    $$('#periodMode button').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); render(); }));
    $('#startSel').addEventListener('change', (ev) => {
      const v = +ev.target.value;
      if (state.mode === 'range') state.start = v; else state.end = v;
      render();
    });
    $('#endSel').addEventListener('change', (ev) => { state.end = +ev.target.value; render(); });
    $('#fType').addEventListener('change', (ev) => { state.type = ev.target.value; render(); });
    $('#fRegion').addEventListener('change', (ev) => { state.region = ev.target.value; render(); });
    $('#fLevel').addEventListener('change', (ev) => { state.level = ev.target.value; render(); });
    $('#fSystem').addEventListener('change', (ev) => { state.system = ev.target.value; render(); });
    let st;
    $('#fSearch').addEventListener('input', (ev) => { clearTimeout(st); st = setTimeout(() => { state.search = ev.target.value; render(); }, 150); });
    $$('#ovTrendMetric button').forEach((b) => b.addEventListener('click', () => {
      state.ovMetric = b.dataset.m;
      $$('#ovTrendMetric button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    $$('#trendMetric button').forEach((b) => b.addEventListener('click', () => {
      state.tmuMetric = b.dataset.m;
      $$('#trendMetric button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    $('#csvBtn').addEventListener('click', exportCsv);
    $('#themeBtn').addEventListener('click', () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (err) { /* ignore */ }
    });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });

    const hash = location.hash.slice(1);
    if (TITLES[hash]) state.view = hash;
    window.addEventListener('hashchange', () => {
      const h = location.hash.slice(1);
      if (TITLES[h] && h !== state.view) { state.view = h; render(); }
    });
    $('#footer').innerHTML = `資料來源：${esc(D.source)}｜資料期間 ${ymLabel(D.months[0])} – ${ymLabel(D.months[last])}（民國 ${rocLabel(D.months[last])}）｜數據更新：${esc(D.updated)}<br>` +
      '門診點數為「不含交付」；層級依 113 年 1 月升格後歸類；多月區間以月平均呈現，同期為去年相同月份。';
    render();
  }

  fetch('data.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch((err) => {
      $('#pageSub').textContent = `資料載入失敗（${err.message}）。若直接以檔案開啟，請改用本機伺服器或 GitHub Pages。`;
    });
})();
