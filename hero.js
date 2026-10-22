// 메인 첫 화면 큐브 (Three.js r128, index.html 에서만 불러온다)
//
// 스스로 섞였다가(섞는 중) 그 반대 순서로 풀리고(푸는 중), 이걸 되풀이한다. 면은 진짜로 돈다 —
// 한 층의 조각 9개를 축(pivot)에 붙여 돌린 뒤 다시 큐브에 붙이고, 위치·방향을 정수로 맞춘다.
// 끌면 큐브가 돌아가고(놓으면 관성), 마우스를 움직이면 살짝 기운다. 큐브 밑 줄에 지금 돌리는 수를 보여준다.
(function () {
    const container = document.getElementById('cube-canvas-container');
    if (!container || typeof THREE === 'undefined') return;

    const TURN_MS = 420;            // 면 한 번 도는 시간
    const GAP_MS = 110;             // 수 사이 쉬는 시간
    const SCRAMBLE_LEN = 8;         // 섞는 수
    const PAUSE_SCRAMBLED_MS = 900; // 다 섞고 나서 멈춤
    const PAUSE_SOLVED_MS = 2600;   // 다 맞추고 나서 멈춤
    const AUTO_YAW = 0.16;          // 저절로 도는 속도 (rad/s)
    const BASE_PITCH = 0.5;         // 위에서 내려다보는 각도 (rad)
    const DRAG = 0.009;             // 끌기 감도 (rad/px)
    const FIT_RADIUS = 2.6;         // 어느 방향으로 돌아도 안 잘리는 반지름 (꼭짓점까지 √3×1.5)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover)').matches;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (err) {
        container.closest('.hero-stage').classList.add('no-webgl'); // WebGL 이 없으면 글자만
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(4, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
    fillLight.position.set(-6, -3, 4);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0x00f0ff, 0.9, 20); // 뒤쪽 네온 테두리
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    // tilt(마우스 따라 기울기) ⊃ spin(끌기·저절로 돌기) ⊃ cube(조각 27개)
    const tilt = new THREE.Group(), spin = new THREE.Group(), cube = new THREE.Group();
    scene.add(tilt);
    tilt.add(spin);
    spin.add(cube);

    // --- 큐브: 검은 몸통 27개 + 바깥쪽 면에만 스티커 (돌릴 때 안쪽 면이 색칠돼 보이지 않게) ---
    // 축은 다른 큐브들과 같다: x = R, y = U, z = F. 윗면 흰색, 앞면 초록.
    const FACE = {
        R: { axis: 'x', side: 1, color: 0xC8102E, rot: [0, Math.PI / 2, 0] },
        L: { axis: 'x', side: -1, color: 0xFF6A13, rot: [0, -Math.PI / 2, 0] },
        U: { axis: 'y', side: 1, color: 0xF2F4F7, rot: [-Math.PI / 2, 0, 0] },
        D: { axis: 'y', side: -1, color: 0xFFD500, rot: [Math.PI / 2, 0, 0] },
        F: { axis: 'z', side: 1, color: 0x00A651, rot: [0, 0, 0] },
        B: { axis: 'z', side: -1, color: 0x0051BA, rot: [0, Math.PI, 0] },
    }; // rot: +z 를 보는 스티커 판을 그 면 쪽으로 눕히는 회전
    const FACES = Object.keys(FACE);

    function roundedSquare(size, r) {
        const s = size / 2, sh = new THREE.Shape();
        sh.moveTo(-s + r, -s);
        sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r);
        sh.lineTo(s, s - r); sh.quadraticCurveTo(s, s, s - r, s);
        sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r);
        sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s);
        return new THREE.ShapeGeometry(sh, 4);
    }
    const bodyGeo = new THREE.BoxGeometry(0.97, 0.97, 0.97);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f131b, roughness: 0.55, metalness: 0.1 });
    const stickerGeo = roundedSquare(0.84, 0.14);
    const stickerMat = {};
    FACES.forEach((k) => { stickerMat[k] = new THREE.MeshStandardMaterial({ color: FACE[k].color, roughness: 0.32 }); });

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const piece = new THREE.Mesh(bodyGeo, bodyMat);
                piece.position.set(x, y, z);
                const at = { x, y, z };
                FACES.forEach((k) => {
                    const f = FACE[k];
                    if (at[f.axis] !== f.side) return;
                    const st = new THREE.Mesh(stickerGeo, stickerMat[k]);
                    st.position[f.axis] = f.side * 0.491;
                    st.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
                    piece.add(st);
                });
                cube.add(piece);
            }
        }
    }

    // --- 면 돌리기 ---
    // 그 면을 정면에서 볼 때 시계 방향 = 바깥 법선 축으로 -90°
    function turnAngle(move) {
        return -FACE[move[0]].side * (Math.PI / 2) * (move.endsWith("'") ? -1 : 1);
    }
    // 돌고 난 조각의 위치·방향을 정수로 맞춘다 (소수 오차가 쌓여 층이 안 골라지는 걸 막는다)
    const snapM = new THREE.Matrix4();
    function snap(p) {
        p.position.round();
        p.updateMatrix();
        const e = Array.from(p.matrix.elements, Math.round);
        snapM.set(e[0], e[4], e[8], 0, e[1], e[5], e[9], 0, e[2], e[6], e[10], 0, 0, 0, 0, 1);
        p.quaternion.setFromRotationMatrix(snapM);
    }
    let turning = null; // { pivot, axis, angle, start }
    function startTurn(move, now) {
        const f = FACE[move[0]];
        const pivot = new THREE.Object3D();
        cube.add(pivot);
        cube.children.filter((p) => p !== pivot && Math.round(p.position[f.axis]) === f.side)
            .forEach((p) => pivot.attach(p));
        turning = { pivot, axis: f.axis, angle: turnAngle(move), start: now };
    }
    function updateTurn(now) { // 다 돌았으면 true
        const t = Math.min(1, (now - turning.start) / TURN_MS);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        turning.pivot.rotation[turning.axis] = turning.angle * k;
        if (t < 1) return false;
        const pivot = turning.pivot;
        pivot.updateMatrixWorld(true);
        [...pivot.children].forEach((p) => { cube.attach(p); snap(p); });
        cube.remove(pivot);
        turning = null;
        return true;
    }

    // --- 섞기 → 멈춤 → 풀기(반대 순서) → 멈춤 → 다시 ---
    function randomMoves(n) {
        const out = [];
        let last = '';
        while (out.length < n) {
            const f = FACES[Math.floor(Math.random() * FACES.length)];
            if (f === last) continue; // 같은 면을 연달아 돌리지 않는다
            last = f;
            out.push(f + (Math.random() < 0.5 ? "'" : ''));
        }
        return out;
    }
    const invert = (moves) => moves.slice().reverse().map((m) => (m.endsWith("'") ? m[0] : m + "'"));

    let steps = [], stepIdx = 0, waitUntil = 0;
    function newCycle() {
        const scr = randomMoves(SCRAMBLE_LEN), sol = invert(scr);
        steps = [
            ...scr.map((move, i) => ({ move, phase: 'scramble', seq: scr, i })),
            { wait: PAUSE_SCRAMBLED_MS, phase: 'scrambled', seq: sol, i: -1 },
            ...sol.map((move, i) => ({ move, phase: 'solve', seq: sol, i })),
            { wait: PAUSE_SOLVED_MS, phase: 'solved', seq: sol, i: sol.length },
        ];
        stepIdx = 0;
    }
    function runTimeline(now) {
        if (turning) {
            if (!updateTurn(now)) return;
            waitUntil = now + GAP_MS;
        }
        if (now < waitUntil) return;
        if (stepIdx >= steps.length) newCycle();
        const s = steps[stepIdx++];
        showStep(s);
        if (s.wait) waitUntil = now + s.wait;
        else startTurn(s.move, now);
    }

    // 큐브 밑 줄: "섞는 중  R U' F …" — 지금 도는 수에 불이 들어온다
    const movesEl = document.getElementById('hero-moves');
    const labelEl = document.getElementById('hm-label');
    const seqEl = document.getElementById('hm-seq');
    const LABEL = { scramble: '섞는 중', scrambled: '푸는 중', solve: '푸는 중', solved: '완성!' };
    let shownSeq = null;
    function showStep(s) {
        if (!seqEl) return;
        if (s.seq !== shownSeq) {
            shownSeq = s.seq;
            seqEl.replaceChildren(...s.seq.map((m) => {
                const chip = document.createElement('span');
                chip.textContent = m;
                return chip;
            }));
        }
        labelEl.textContent = LABEL[s.phase];
        movesEl.dataset.phase = s.phase;
        Array.from(seqEl.children).forEach((chip, i) => {
            chip.className = i < s.i ? 'done' : i === s.i ? 'now' : '';
        });
    }

    // --- 끌어서 돌리기 (놓으면 관성, 서서히 원래 속도·각도로) ---
    const canvas = renderer.domElement;
    const hint = document.getElementById('hero-hint');
    let yaw = -Math.PI / 4, pitch = BASE_PITCH, yawVel = reduceMotion ? 0 : AUTO_YAW;
    let dragging = false, lastX = 0, lastY = 0, lastT = 0;
    canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        canvas.setPointerCapture(e.pointerId);
        lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
        yawVel = 0;
        container.classList.add('dragging');
        if (hint) hint.classList.add('gone');
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const now = performance.now();
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        yaw += dx * DRAG;
        pitch = Math.max(-0.4, Math.min(1.3, pitch + dy * DRAG));
        const v = (dx * DRAG) / (Math.max(8, now - lastT) / 1000);
        yawVel = yawVel * 0.6 + v * 0.4; // 놓을 때의 속도 (튀지 않게 섞는다)
        lastX = e.clientX; lastY = e.clientY; lastT = now;
    });
    function endDrag() {
        if (!dragging) return;
        dragging = false;
        if (performance.now() - lastT > 80) yawVel = 0; // 멈췄다 놓으면 관성 없음
        container.classList.remove('dragging');
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // 마우스를 따라 살짝 기울기 (마우스가 있는 기기만)
    let tiltX = 0, tiltY = 0;
    if (canHover && !reduceMotion) {
        window.addEventListener('pointermove', (e) => {
            tiltY = (e.clientX / window.innerWidth - 0.5) * 0.3;
            tiltX = (e.clientY / window.innerHeight - 0.5) * 0.18;
        });
    }

    // --- 크기: 상자에 큐브가 잘리지 않고 꽉 차게 카메라 거리를 맞춘다 ---
    function resize() {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
        camera.position.set(0, 0, FIT_RADIUS / Math.sin(Math.min(vHalf, hHalf)));
        camera.updateProjectionMatrix();
    }
    resize();
    new ResizeObserver(resize).observe(container);

    // --- 그리기: 화면에 보일 때만 돈다 ---
    let visible = true, rafId = null, lastNow = null;
    function frame(now) {
        rafId = null;
        const dt = lastNow === null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
        lastNow = now;
        if (!reduceMotion) runTimeline(now);
        if (!dragging) {
            const target = reduceMotion ? 0 : AUTO_YAW;
            yawVel += (target - yawVel) * (1 - Math.exp(-dt * 1.6));
            yaw += yawVel * dt;
            pitch += (BASE_PITCH - pitch) * (1 - Math.exp(-dt * 1.2));
        }
        spin.rotation.set(pitch, yaw, 0); // 먼저 좌우(y), 그다음 내려다보기(x)
        tilt.rotation.x += (tiltX - tilt.rotation.x) * (1 - Math.exp(-dt * 4));
        tilt.rotation.y += (tiltY - tilt.rotation.y) * (1 - Math.exp(-dt * 4));
        renderer.render(scene, camera);
        if (visible) rafId = requestAnimationFrame(frame);
    }
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && rafId === null) { lastNow = null; rafId = requestAnimationFrame(frame); }
    }).observe(container);
    if (reduceMotion && seqEl) movesEl.hidden = true; // 저절로 돌지 않으니 수 줄도 없다
    rafId = requestAnimationFrame(frame);
})();
