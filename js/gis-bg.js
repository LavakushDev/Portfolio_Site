(function () {
    'use strict';

    var canvas = document.getElementById('gis-world-bg');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ── State ───────────────────────────────────────────── */
    var W = 0, H = 0, raf = null, scale = 1;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var paused = false;

    /* ── Projection — Australia-centred Mercator ─────────── */
    var C_LNG  = 133;   /* longitude centre */
    var C_LAT  = -27;   /* latitude centre  */
    var MARGIN = 0.78;  /* fill fraction    */

    /* Mercator northing — only called at startup for static data */
    function mN(d) { return Math.log(Math.tan(Math.PI / 4 + d * Math.PI / 360)); }

    var SPAN_LNG = 44 * Math.PI / 180;
    var SPAN_LAT = Math.abs(mN(-8) - mN(-46));
    var C_MERC   = mN(C_LAT);

    /* Fast pixel transforms — use cached scale, no trig per frame */
    function xOf(lng) { return (lng - C_LNG) * (Math.PI / 180) * scale + W / 2; }
    function yOfM(m)  { return -(m - C_MERC) * scale + H / 2; }

    function updateScale() {
        scale = Math.min(W * MARGIN / SPAN_LNG, H * MARGIN / SPAN_LAT);
    }

    /* ── Raw coordinate data (lat/lng pairs) ─────────────── */
    var AUS_RAW = [
        [-34.4,115.1],[-33.8,117.9],[-33.9,121.9],[-33.5,124.5],
        [-32.5,127.0],[-32.0,129.5],[-31.7,131.5],[-31.5,133.0],
        [-32.0,134.5],[-32.8,136.0],[-33.5,137.0],[-35.0,136.0],
        [-35.5,138.0],[-35.7,139.0],[-38.0,140.5],[-38.6,142.5],
        [-38.5,145.0],[-39.0,146.5],[-38.8,147.2],[-37.5,149.8],
        [-35.5,150.3],[-34.0,151.2],[-32.5,152.5],[-30.3,153.1],
        [-28.0,153.4],[-27.5,153.0],[-26.5,153.1],[-25.2,152.8],
        [-23.5,150.8],[-21.5,149.2],[-19.2,146.8],[-16.9,145.8],
        [-14.5,145.0],[-12.3,142.5],[-13.8,141.0],[-16.0,139.5],
        [-17.5,139.5],[-17.5,137.5],[-16.8,136.0],[-14.5,135.5],
        [-12.5,136.0],[-12.0,135.0],[-12.0,133.5],[-12.5,130.9],
        [-11.4,130.0],[-13.0,129.5],[-14.5,129.0],[-15.5,128.0],
        [-15.5,124.5],[-16.5,122.8],[-18.5,121.8],[-20.3,118.6],
        [-21.5,114.7],[-22.0,114.0],[-26.0,113.0],[-29.5,114.5],
        [-31.9,115.4],[-32.5,115.7],[-34.4,115.1],
    ];

    var TAS_RAW = [
        [-40.7,145.0],[-42.0,144.0],[-43.5,146.0],[-43.6,148.0],
        [-43.2,148.5],[-41.5,148.2],[-40.7,145.0],
    ];

    /* Pre-compute Mercator northing for every coastline point once */
    function preprocess(raw) {
        return raw.map(function (p) { return { lng: p[1], m: mN(p[0]) }; });
    }
    var AUS = preprocess(AUS_RAW);
    var TAS = preprocess(TAS_RAW);

    /* ── Cities ──────────────────────────────────────────── */
    var CITY_DATA = [
        { lat: -31.95, lng: 115.86, name: 'PERTH',     primary: true  },
        { lat: -33.87, lng: 151.21, name: 'SYDNEY',    primary: false },
        { lat: -37.81, lng: 144.96, name: 'MELBOURNE', primary: false },
        { lat: -27.47, lng: 153.02, name: 'BRISBANE',  primary: false },
        { lat: -34.93, lng: 138.60, name: 'ADELAIDE',  primary: false },
        { lat: -12.46, lng: 130.84, name: 'DARWIN',    primary: false },
        { lat: -42.88, lng: 147.33, name: 'HOBART',    primary: false },
        { lat: -35.28, lng: 149.13, name: 'CANBERRA',  primary: false },
    ];
    CITY_DATA.forEach(function (c) { c.m = mN(c.lat); });

    /* ── Arcs ────────────────────────────────────────────── */
    var ARCS = [
        { from: 0, to: 1, speed: 0.00042, phase: 0.00 },
        { from: 0, to: 2, speed: 0.00036, phase: 0.22 },
        { from: 0, to: 3, speed: 0.00040, phase: 0.48 },
        { from: 0, to: 4, speed: 0.00048, phase: 0.12 },
        { from: 0, to: 5, speed: 0.00044, phase: 0.66 },
        { from: 0, to: 6, speed: 0.00038, phase: 0.82 },
        { from: 0, to: 7, speed: 0.00043, phase: 0.38 },
        { from: 3, to: 1, speed: 0.00058, phase: 0.55 },
        { from: 1, to: 2, speed: 0.00062, phase: 0.30 },
    ];

    /* ── Earth grid reference lines (pre-compute mN once) ── */
    var EARTH_LATS = [
        { lat: -66.5,  m: mN(-66.5),  type: 'circle'  },  /* Antarctic Circle */
        { lat: -60,    m: mN(-60),    type: 'normal'  },
        { lat: -30,    m: mN(-30),    type: 'normal'  },
        { lat: -23.43, m: mN(-23.43), type: 'tropic'  },  /* Tropic of Capricorn */
        { lat:   0,    m: mN(0),      type: 'equator' },
        { lat:  23.43, m: mN(23.43),  type: 'tropic'  },  /* Tropic of Cancer */
        { lat:  30,    m: mN(30),     type: 'normal'  },
        { lat:  60,    m: mN(60),     type: 'normal'  },
        { lat:  66.5,  m: mN(66.5),   type: 'circle'  },  /* Arctic Circle */
    ];
    var EARTH_LNGS = [-180,-150,-120,-90,-60,-30,0,30,60,90,120,150,180];

    /* ── Cached pixel arrays — rebuilt on resize only ────── */
    var ausPath       = [];
    var tasPath       = [];
    var cityPx        = [];
    var earthLatPx    = [];  /* { y, type, lat } */
    var earthLngPx    = [];  /* { x, lng, isPrime } */
    var ausGridH      = [];  /* y values */
    var ausGridV      = [];  /* x values */
    var ausCrossH     = [];  /* { x, y, lat, lng } for crosshair + labels */

    function rebuildCache() {
        var i;

        /* Coastline pixel paths */
        ausPath = AUS.map(function (p) { return { x: xOf(p.lng), y: yOfM(p.m) }; });
        tasPath = TAS.map(function (p) { return { x: xOf(p.lng), y: yOfM(p.m) }; });

        /* City pixel positions */
        cityPx = CITY_DATA.map(function (c) { return { x: xOf(c.lng), y: yOfM(c.m) }; });

        /* Earth lat grid — skip lines off-screen */
        earthLatPx = [];
        for (i = 0; i < EARTH_LATS.length; i++) {
            var gl = EARTH_LATS[i];
            var gy = yOfM(gl.m);
            if (gy < -40 || gy > H + 40) continue;
            earthLatPx.push({ y: gy, type: gl.type, lat: gl.lat });
        }

        /* Earth lng grid — skip lines off-screen */
        earthLngPx = [];
        for (i = 0; i < EARTH_LNGS.length; i++) {
            var lng = EARTH_LNGS[i];
            var gx = xOf(lng);
            if (gx < -30 || gx > W + 30) continue;
            earthLngPx.push({ x: gx, lng: lng, isPrime: lng === 0 });
        }

        /* Australia 10° finer grid — full viewport lines */
        ausGridH = [];
        for (var alat = -5; alat >= -55; alat -= 10) {
            var ay = yOfM(mN(alat));
            if (ay > -5 && ay < H + 5) ausGridH.push(ay);
        }
        ausGridV = [];
        for (var alng = 105; alng <= 165; alng += 10) {
            var ax = xOf(alng);
            if (ax > -5 && ax < W + 5) ausGridV.push(ax);
        }

        /* Crosshair intersections */
        ausCrossH = [];
        for (var cl = -10; cl >= -50; cl -= 10) {
            var cy = yOfM(mN(cl));
            for (var cg = 110; cg <= 160; cg += 10) {
                var cx = xOf(cg);
                if (cx < 5 || cx > W - 5 || cy < 5 || cy > H - 5) continue;
                ausCrossH.push({ x: cx, y: cy, lat: cl, lng: cg });
            }
        }
    }

    /* ── Drawing helpers ─────────────────────────────────── */
    function pathFromCache(pts) {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
    }

    function bezierPt(p0, cp, p1, t) {
        var m = 1 - t;
        return {
            x: m * m * p0.x + 2 * m * t * cp.x + t * t * p1.x,
            y: m * m * p0.y + 2 * m * t * cp.y + t * t * p1.y,
        };
    }

    function arcCP(p0, p1) {
        var d = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
        return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 - d * 0.34 };
    }

    /* ── Earth global grid ───────────────────────────────── */
    function drawEarthGrid() {
        var i;

        /* Longitude lines — full height */
        for (i = 0; i < earthLngPx.length; i++) {
            var vl = earthLngPx[i];
            ctx.beginPath();
            ctx.moveTo(vl.x, 0);
            ctx.lineTo(vl.x, H);
            if (vl.isPrime) {
                ctx.strokeStyle = 'rgba(0,0,0,0.09)';
                ctx.lineWidth   = 1;
            } else {
                ctx.strokeStyle = 'rgba(0,0,0,0.032)';
                ctx.lineWidth   = 0.5;
            }
            ctx.stroke();
        }

        /* Latitude lines — full width */
        ctx.setLineDash([]);
        for (i = 0; i < earthLatPx.length; i++) {
            var hl = earthLatPx[i];
            ctx.beginPath();
            ctx.moveTo(0, hl.y);
            ctx.lineTo(W, hl.y);
            switch (hl.type) {
                case 'equator':
                    ctx.strokeStyle = 'rgba(0,0,0,0.09)';
                    ctx.lineWidth   = 1;
                    ctx.setLineDash([]);
                    break;
                case 'tropic':
                    ctx.strokeStyle = 'rgba(232,98,13,0.20)';
                    ctx.lineWidth   = 0.8;
                    ctx.setLineDash([8, 6]);
                    break;
                case 'circle':
                    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
                    ctx.lineWidth   = 0.5;
                    ctx.setLineDash([4, 8]);
                    break;
                default:
                    ctx.strokeStyle = 'rgba(0,0,0,0.030)';
                    ctx.lineWidth   = 0.5;
                    ctx.setLineDash([]);
            }
            ctx.stroke();
        }
        ctx.setLineDash([]);

        /* Reference line labels */
        ctx.font = '500 8px "Courier New", monospace';
        for (i = 0; i < earthLatPx.length; i++) {
            var lp = earthLatPx[i];
            if (lp.type === 'equator') {
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fillText('EQUATOR  0°', 14, lp.y - 4);
            } else if (lp.type === 'tropic' && lp.lat < 0) {
                ctx.fillStyle = 'rgba(232,98,13,0.35)';
                ctx.fillText('TROPIC OF CAPRICORN  23.4°S', 14, lp.y - 4);
            }
        }
    }

    /* ── Australia finer grid ────────────────────────────── */
    function drawAusGrid() {
        var i;
        ctx.setLineDash([]);

        for (i = 0; i < ausGridV.length; i++) {
            ctx.strokeStyle = 'rgba(0,0,0,0.040)';
            ctx.lineWidth   = 0.5;
            ctx.beginPath();
            ctx.moveTo(ausGridV[i], 0);
            ctx.lineTo(ausGridV[i], H);
            ctx.stroke();
        }

        for (i = 0; i < ausGridH.length; i++) {
            ctx.strokeStyle = 'rgba(0,0,0,0.040)';
            ctx.lineWidth   = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, ausGridH[i]);
            ctx.lineTo(W, ausGridH[i]);
            ctx.stroke();
        }

        /* Crosshair ticks */
        ctx.strokeStyle = 'rgba(0,0,0,0.075)';
        ctx.lineWidth   = 0.7;
        for (i = 0; i < ausCrossH.length; i++) {
            var cp = ausCrossH[i];
            ctx.beginPath();
            ctx.moveTo(cp.x - 4, cp.y); ctx.lineTo(cp.x + 4, cp.y);
            ctx.moveTo(cp.x, cp.y - 4); ctx.lineTo(cp.x, cp.y + 4);
            ctx.stroke();
        }

        /* Degree labels */
        ctx.fillStyle = 'rgba(0,0,0,0.068)';
        ctx.font      = '500 7px "Courier New", monospace';
        for (i = 0; i < ausCrossH.length; i++) {
            var lp = ausCrossH[i];
            ctx.fillText(Math.abs(lp.lat) + '°S ' + lp.lng + '°E', lp.x + 5, lp.y - 3);
        }
    }

    /* ── Land fill + stroke ──────────────────────────────── */
    function drawLand(pts, fill, stroke, lw) {
        pathFromCache(pts);
        if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }

    /* ── Burst waves from Perth ──────────────────────────── */
    function drawBursts(ts, perth) {
        var maxR = Math.max(W, H) * 0.82;
        for (var w = 0; w < 4; w++) {
            var phase = ((ts / 4800) + w * 0.25) % 1.0;
            var r     = phase * maxR;
            var alpha = (1 - phase) * 0.065;
            if (alpha < 0.003) continue;
            ctx.beginPath();
            ctx.arc(perth.x, perth.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(232,98,13,' + alpha.toFixed(3) + ')';
            ctx.lineWidth   = 1;
            ctx.stroke();
        }
    }

    /* ── Arcs with data packets ──────────────────────────── */
    function drawArcs(ts) {
        ARCS.forEach(function (arc) {
            var p0 = cityPx[arc.from];
            var p1 = cityPx[arc.to];
            var cp = arcCP(p0, p1);

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y);
            ctx.strokeStyle = 'rgba(232,98,13,0.10)';
            ctx.lineWidth   = 0.9;
            ctx.stroke();

            var t   = ((ts * arc.speed) + arc.phase) % 1.0;
            var dot = bezierPt(p0, cp, p1, t);

            for (var k = 8; k >= 0; k--) {
                var tt = Math.max(0, t - k * 0.013);
                var tp = bezierPt(p0, cp, p1, tt);
                var a  = (0.42 - k * 0.05) * (1 - k / 9);
                if (a <= 0) continue;
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, Math.max(0.4, 1.9 - k * 0.17), 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(232,98,13,' + a.toFixed(3) + ')';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(232,98,13,0.78)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(232,98,13,0.12)';
            ctx.fill();
        });
    }

    /* ── City markers ────────────────────────────────────── */
    function drawCities(ts) {
        CITY_DATA.forEach(function (city, i) {
            var p = cityPx[i];

            if (city.primary) {
                for (var r = 0; r < 3; r++) {
                    var rp = (Math.sin(ts * 0.0012 + r * 1.05) + 1) / 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 8 + r * 9 + rp * 10, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(232,98,13,' + (0.19 - r * 0.05) + ')';
                    ctx.lineWidth   = 0.9;
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(232,98,13,0.68)';
                ctx.fill();
                ctx.font      = '700 9px "Courier New", monospace';
                ctx.fillStyle = 'rgba(232,98,13,0.58)';
                ctx.fillText(city.name, p.x + 12, p.y + 4);
            } else {
                var pulse = (Math.sin(ts * 0.001 + i * 1.2) + 1) / 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4 + pulse * 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0,0,0,' + (0.07 + pulse * 0.04) + ')';
                ctx.lineWidth   = 0.8;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.18)';
                ctx.fill();
                ctx.font      = '600 8px "Courier New", monospace';
                ctx.fillStyle = 'rgba(0,0,0,0.16)';
                ctx.fillText(city.name, p.x + 8, p.y + 3);
            }
        });
    }

    /* ── Main render loop ────────────────────────────────── */
    function draw(ts) {
        ctx.clearRect(0, 0, W, H);

        drawEarthGrid();  /* 1. global earth lat/lng grid — full viewport */
        drawAusGrid();    /* 2. Australia 10° finer grid overlay */

        /* 3. Land polygon */
        drawLand(ausPath, 'rgba(232,98,13,0.038)', 'rgba(232,98,13,0.24)', 1.2);
        drawLand(tasPath, 'rgba(232,98,13,0.038)', 'rgba(232,98,13,0.20)', 1.0);

        /* 4. Animations */
        drawBursts(ts, cityPx[0]);
        drawArcs(ts);
        drawCities(ts);

        if (!paused) raf = requestAnimationFrame(draw);
    }

    /* ── Lifecycle ───────────────────────────────────────── */
    function start() {
        if (!reducedMotion && !paused) {
            raf = requestAnimationFrame(draw);
        } else {
            draw(0);
        }
    }

    function stop() {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        updateScale();
        rebuildCache();
    }

    function init() {
        resize();

        window.addEventListener('resize', function () {
            stop();
            resize();
            if (!document.hidden && !paused) start();
        });

        start();

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stop(); } else { if (!paused) start(); }
        });

        var obs = new MutationObserver(function () {
            paused = document.body.classList.contains('pause-animations');
            if (paused) { stop(); } else { if (!document.hidden) start(); }
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
