/* Rewe AI Chatbot: insight cards and chat, talking to the FastAPI backend.
   No framework and no chart library: charts are small SVG / HTML renderers. */
(() => {
    'use strict';

    const params = new URLSearchParams(location.search);
    const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
    const API = (params.get('api') || (LOCAL ? 'http://localhost:8000' : 'https://rewe.nasib.tech')).replace(/\/$/, '');

    const SERIES = ['var(--rw-s1)', 'var(--rw-s2)', 'var(--text-3)'];
    const REGION = { bavaria: 'Bavaria', 'schleswig-holstein': 'Schleswig-Holstein' };
    const TOOL = {
        search_products: 'Product search',
        get_price_history: 'Price history',
        get_price_change: 'Price change',
        get_category_index: 'Price index',
        rank_categories_by_inflation: 'Categories by price change',
        rank_price_changes: 'Biggest price changes',
        find_shrinkflation: 'Shrinkflation',
        compare_regions: 'Bavaria vs Schleswig-Holstein',
        get_sales_stats: 'Promotions',
        rank_promotions: 'Promotions by product',
        run_sql: 'Custom SQL',
    };
    const HIDDEN_COLUMNS = new Set(['gtin', 'score', 'first_seen']);
    // most useful columns first, so they are visible without scrolling sideways
    const COLUMN_ORDER = {
        search_products: ['name', 'pack_size', 'price_bavaria', 'price_schleswig_holstein', 'price_date', 'still_sold', 'category'],
    };
    const COLUMN_LABEL = {
        price_bavaria: 'price Bavaria',
        price_schleswig_holstein: 'price Schleswig-H.',
        current_price_bavaria: 'price Bavaria',
        current_price_schleswig_holstein: 'price Schleswig-H.',
        price_date: 'as of',
        still_sold: 'still sold',
    };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const $ = (sel, root = document) => root.querySelector(sel);
    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- formatting ---------- */

    function label(key) {
        return COLUMN_LABEL[key] || String(key).replace(/_/g, ' ');
    }

    function pretty(v) {
        return REGION[v] || v;
    }

    function fmt(key, v) {
        if (v === null || v === undefined || v === '') return '–';
        if (Array.isArray(v)) return v.map(pretty).join(', ');
        if (typeof v === 'boolean') return v ? 'yes' : 'no';
        if (typeof v === 'number') {
            const k = String(key).toLowerCase();
            if (k.includes('pct')) {
                // sign only for changes; shares like "45% on sale" stay unsigned
                const signed = /change|increase|drop|diff/.test(k) && v > 0;
                return `${signed ? '+' : ''}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
            }
            if (k.includes('index')) return v.toFixed(2);
            if (k.includes('price')) return `${v.toFixed(2)} €`;
            if (Number.isInteger(v)) return v.toLocaleString('en-US');
            return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
        }
        return pretty(String(v));
    }

    function monthLabel(iso) {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? String(iso) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }

    function isNumeric(rows, key) {
        return rows.some((r) => typeof r[key] === 'number');
    }

    /* ---------- tooltip ---------- */

    const tip = $('[data-tooltip]');

    function showTip(html, x, y) {
        tip.innerHTML = html;
        tip.hidden = false;
        const pad = 14;
        const { width, height } = tip.getBoundingClientRect();
        let left = x + pad;
        let top = y + pad;
        if (left + width > innerWidth - 8) left = x - width - pad;
        if (top + height > innerHeight - 8) top = y - height - pad;
        tip.style.left = `${Math.max(8, left)}px`;
        tip.style.top = `${Math.max(8, top)}px`;
    }

    function hideTip() {
        tip.hidden = true;
    }

    /* ---------- charts ---------- */

    const resizable = new Set();
    let resizeTimer;
    addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => resizable.forEach((fn) => fn()), 150);
    });

    function niceTicks(lo, hi, count = 4) {
        const span = hi - lo || 1;
        const raw = span / count;
        const mag = 10 ** Math.floor(Math.log10(raw));
        const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || raw;
        const ticks = [];
        for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(+t.toFixed(10));
        return ticks;
    }

    /* Line chart; spec.type 'step' draws price intervals (valid_from .. valid_to) as flat steps. */
    function lineChart(container, rows, spec, height = 200) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const step = spec.type === 'step';
        const regions = new Set(rows.map((r) => r.region).filter(Boolean));
        const seriesKey = (r) => {
            const base = spec.series ? r[spec.series] : spec.y;
            return step && regions.size > 1 && r.region ? `${base} · ${pretty(r.region)}` : base;
        };
        const groups = new Map();
        rows.forEach((r) => {
            const key = seriesKey(r);
            if (!groups.has(key)) groups.set(key, []);
            if (r[spec.y] === null || r[spec.y] === undefined) return;
            const t = Date.parse(r[spec.x]);
            const t2 = step && r.valid_to ? Date.parse(r.valid_to) + 864e5 : t;
            groups.get(key).push({ t, t2, v: r[spec.y] });
        });
        // at most three series stay readable; the table below keeps the rest
        const series = [...groups.entries()].slice(0, 3).map(([name, pts], i) => ({
            name, color: SERIES[i], pts: pts.sort((a, b) => a.t - b.t),
        }));

        const wrap = el('div', 'rw-line');
        if (series.length > 1) {
            const legend = el('ul', 'rw-legend');
            series.forEach((s) => {
                const li = el('li');
                const sw = el('i');
                sw.style.setProperty('--sw', s.color);
                li.append(sw, pretty(s.name));
                legend.append(li);
            });
            wrap.append(legend);
        }
        const host = el('div');
        wrap.append(host);
        container.append(wrap);

        function draw() {
            host.innerHTML = '';
            const W = Math.max(260, host.clientWidth || 600);
            const m = { t: 10, r: 56, b: 22, l: 40 };
            const all = series.flatMap((s) => s.pts);
            if (!all.length) return;
            const t0 = Math.min(...all.map((p) => p.t));
            const t1 = Math.max(...all.map((p) => p.t2));
            let v0 = Math.min(...all.map((p) => p.v));
            let v1 = Math.max(...all.map((p) => p.v));
            const padV = (v1 - v0) * 0.12 || 1;
            v0 -= padV; v1 += padV;
            const ticks = niceTicks(v0, v1, 4);
            const X = (t) => m.l + ((t - t0) / (t1 - t0 || 1)) * (W - m.l - m.r);
            const Y = (v) => m.t + (1 - (v - v0) / (v1 - v0)) * (height - m.t - m.b);

            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
            svg.setAttribute('height', height);
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', spec.title || 'Line chart');
            const add = (tag, attrs, parent = svg) => {
                const n = document.createElementNS(svgNS, tag);
                Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
                parent.append(n);
                return n;
            };

            ticks.forEach((tk) => {
                add('line', { x1: m.l, x2: W - m.r, y1: Y(tk), y2: Y(tk), stroke: 'var(--line)', 'stroke-width': 1 });
                add('text', { x: m.l - 6, y: Y(tk) + 3, 'text-anchor': 'end' }).textContent = fmt(spec.y, tk);
            });
            [t0, t1].forEach((t, i) => {
                add('text', { x: X(t), y: height - 5, 'text-anchor': i ? 'end' : 'start' }).textContent = monthLabel(t);
            });

            // A gap in the line means the product was not listed (data gaps are already
            // filled in the price intervals): a month or more between monthly points, or
            // more than a week between two price intervals.
            const GAP = (step ? 8 : 45) * 864e5;
            const xy = (t, v) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`;
            series.forEach((s) => {
                let d = '';
                s.pts.forEach((p, i) => {
                    const prev = s.pts[i - 1];
                    const prevEnd = prev ? (step ? prev.t2 : prev.t) : null;
                    d += `${!prev || p.t - prevEnd > GAP ? 'M' : 'L'}${xy(p.t, p.v)}`;
                    if (step) d += `L${xy(p.t2, p.v)}`;
                });
                add('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
            });
            const ends = series.map((s) => ({ s, p: s.pts[s.pts.length - 1] })).filter((e) => e.p);
            ends.sort((a, b) => Y(a.p.v) - Y(b.p.v));
            let lastY = -Infinity;
            ends.forEach(({ s, p }) => {
                const ex = X(p.t2);
                add('circle', { cx: ex, cy: Y(p.v), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 });
                const ly = Math.max(Y(p.v) + 4, lastY + 13);
                lastY = ly;
                add('text', { x: ex + 9, y: ly, class: 'rw-end-label' }).textContent = fmt(spec.y, p.v);
            });

            const cross = add('line', { y1: m.t, y2: height - m.b, stroke: 'var(--line-3)', 'stroke-width': 1, visibility: 'hidden' });
            const hit = add('rect', { x: m.l, y: 0, width: W - m.l - m.r, height, fill: 'transparent' });
            const times = [...new Set(all.flatMap((p) => (step ? [p.t, p.t2 - 864e5] : [p.t])))].sort((a, b) => a - b);
            const valueAt = (s, t) => (step ? s.pts.find((q) => q.t <= t && t < q.t2) : s.pts.find((q) => q.t === t));
            hit.addEventListener('mousemove', (e) => {
                const box = svg.getBoundingClientRect();
                const px = ((e.clientX - box.left) / box.width) * W;
                const t = times.reduce((best, c) => (Math.abs(X(c) - px) < Math.abs(X(best) - px) ? c : best), times[0]);
                cross.setAttribute('x1', X(t));
                cross.setAttribute('x2', X(t));
                cross.setAttribute('visibility', 'visible');
                const rowsHtml = series.map((s) => {
                    const p = valueAt(s, t);
                    return p ? `<div class="rw-tt-row"><i style="--sw:${s.color}"></i>${esc(pretty(s.name))}: <b>${esc(fmt(spec.y, p.v))}</b></div>` : '';
                }).join('');
                const when = step ? new Date(t).toISOString().slice(0, 10) : monthLabel(t);
                showTip(`<b>${when}</b>${rowsHtml}`, e.clientX, e.clientY);
            });
            hit.addEventListener('mouseleave', () => {
                cross.setAttribute('visibility', 'hidden');
                hideTip();
            });
            host.append(svg);
        }

        // measure after the chart is in the page (cards are built before they are attached)
        requestAnimationFrame(draw);
        resizable.add(draw);
    }

    function barChart(container, rows, spec, maxRows = 15) {
        let data = rows.filter((r) => typeof r[spec.y] === 'number').slice(0, maxRows);
        if (!data.length) return false;
        const names = data.map((r) => String(r[spec.x]));
        const dup = names.some((n, i) => names.indexOf(n) !== i);
        data = data.map((r) => ({
            label: dup && r.region ? `${r[spec.x]} (${pretty(r.region)})` : pretty(String(r[spec.x])),
            v: r[spec.y],
        }));
        const lo = Math.min(0, ...data.map((d) => d.v));
        const hi = Math.max(0, ...data.map((d) => d.v));
        const P = (v) => ((v - lo) / (hi - lo || 1)) * 100;
        const hasNeg = lo < 0;

        const box = el('div', 'rw-bars');
        box.setAttribute('role', 'img');
        box.setAttribute('aria-label', spec.title || 'Bar chart');
        data.forEach((d) => {
            const row = el('div', 'rw-bar-row');
            const name = el('span', 'rw-bar-label', d.label);
            const track = el('span', 'rw-bar-track');
            const plot = el('span');
            // room for the value labels, but never more than about a fifth of a narrow track
            const gutter = 'min(4rem, 24%)';
            plot.style.cssText = `position:absolute;inset:0 ${hi > 0 ? gutter : '0.5rem'} 0 ${hasNeg ? gutter : '0'}`;
            const z = P(0);
            if (hasNeg) {
                const zero = el('span', 'rw-bar-zero');
                zero.style.left = `${z}%`;
                plot.append(zero);
            }
            const bar = el('span', `rw-bar ${d.v < 0 ? 'rw-bar--neg' : 'rw-bar--pos'}`);
            bar.style.left = `${Math.min(z, P(d.v))}%`;
            bar.style.width = `${Math.max(Math.abs(P(d.v) - z), 0.4)}%`;
            const val = el('span', 'rw-bar-value', fmt(spec.y, d.v));
            if (d.v < 0) val.style.right = `calc(${100 - P(d.v)}% + 6px)`;
            else val.style.left = `calc(${P(d.v)}% + 6px)`;
            plot.append(bar, val);
            track.append(plot);
            row.append(name, track);
            row.addEventListener('mousemove', (e) => showTip(`${esc(d.label)}<br><b>${esc(fmt(spec.y, d.v))}</b>`, e.clientX, e.clientY));
            row.addEventListener('mouseleave', hideTip);
            box.append(row);
        });
        container.append(box);
        return true;
    }

    // tones: one color per meaning, the same in every chart
    const TONE = {
        bavaria: 'var(--rw-s1)', sh: 'var(--rw-s2)',
        up: 'var(--rw-s2)', down: 'var(--rw-s1)', same: 'var(--rw-neutral)',
    };

    function legend(items) {
        const ul = el('ul', 'rw-key');
        items.forEach(({ color, text, value }) => {
            const li = el('li');
            const sw = el('i');
            sw.style.setProperty('--sw', color);
            li.append(sw, el('span', '', text));
            if (value !== undefined) li.append(el('b', '', value));
            ul.append(li);
        });
        return ul;
    }

    /* Dumbbell: first price o---o last price, per product. */
    function dumbbell(container, rows, spec) {
        const max = Math.max(...rows.map((r) => Math.max(r[spec.from], r[spec.to])));
        const box = el('div', 'rw-dumbbells');
        rows.forEach((r) => {
            const a = r[spec.from];
            const b = r[spec.to];
            const row = el('div', 'rw-db-row');
            const head = el('div', 'rw-db-head');
            head.append(el('span', 'rw-db-name', r[spec.label]), el('span', 'rw-db-pct', fmt('change_pct', r[spec.y])));
            const track = el('div', 'rw-db-track');
            const line = el('span', 'rw-db-line');
            line.style.left = `${(Math.min(a, b) / max) * 100}%`;
            line.style.width = `${(Math.abs(b - a) / max) * 100}%`;
            const dotA = el('span', 'rw-db-dot rw-db-dot--from');
            dotA.style.left = `${(a / max) * 100}%`;
            const dotB = el('span', 'rw-db-dot rw-db-dot--to');
            dotB.style.left = `${(b / max) * 100}%`;
            const va = el('span', 'rw-db-val rw-db-val--from', fmt('price', a));
            va.style.right = `calc(${100 - (a / max) * 100}% + 9px)`;
            const vb = el('span', 'rw-db-val rw-db-val--to', fmt('price', b));
            vb.style.left = `calc(${(b / max) * 100}% + 9px)`;
            track.append(line, dotA, dotB, va, vb);
            row.append(head, track);
            row.addEventListener('mousemove', (e) => showTip(`${esc(r[spec.label])}<br><b>${esc(fmt('price', a))} → ${esc(fmt('price', b))}</b> (${esc(fmt('change_pct', r[spec.y]))})`, e.clientX, e.clientY));
            row.addEventListener('mouseleave', hideTip);
            box.append(row);
        });
        container.append(box, legend([
            { color: 'var(--rw-neutral)', text: 'first price' },
            { color: 'var(--rw-s2)', text: 'latest price' },
        ]));
    }

    /* One 100% bar split into parts (pricier / unchanged / cheaper). */
    function stackBar(container, rows, spec) {
        const total = rows.reduce((t, r) => t + r[spec.y], 0) || 1;
        const bar = el('div', 'rw-stack');
        bar.setAttribute('role', 'img');
        bar.setAttribute('aria-label', rows.map((r) => `${r.label} ${r[spec.y]}%`).join(', '));
        rows.forEach((r) => {
            const seg = el('span', 'rw-stack-seg');
            seg.style.flexGrow = r[spec.y] / total;
            seg.style.background = TONE[r.tone] || 'var(--rw-s1)';
            seg.classList.add(`rw-tone-${r.tone}`);
            if (r[spec.y] / total > 0.12) seg.append(el('span', 'rw-stack-in', `${Math.round(r[spec.y])}%`));
            seg.addEventListener('mousemove', (e) => showTip(`${esc(r.label)}: <b>${esc(String(r[spec.y]))}%</b>`, e.clientX, e.clientY));
            seg.addEventListener('mouseleave', hideTip);
            bar.append(seg);
        });
        container.append(bar, legend(rows.map((r) => ({ color: TONE[r.tone], text: r.label, value: `${r[spec.y]}%` }))));
    }

    /* 10 x 10 squares, one per percent; rounding keeps every non-zero group visible. */
    function waffle(container, rows, spec) {
        const total = rows.reduce((t, r) => t + r[spec.y], 0) || 1;
        const raw = rows.map((r) => (r[spec.y] / total) * 100);
        const cells = raw.map((v, i) => Math.max(rows[i][spec.y] > 0 ? 1 : 0, Math.floor(v)));
        let left = 100 - cells.reduce((a, b) => a + b, 0);
        raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
            if (left > 0) { cells[i] += 1; left -= 1; }
        });
        while (left < 0) {  // minimum-one rule overshot: take from the largest group
            const big = cells.indexOf(Math.max(...cells));
            cells[big] -= 1; left += 1;
        }
        const grid = el('div', 'rw-waffle');
        grid.setAttribute('role', 'img');
        grid.setAttribute('aria-label', rows.map((r) => `${r.label}: ${r[spec.y]}`).join(', '));
        rows.forEach((r, i) => {
            for (let k = 0; k < cells[i]; k += 1) {
                const c = el('span');
                c.style.background = TONE[r.tone];
                c.addEventListener('mousemove', (e) => showTip(`${esc(r.label)}<br><b>${esc(fmt(spec.y, r[spec.y]))}</b> products (${(raw[i]).toFixed(1)}%)`, e.clientX, e.clientY));
                c.addEventListener('mouseleave', hideTip);
                grid.append(c);
            }
        });
        const wrap = el('div', 'rw-waffle-wrap');
        wrap.append(grid, legend(rows.map((r) => ({ color: TONE[r.tone], text: r.label, value: fmt(spec.y, r[spec.y]) }))));
        container.append(wrap);
    }

    /* Shrinkflation: old pack = full track, new pack = the filled part. */
    function shrinkList(container, rows) {
        const seen = new Set();
        const list = el('ul', 'rw-shrink');
        rows.filter((r) => !seen.has(r.name) && seen.add(r.name)).slice(0, 4).forEach((r) => {
            const li = el('li');
            const head = el('div', 'rw-db-head');
            head.append(el('span', 'rw-db-name', r.name), el('span', 'rw-shrink-size', `${r.old_pack_size} → ${r.new_pack_size}`));
            const track = el('div', 'rw-shrink-track');
            const fill = el('span', 'rw-shrink-fill');
            fill.style.width = `${100 - r.content_drop_pct}%`;
            const lost = el('span', 'rw-shrink-lost', `−${r.content_drop_pct.toFixed(0)}%`);
            track.append(fill, lost);
            li.append(head, track);
            li.addEventListener('mousemove', (e) => showTip(`${esc(r.name)}<br>${esc(r.old_pack_size)} → ${esc(r.new_pack_size)}, ${esc(fmt('price', r.old_price))} → ${esc(fmt('price', r.new_price))}<br><b>${esc(fmt('unit_price_increase_pct', r.unit_price_increase_pct))}</b> per kg / l`, e.clientX, e.clientY));
            li.addEventListener('mouseleave', hideTip);
            list.append(li);
        });
        container.append(list, legend([
            { color: 'var(--rw-s1)', text: 'new pack' },
            { color: 'var(--rw-neutral)', text: 'content removed' },
        ]));
    }

    function table(columns, rows, maxRows = 50, tool = null) {
        const preferred = (COLUMN_ORDER[tool] || []).filter((c) => columns.includes(c));
        const cols = [...preferred, ...columns.filter((c) => !preferred.includes(c))].filter((c) => !HIDDEN_COLUMNS.has(c));
        const numeric = new Set(cols.filter((c) => isNumeric(rows, c)));
        const wrap = el('div', 'rw-table-wrap');
        const t = el('table', 'rw-table');
        const head = el('thead');
        const hr = el('tr');
        cols.forEach((c) => hr.append(el('th', numeric.has(c) ? 'rw-num' : '', label(c))));
        head.append(hr);
        const body = el('tbody');
        rows.slice(0, maxRows).forEach((r) => {
            const tr = el('tr');
            cols.forEach((c) => tr.append(el('td', numeric.has(c) ? 'rw-num' : '', fmt(c, r[c]))));
            body.append(tr);
        });
        t.append(head, body);
        wrap.append(t);
        return wrap;
    }

    function details(summary, content, open = false) {
        const d = el('details', 'rw-details');
        d.open = open;
        d.append(el('summary', '', summary), content);
        return d;
    }

    function sqlBlock(sql) {
        const pre = el('pre', 'rw-sql');
        pre.textContent = sql;
        const copy = el('button', 'rw-copy', 'Copy');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(sql);
                copy.textContent = 'Copied';
            } catch {
                copy.textContent = 'Select & copy';
            }
            setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
        });
        pre.append(copy);
        return pre;
    }

    /* ---------- API ---------- */

    async function api(path, options = {}, timeoutMs = 90000) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(API + path, { ...options, signal: ctrl.signal });
            let body = null;
            try { body = await res.json(); } catch { /* not JSON */ }
            if (!res.ok) {
                const detail = body && typeof body.detail === 'string' ? body.detail : null;
                const err = new Error(detail || `Request failed (${res.status}).`);
                err.status = res.status;
                throw err;
            }
            return body;
        } catch (e) {
            if (e.name === 'AbortError') throw new Error('The answer took too long. Please try again.');
            if (e instanceof TypeError) throw new Error("Can't reach the price API right now. Please try again later.");
            throw e;
        } finally {
            clearTimeout(timer);
        }
    }

    /* ---------- insight cards ---------- */

    const cardsBox = $('[data-cards]');
    const stacked = matchMedia('(max-width: 1099.98px)');
    const input = $('#rw-question');

    function renderCard(c) {
        const card = el('article', 'rw-card frame');
        const inner = el('div', 'frame-inner');
        const nb = (t) => String(t).replace(/ (€|%)/g, '\u00a0$1');  // keep "4.99 €" on one line
        inner.append(el('h3', 'rw-card-title label', c.title), el('p', 'rw-card-headline', nb(c.headline)), el('p', 'rw-card-detail', c.detail));
        const chart = el('div', 'rw-card-chart');
        const spec = c.chart || {};
        const rows = spec.rows || [];
        if (spec.type === 'line') {
            inner.append(chart);
            lineChart(chart, rows, spec, 130);
        } else if (spec.type === 'bar') {
            inner.append(chart);
            barChart(chart, rows, spec, 6);
        } else if (spec.type === 'dumbbell') {
            inner.append(chart);
            dumbbell(chart, rows, spec);
        } else if (spec.type === 'stack') {
            inner.append(chart);
            stackBar(chart, rows, spec);
        } else if (spec.type === 'waffle') {
            inner.append(chart);
            waffle(chart, rows, spec);
        } else if (spec.type === 'shrink') {
            inner.append(chart);
            shrinkList(chart, rows);
        } else if (spec.type === 'table' && rows.length) {
            const list = el('ul', 'rw-mini-list');
            const seen = new Set();
            rows.filter((r) => !seen.has(r.name) && seen.add(r.name)).slice(0, 3).forEach((r) => {
                const li = el('li');
                const right = r.old_pack_size ? `${r.old_pack_size} → ${r.new_pack_size}` : '';
                li.append(el('span', '', r.name || Object.values(r)[0]), el('span', '', right));
                list.append(li);
            });
            chart.append(list);
            inner.append(chart);
        }
        const foot = el('div', 'rw-card-foot');
        const ask = el('button', 'rw-ask');
        ask.type = 'button';
        ask.innerHTML = `${esc(c.ask)}<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>`;
        ask.addEventListener('click', () => {
            // side by side the chat is already in view; stacked, bring it up
            if (stacked.matches) document.getElementById('ask').scrollIntoView({ behavior: 'smooth', block: 'start' });
            send(c.ask);
        });
        foot.append(ask);
        inner.append(foot);
        if (c.sql) inner.append(details('SQL', sqlBlock(c.sql)));
        card.append(inner);
        return card;
    }

    async function loadCards() {
        try {
            const cards = await api('/insights', {}, 20000);
            cardsBox.innerHTML = '';
            // pair cards of similar height in the two-column grid; unknown ids keep their place
            const ORDER = ['basket', 'categories', 'risers', 'shrinkflation', 'direction', 'regions'];
            const rank = (c) => (ORDER.includes(c.id) ? ORDER.indexOf(c.id) : ORDER.length);
            [...cards].sort((a, b) => rank(a) - rank(b)).forEach((c) => cardsBox.append(renderCard(c)));
        } catch (e) {
            cardsBox.innerHTML = '';
            cardsBox.append(el('p', 'rw-offline', `The live data couldn't be loaded. ${e.message}`));
        } finally {
            cardsBox.setAttribute('aria-busy', 'false');
        }
    }

    async function loadHealth() {
        const dot = $('[data-status-dot]');
        try {
            const h = await api('/health', {}, 10000);
            dot.classList.add('badge-dot--live');
            $('[data-status-text]').textContent = 'AI assistant · online';
            const p = h.data_period;
            if (p) $('[data-period]').textContent = `${monthLabel(p.start)} – ${monthLabel(p.end)} · Bavaria & Schleswig-Holstein`;
        } catch {
            dot.style.setProperty('--dot', 'var(--warm)');
            $('[data-status-text]').textContent = 'AI assistant · offline right now';
        }
    }

    /* ---------- chat ---------- */

    const log = $('[data-log]');
    const form = $('[data-form]');
    const history = [];
    let busy = false;

    function markdown(text) {
        const inline = (s) => esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
        const out = [];
        let list = null;
        let para = [];
        const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
        const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
        String(text).split('\n').forEach((raw) => {
            const line = raw.trimEnd();
            const ul = line.match(/^\s*[-*•]\s+(.*)$/);
            const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
            if (ul || ol) {
                flushPara();
                const tag = ul ? 'ul' : 'ol';
                if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
                list.items.push((ul || ol)[1]);
            } else if (!line.trim()) {
                flushPara(); flushList();
            } else {
                flushList();
                para.push(line.replace(/^#{1,6}\s+/, ''));
            }
        });
        flushPara(); flushList();
        return out.join('');
    }

    function scrollLog() {
        log.scrollTop = log.scrollHeight;
    }

    function userMessage(text) {
        const m = el('div', 'rw-msg rw-msg--user', text);
        log.append(m);
        scrollLog();
    }

    function pendingMessage() {
        const m = el('div', 'rw-msg rw-msg--bot');
        const body = el('div', 'rw-msg-body');
        const thinking = el('span', 'rw-thinking');
        thinking.innerHTML = '<span class="rw-dots" aria-hidden="true"><span></span><span></span><span></span></span><span data-elapsed>Querying the data…</span>';
        body.append(thinking);
        m.append(body);
        log.append(m);
        scrollLog();
        const start = Date.now();
        const timer = setInterval(() => {
            const s = Math.round((Date.now() - start) / 1000);
            $('[data-elapsed]', m).textContent = s < 4 ? 'Querying the data…' : `Querying the data… ${s} s`;
        }, 1000);
        return { m, stop: () => clearInterval(timer) };
    }

    function renderStep(step) {
        const rows = step.rows || [];
        const box = el('div', 'rw-result');
        const head = el('div', 'rw-result-head');
        head.append(
            el('span', 'rw-result-title', (step.chart && step.chart.title) || TOOL[step.tool] || step.tool),
            el('span', 'rw-result-sub', `${step.row_count}${step.truncated ? '+' : ''} rows · ${TOOL[step.tool] || step.tool}`),
        );
        box.append(head);
        const spec = step.chart;
        let charted = false;
        if (spec && rows.length > 1) {
            const holder = el('div');
            box.append(holder);
            if (spec.type === 'line' || spec.type === 'step') { lineChart(holder, rows, spec, 210); charted = true; }
            else if (spec.type === 'bar') charted = barChart(holder, rows, spec, 15);
        }
        const tbl = table(step.columns || Object.keys(rows[0] || {}), rows, 50, step.tool);
        if (charted || rows.length > 12) box.append(details(`Table · ${rows.length} rows`, tbl));
        else box.append(tbl);
        if (step.sql) box.append(details('SQL', sqlBlock(step.sql)));
        return box;
    }

    function providerLabel(p) {
        if (!p) return '';
        const [name, ...model] = p.split(':');
        const m = model.join(':').split('/').pop();
        return m ? `${m} via ${name}` : name;
    }

    async function send(question) {
        question = question.trim();
        if (!question || busy) return;
        busy = true;
        form.querySelector('button').disabled = true;
        const sugg = $('[data-suggestions]');
        if (sugg) sugg.remove();
        userMessage(question);
        input.value = '';
        autosize();
        const pending = pendingMessage();
        try {
            const res = await api('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, history: history.slice(-6) }),
            });
            pending.stop();
            const body = $('.rw-msg-body', pending.m);
            body.innerHTML = markdown(res.answer);
            (res.steps || []).filter((s) => !s.error && s.row_count > 0).forEach((s) => pending.m.append(renderStep(s)));
            pending.m.append(el('p', 'rw-meta', `${providerLabel(res.provider)} · ${res.latency_s} s`));
            history.push({ role: 'user', content: question }, { role: 'assistant', content: res.answer });
        } catch (e) {
            pending.stop();
            pending.m.classList.add('rw-msg--error');
            $('.rw-msg-body', pending.m).textContent = e.message;
        } finally {
            busy = false;
            form.querySelector('button').disabled = false;
            scrollLog();
        }
    }

    function autosize() {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight + 2, 144)}px`;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        send(input.value);
    });
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            send(input.value);
        }
    });
    log.addEventListener('click', (e) => {
        const chip = e.target.closest('.rw-chip');
        if (chip) send(chip.textContent);
    });

    // rotate example questions in the empty input, so it reads as a place to type
    const EXAMPLES = [
        'Which products had the biggest price increases?',
        'Is butter cheaper in Bavaria or Schleswig-Holstein?',
        'Wie teuer ist Kaffee geworden?',
        'Hangi kategoride en çok indirim var?',
        'Show me shrinkflation in sweets',
    ];
    let ex = 0;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setInterval(() => {
            if (document.activeElement === input || input.value) return;
            ex = (ex + 1) % EXAMPLES.length;
            input.placeholder = `e.g. ${EXAMPLES[ex]}`;
        }, 3500);
    }

    loadHealth();
    loadCards();
})();
