(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function svgEl(name, attrs, parent) {
        var node = document.createElementNS(SVG_NS, name);
        Object.keys(attrs).forEach(function (key) {
            node.setAttribute(key, attrs[key]);
        });
        if (parent) parent.appendChild(node);
        return node;
    }

    function heptagon(cx, cy, r) {
        var points = [];
        for (var i = 0; i < 7; i++) {
            var angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
            points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
        }
        return points;
    }

    function easeInOut(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function later(ms, fn) {
        return window.setTimeout(fn, ms);
    }

    function initTyper() {
        var word = document.querySelector('[data-typer-word]');
        var line = word.closest('[data-typer]');

        var words = word.getAttribute('data-words').split('|');
        var TYPE = 90, ERASE = 45, HOLD = 2000, GAP = 400, START = 900;
        var index = 0;

        if (reducedMotion.matches) {
            window.setInterval(function () {
                index = (index + 1) % words.length;
                word.textContent = words[index];
            }, 3000);
            return;
        }

        function typing(on) {
            line.classList.toggle('is-typing', on);
        }

        function type(count) {
            var text = words[index];
            typing(true);
            word.textContent = text.slice(0, count);
            if (count < text.length) {
                later(TYPE + Math.random() * 50, function () { type(count + 1); });
            } else {
                typing(false);
                later(HOLD, function () { erase(text.length - 1); });
            }
        }

        function erase(count) {
            typing(true);
            word.textContent = words[index].slice(0, count);
            if (count > 0) {
                later(ERASE, function () { erase(count - 1); });
            } else {
                typing(false);
                index = (index + 1) % words.length;
                later(GAP, function () { type(1); });
            }
        }

        word.textContent = '';
        later(START, function () { type(1); });
    }

    function initMark() {
        var host = document.querySelector('[data-mark]');
        var spin = host.querySelector('[data-mark-spin]');
        var lit = host.querySelector('[data-mark-lit]');
        var svg = host.querySelector('svg');
        var level = host.querySelector('[data-mark-level]');
        var outline = host.querySelector('[data-mark-outline]');
        var scan = host.querySelector('[data-mark-scan]');
        var shineGradient = host.querySelector('#mark-shine');
        var nhSource = document.querySelector('#i-nh path');

        if (reducedMotion.matches) {
            lit.style.strokeDashoffset = '0';
            return;
        }

        var RING = lit.getAttribute('d');
        var nodes = heptagon(50, 50, 46);
        var CORE = { x: 50, y: 50 };
        var STEP = 100 / 7;

        var INTRO_EDGE = 375;
        var ORBIT_EDGE = 2300;
        var ORBIT_EASE = 0.7;
        var ACROSS = 2700;
        var TO_CORE = 1300;
        var SEND_MIN = 600, SEND_MAX = 1100;
        var REPLY_CHANCE = 0.95;
        var ACROSS_SHARE = 0;
        var TURN = 120000;
        var SHINE_MS = 1100;
        var HOLD_FIRST = 500, HOLD = 9000, DRAIN = 1600, EMPTY = 1400, FILL = 2200;

        var CORNER_EASE = 0.55;
        var FRONT_START = 22, FRONT_END = 78;
        var WAVE = 14, WAVE_AMP = 0.9;

        var INTRO_TAIL = [[1.2, 1, true], [3, 0.6, true], [5.4, 0.34, false], [8.2, 0.18, false], [11.5, 0.08, false]];
        var INTRO_GLOW = [[7, 2.8, 0.13], [7, 4.4, 0.065], [7, 6.4, 0.03]];
        var INTRO_HALO = [[2.1, 0.3], [3.6, 0.1]];
        var PACKET_HALO = [[1.7, 0.3], [2.8, 0.09]];
        var RAY_TAIL = [[2.2, 0.95, true], [5, 0.45, false], [8.5, 0.16, false]];

        function mod7(n) {
            return ((n % 7) + 7) % 7;
        }

        function pointAt(pct) {
            var pos = (((pct % 100) + 100) % 100) / STEP;
            var k = Math.floor(pos) % 7;
            var f = pos - Math.floor(pos);
            var a = nodes[k], b = nodes[(k + 1) % 7];
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }

        function slope(t) {
            return t < 0.5 ? 12 * t * t : 3 * (2 - 2 * t) * (2 - 2 * t);
        }

        function stretchFor(pace) {
            return Math.max(0.35, Math.min(1.8, 0.3 + 0.7 * pace));
        }

        function swellFor(pace) {
            return 0.8 + 0.3 * Math.min(pace, 2.2);
        }

        function dash(el, len, at) {
            el.setAttribute('stroke-dasharray', len.toFixed(2) + ' ' + (100 - len).toFixed(2));
            el.setAttribute('stroke-dashoffset', (len - at).toFixed(2));
        }

        function setLine(el, x1, y1, x2, y2) {
            el.setAttribute('x1', x1.toFixed(2));
            el.setAttribute('y1', y1.toFixed(2));
            el.setAttribute('x2', x2.toFixed(2));
            el.setAttribute('y2', y2.toFixed(2));
        }

        function addHead(light, halo, r) {
            light.halos = halo.map(function (h) {
                return { r: h[0], el: svgEl('circle', { 'class': 'mark-head-glow', r: h[0], 'fill-opacity': h[1] }, light.body) };
            });
            light.head = svgEl('circle', { 'class': 'mark-head', r: r }, light.body);
        }

        function placeHead(light, x, y, swell) {
            var fx = x.toFixed(2), fy = y.toFixed(2);
            light.head.setAttribute('cx', fx);
            light.head.setAttribute('cy', fy);
            light.halos.forEach(function (h) {
                h.el.setAttribute('cx', fx);
                h.el.setAttribute('cy', fy);
                h.el.setAttribute('r', (h.r * swell).toFixed(2));
            });
        }

        function ringLight(parent, tail, glow, halo, r) {
            var g = svgEl('g', {}, parent);
            var light = { g: g, body: g };
            light.parts = glow.map(function (w) {
                return { len: w[0], el: svgEl('path', { 'class': 'mark-glow', d: RING, pathLength: 100, 'stroke-width': w[1], 'stroke-opacity': w[2] }, g) };
            }).concat(tail.map(function (t) {
                return { len: t[0], el: svgEl('path', { 'class': t[2] ? 'mark-tail mark-tail--hot' : 'mark-tail', d: RING, pathLength: 100, 'stroke-opacity': t[1] }, g) };
            }));
            addHead(light, halo, r);
            return light;
        }

        function drawRingLight(light, at, stretch, swell) {
            light.parts.forEach(function (part) {
                dash(part.el, part.len * stretch, at);
            });
            var p = pointAt(at);
            placeHead(light, p.x, p.y, swell);
        }

        function rayLight(parent) {
            var g = svgEl('g', {}, parent);
            g.style.display = 'none';
            var light = { g: g, trace: svgEl('line', { 'class': 'mark-trace' }, g) };
            light.body = svgEl('g', {}, g);
            light.rays = RAY_TAIL.map(function (t) {
                return { len: t[0], el: svgEl('line', { 'class': t[2] ? 'mark-ray mark-ray--hot' : 'mark-ray', 'stroke-opacity': t[1] }, light.body) };
            });
            addHead(light, PACKET_HALO, 0.75);
            return light;
        }

        var acrossLayer = svgEl('g', {});
        spin.insertBefore(acrossLayer, spin.firstChild);
        var lightLayer = svgEl('g', {}, spin);
        var nodeLayer = svgEl('g', {}, spin);

        var nodeEls = nodes.map(function (p) {
            var g = svgEl('g', { 'class': 'mark-node' }, nodeLayer);
            svgEl('circle', { 'class': 'mark-node-halo', cx: p.x, cy: p.y, r: 1.6 }, g);
            svgEl('circle', { 'class': 'mark-node-dot', cx: p.x, cy: p.y, r: 1.1 }, g);
            return g;
        });

        function pulse(index, kind) {
            var g = nodeEls[index];
            g.classList.remove('is-send', 'is-recv');
            void g.getBoundingClientRect();
            g.classList.add(kind === 'send' ? 'is-send' : 'is-recv');
        }

        function waveX(y) {
            return (WAVE_AMP * Math.sin(y / WAVE * 2 * Math.PI)).toFixed(2);
        }

        function wave(side) {
            var d = 'M' + waveX(-30) + ' -30';
            for (var y = -29; y <= 140; y++) d += 'L' + waveX(y) + ' ' + y;
            return side ? d + 'L' + (side * 90) + ' 140L' + (side * 90) + ' -30Z' : d;
        }

        var LEFT_FILL = wave(-1), RIGHT_FILL = wave(1);

        level.setAttribute('d', LEFT_FILL);
        level.setAttribute('transform', 'translate(' + FRONT_END + ' 0)');

        var nhClip = svgEl('clipPath', { id: 'mark-nh-shape', clipPathUnits: 'userSpaceOnUse' }, svg.querySelector('defs'));
        svgEl('path', { d: nhSource.getAttribute('d'), transform: 'translate(24 23.42) scale(0.52)' }, nhClip);
        var surfaceGroup = svgEl('g', { 'clip-path': 'url(#mark-nh-shape)' });
        svg.insertBefore(surfaceGroup, outline);
        var surface = svgEl('path', { 'class': 'mark-surface', d: wave(0), transform: 'translate(' + FRONT_END + ' 0)' }, surfaceGroup);

        var clock = 0;
        var last = 0;
        var running = false;
        var rafId = 0;
        var live = false;
        var hovering = false;
        var nextSend = Infinity;
        var timeline = [];
        var shineStart = -1;

        function after(ms, fn) {
            timeline.push({ at: clock + ms, fn: fn });
        }

        function runTimeline() {
            for (var k = timeline.length - 1; k >= 0; k--) {
                if (clock >= timeline[k].at) {
                    var fn = timeline[k].fn;
                    timeline.splice(k, 1);
                    fn();
                }
            }
        }

        function startShine() {
            if (shineStart < 0) shineStart = clock;
        }

        function updateShine() {
            if (shineStart < 0) return;
            var s = (clock - shineStart) / SHINE_MS;
            var tx = s >= 1 ? -40 : -40 + 145 * easeInOut(s);
            shineGradient.setAttribute('gradientTransform', 'translate(' + tx.toFixed(2) + ' ' + tx.toFixed(2) + ')');
            if (s >= 1) shineStart = -1;
        }

        var introLight = ringLight(lightLayer, INTRO_TAIL, INTRO_GLOW, INTRO_HALO, 1.05);

        lightLayer.style.display = 'none';
        var introPhase = 0;
        var booted = -1;

        function runIntro(dt) {
            introPhase = Math.min(7, introPhase + dt / INTRO_EDGE);
            var edge = Math.min(6, Math.floor(introPhase));
            var u = introPhase - edge;
            var eased = (1 - CORNER_EASE) * u + CORNER_EASE * (0.5 - 0.5 * Math.cos(Math.PI * u));
            var travelled = (edge + eased) * STEP;
            var pace = 2 * ((1 - CORNER_EASE) + CORNER_EASE * (Math.PI / 2) * Math.sin(Math.PI * u));

            drawRingLight(introLight, travelled, stretchFor(pace), swellFor(pace));
            lightLayer.style.display = '';
            lit.style.strokeDashoffset = (1 - travelled / 100).toFixed(4);

            while (booted < Math.min(6, Math.floor(introPhase))) {
                booted++;
                nodeEls[booted].classList.add('is-up');
                pulse(booted, 'recv');
            }

            if (introPhase >= 7) {
                lit.style.strokeDashoffset = '0';
                orbit.stretch = stretchFor(pace);
                orbit.swell = swellFor(pace);
                pulse(0, 'recv');
                startShine();
                live = true;
                nextSend = clock + 700;
                setNH('hold', HOLD_FIRST);
            }
        }

        var orbit = { phase: 7, edgeMs: INTRO_EDGE, stretch: 1, swell: 1 };

        function runOrbit(dt) {
            var settle = 1 - Math.exp(-dt / 900);
            orbit.edgeMs += (ORBIT_EDGE - orbit.edgeMs) * settle;

            var reached = Math.floor(orbit.phase);
            orbit.phase += dt / orbit.edgeMs;
            var edge = Math.floor(orbit.phase);
            if (edge > reached) pulse(mod7(edge), 'recv');

            var u = orbit.phase - edge;
            var eased = (1 - ORBIT_EASE) * u + ORBIT_EASE * (0.5 - 0.5 * Math.cos(Math.PI * u));
            var pace = (1 - ORBIT_EASE) + ORBIT_EASE * (Math.PI / 2) * Math.sin(Math.PI * u);
            orbit.stretch += (0.45 + 0.2 * pace - orbit.stretch) * settle;
            orbit.swell += (1.25 * (1 + 0.08 * Math.sin(clock / 420)) - orbit.swell) * settle;

            drawRingLight(introLight, (edge + eased) * STEP, orbit.stretch, orbit.swell);
        }

        var acrossPool = [0, 1, 2, 3, 4, 5].map(function () {
            return { light: rayLight(acrossLayer), busy: false };
        });

        function idle(pool) {
            for (var k = 0; k < pool.length; k++) if (!pool[k].busy) return pool[k];
            return null;
        }

        function sendAcross(from, to, dur, mayReply) {
            var p = idle(acrossPool);
            if (!p) return;
            var a = from < 0 ? CORE : nodes[from];
            var b = to < 0 ? CORE : nodes[to];
            p.busy = true;
            p.landed = false;
            p.from = from;
            p.to = to;
            p.a = a;
            p.b = b;
            p.len = Math.hypot(b.x - a.x, b.y - a.y);
            p.ux = (b.x - a.x) / p.len;
            p.uy = (b.y - a.y) / p.len;
            p.start = clock;
            p.dur = dur;
            p.mayReply = mayReply;
            var light = p.light;
            light.trace.setAttribute('x1', a.x.toFixed(2));
            light.trace.setAttribute('y1', a.y.toFixed(2));
            light.trace.setAttribute('stroke-opacity', '0.3');
            light.body.style.display = '';
            light.g.style.display = '';
            if (from >= 0) pulse(from, 'send');
        }

        function moveAcross(p) {
            var light = p.light;

            if (p.landed) {
                var f = (clock - p.landedAt) / 900;
                light.trace.setAttribute('stroke-opacity', (0.3 * Math.max(0, 1 - f)).toFixed(3));
                if (f >= 1) {
                    p.busy = false;
                    light.g.style.display = 'none';
                }
                return;
            }

            var t = Math.min(1, (clock - p.start) / p.dur);
            var e = easeInOut(t);
            var x = p.a.x + (p.b.x - p.a.x) * e;
            var y = p.a.y + (p.b.y - p.a.y) * e;
            var pace = slope(t);
            var stretch = stretchFor(pace);
            var travelled = p.len * e;

            light.rays.forEach(function (ray) {
                var len = Math.min(travelled, ray.len * stretch);
                setLine(ray.el, x - p.ux * len, y - p.uy * len, x, y);
            });
            light.trace.setAttribute('x2', x.toFixed(2));
            light.trace.setAttribute('y2', y.toFixed(2));
            placeHead(light, x, y, swellFor(pace));

            if (t < 1) return;
            p.landed = true;
            p.landedAt = clock;
            light.body.style.display = 'none';
            if (p.to >= 0) pulse(p.to, 'recv');

            if (p.mayReply && p.from >= 0 && Math.random() < REPLY_CHANCE) {
                var from = p.to, to = acrossTarget(p.to, p.from);
                after(350 + Math.random() * 350, function () { sendAcross(from, to, ACROSS, false); });
            }
        }

        function acrossTarget(from, avoid) {
            var options = [2, 3, 4, 5].map(function (k) { return mod7(from + k); }).filter(function (n) { return n !== avoid; });
            return options[Math.floor(Math.random() * options.length)];
        }

        function exchange() {
            var from = Math.floor(Math.random() * 7);
            if (Math.random() < ACROSS_SHARE) sendAcross(from, acrossTarget(from, -1), ACROSS, true);
        }

        function someNodes(count) {
            var pick = [0, 1, 2, 3, 4, 5, 6].sort(function () { return Math.random() - 0.5; });
            return pick.slice(0, count);
        }

        var nh = { phase: 'off', at: 0, hold: HOLD, settled: false, fade: false };

        function setNH(phase, hold, fade) {
            nh.phase = phase;
            nh.at = clock;
            if (hold) nh.hold = hold;
            nh.fade = !!fade;
            nh.settled = false;
        }

        var shape = LEFT_FILL;

        function useShape(d) {
            if (shape === d) return;
            shape = d;
            level.setAttribute('d', d);
        }

        function updateNH() {
            if (nh.phase === 'off') return;
            var t = clock - nh.at;
            var front = FRONT_END;
            var show = 0;

            if (nh.phase === 'hold') {
                if (t >= nh.hold) {
                    setNH('drain');
                    t = 0;
                    sendAcross(-1, someNodes(1)[0], TO_CORE, false);
                } else {
                    show = nh.fade ? Math.max(0, 1 - t / 600) : 0;
                    if (show === 0) {
                        if (nh.settled) return;
                        nh.settled = true;
                    }
                }
            }

            if (nh.phase === 'drain') {
                useShape(RIGHT_FILL);
                front = FRONT_START + (FRONT_END - FRONT_START) * easeInOut(Math.min(1, t / DRAIN));
                show = Math.min(1, t / 400);
                if (t >= DRAIN) {
                    setNH('empty');
                    t = 0;
                }
            }
            if (nh.phase === 'empty') {
                front = FRONT_END;
                show = 1;
                if (t >= EMPTY) {
                    setNH('fill');
                    t = 0;
                    someNodes(3).forEach(function (n, k) {
                        after(k * 400, function () { sendAcross(n, -1, TO_CORE, false); });
                    });
                }
            }

            if (nh.phase === 'fill') {
                useShape(LEFT_FILL);
                front = FRONT_START + (FRONT_END - FRONT_START) * easeInOut(Math.min(1, t / FILL));
                show = 1;
                if (t >= FILL) {
                    setNH('hold', HOLD, true);
                    startShine();
                }
            }

            if (nh.phase === 'hold') useShape(LEFT_FILL);
            var shift = -((clock * 0.006) % WAVE);
            var transform = 'translate(' + front.toFixed(2) + ' ' + shift.toFixed(2) + ')';
            level.setAttribute('transform', transform);
            surface.setAttribute('transform', transform);
            outline.style.opacity = (0.6 * show).toFixed(3);
            scan.style.opacity = show.toFixed(3);
            scan.style.strokeDashoffset = (-(clock / 2600) % 1).toFixed(4);
        }

        function frame(now) {
            var dt = Math.max(0, Math.min(64, now - last));
            last = Math.max(last, now);
            clock += dt;

            runTimeline();

            if (!live) {
                runIntro(dt);
            } else {
                if (clock >= nextSend) {
                    exchange();
                    nextSend = clock + (SEND_MIN + Math.random() * (SEND_MAX - SEND_MIN)) / (hovering ? 2.2 : 1);
                }
                runOrbit(dt);
                acrossPool.forEach(function (p) { if (p.busy) moveAcross(p); });
                updateNH();
            }

            updateShine();
            spin.setAttribute('transform', 'rotate(' + (clock * 360 / TURN % 360).toFixed(3) + ' 50 50)');
            rafId = window.requestAnimationFrame(frame);
        }

        function start() {
            if (running) return;
            running = true;
            last = performance.now();
            rafId = window.requestAnimationFrame(frame);
        }

        function stop() {
            running = false;
            window.cancelAnimationFrame(rafId);
        }

        var inView = true;
        var ready = false;
        function sync() {
            if (ready && inView && !document.hidden) start();
            else stop();
        }

        new IntersectionObserver(function (entries) {
            inView = entries[0].isIntersecting;
            sync();
        }).observe(host);
        document.addEventListener('visibilitychange', sync);

        host.addEventListener('pointerenter', function (event) {
            if (event.pointerType === 'mouse') {
                hovering = true;
                if (live) nextSend = Math.min(nextSend, clock + 150);
            }
        });
        host.addEventListener('pointerleave', function () {
            hovering = false;
        });
        host.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'mouse' || !live) return;
            [0, 220].forEach(function (ms) {
                after(ms, function () {
                    var from = Math.floor(Math.random() * 7);
                    sendAcross(from, acrossTarget(from, -1), ACROSS, true);
                });
            });
            startShine();
        });

        later(600, function () {
            ready = true;
            sync();
        });
    }

    function initCarousels() {
        [].forEach.call(document.querySelectorAll('.carousel'), setupCarousel);
    }

    function setupCarousel(root) {
        var track = root.querySelector('[data-carousel]');
        var prev = root.querySelector('[data-carousel-prev]');
        var next = root.querySelector('[data-carousel-next]');
        var status = root.querySelector('[data-carousel-status]');
        var noun = track.getAttribute('data-carousel');
        var originals = [].slice.call(track.children);
        var total = originals.length;
        var loopQuery = window.matchMedia('(max-width: 639.98px)');
        var looping = false;

        function behavior() {
            return reducedMotion.matches ? 'auto' : 'smooth';
        }

        function positionOf(card) {
            if (looping) return card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
            return card.offsetLeft - track.children[0].offsetLeft;
        }

        function nearest() {
            var best = 0, bestDistance = Infinity;
            for (var k = 0; k < track.children.length; k++) {
                var distance = Math.abs(positionOf(track.children[k]) - track.scrollLeft);
                if (distance < bestDistance) {
                    best = k;
                    bestDistance = distance;
                }
            }
            return best;
        }

        function realIndex(child) {
            if (!looping) return child;
            return (child - 1 + total) % total;
        }

        function perView() {
            if (looping || total < 2) return 1;
            var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
            var step = originals[1].offsetLeft - originals[0].offsetLeft;
            return Math.max(1, Math.floor((track.clientWidth + gap + 1) / step));
        }

        function jumpTo(child) {
            track.scrollTo({ left: positionOf(track.children[child]), behavior: 'instant' });
        }

        function copyOf(card) {
            var copy = card.cloneNode(true);
            copy.classList.add('is-copy');
            copy.setAttribute('aria-hidden', 'true');
            copy.inert = true;
            copy.removeAttribute('data-spotlight');
            return copy;
        }

        function setLooping(on) {
            if (total < 2 || on === looping) return;
            var current = realIndex(nearest());
            [].slice.call(track.querySelectorAll('.is-copy')).forEach(function (copy) {
                track.removeChild(copy);
            });
            looping = on;
            if (on) {
                track.insertBefore(copyOf(originals[total - 1]), originals[0]);
                track.appendChild(copyOf(originals[0]));
            }
            jumpTo(looping ? current + 1 : current);
            update();
        }

        function go(delta) {
            if (looping) {
                var target = Math.max(0, Math.min(track.children.length - 1, nearest() + delta));
                track.scrollTo({ left: positionOf(track.children[target]), behavior: behavior() });
                return;
            }
            var last = Math.max(0, total - perView());
            var to = Math.min(nearest(), last) + delta;
            if (to > last) to = 0;
            if (to < 0) to = last;
            track.scrollTo({ left: positionOf(track.children[to]), behavior: behavior() });
        }

        prev.addEventListener('click', function () {
            go(-1);
        });
        next.addEventListener('click', function () {
            go(1);
        });

        var shown = '';
        function update() {
            root.classList.toggle('is-static', !looping && total <= perView());

            var first = realIndex(nearest());
            var last = looping ? first : Math.min(total - 1, first + perView() - 1);
            var text = 'Showing ' + noun + ' ' + (first + 1) + (last > first ? ' to ' + (last + 1) : '') + ' of ' + total;
            if (text !== shown) {
                status.textContent = text;
                shown = text;
            }
        }

        var settleTimer = 0;
        function settle() {
            if (!looping) return;
            var child = nearest();
            if (child === 0) jumpTo(total);
            else if (child === track.children.length - 1) jumpTo(1);
        }

        var pending = false;
        track.addEventListener('scroll', function () {
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(settle, 140);
            if (pending) return;
            pending = true;
            window.requestAnimationFrame(function () {
                pending = false;
                update();
            });
        }, { passive: true });

        window.addEventListener('resize', function () {
            if (looping) jumpTo(nearest());
            update();
        });

        function onBreakpoint() {
            setLooping(loopQuery.matches);
        }
        loopQuery.addEventListener('change', onBreakpoint);

        setLooping(loopQuery.matches);
        update();
    }

    function initSpotlight() {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        document.querySelectorAll('[data-spotlight]').forEach(function (card) {
            card.addEventListener('pointermove', function (event) {
                var rect = card.getBoundingClientRect();
                card.style.setProperty('--mx', (event.clientX - rect.left).toFixed(1) + 'px');
                card.style.setProperty('--my', (event.clientY - rect.top).toFixed(1) + 'px');
            });

            card.addEventListener('pointerleave', function () {
                card.style.removeProperty('--mx');
                card.style.removeProperty('--my');
            });
        });
    }

    function initCopy() {
        var status = document.querySelector('[data-copy-status]');

        document.querySelectorAll('[data-copy]').forEach(function (button) {
            var label = button.querySelector('[data-copy-label]');
            var resetTimer;

            function show(text, copied, announcement) {
                label.textContent = text;
                button.classList.toggle('is-copied', copied);
                status.textContent = announcement;
                window.clearTimeout(resetTimer);
                resetTimer = window.setTimeout(function () {
                    label.textContent = 'Copy';
                    button.classList.remove('is-copied');
                    status.textContent = '';
                }, 2200);
            }

            button.addEventListener('click', function () {
                navigator.clipboard.writeText(button.getAttribute('data-copy')).then(function () {
                    show('Copied', true, 'Email address copied to the clipboard.');
                }, function () {
                    show('Copy failed', false, 'Copying failed. Please select the address instead.');
                });
            });
        });
    }

    initMark();
    initTyper();
    initCarousels();
    initSpotlight();
    initCopy();
})();
