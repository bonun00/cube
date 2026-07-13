// 모바일: 메뉴/CTA 링크 클릭 시 햄버거 패널 자동 닫기
document.querySelectorAll('.site-nav .nav-panel a').forEach(function (a) {
    a.addEventListener('click', function () {
        var check = document.getElementById('nav-toggle-check');
        if (check) check.checked = false;
    });
});

// 1. Scroll Fade-in Animation
const fadeElements = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
        }
    });
}, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
fadeElements.forEach(el => observer.observe(el));

// 2. 메인 히어로 배경용 큐브 (Three.js) — #cube-canvas-container가 있는 페이지에서만 실행
function initHeroCube() {
    const container = document.getElementById('cube-canvas-container');
    if (!container) return;
    if (typeof THREE === 'undefined') return; // three.js 미로딩 페이지 보호
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 10);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dLight.position.set(5, 10, 7);
    scene.add(dLight);

    const cubeMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xB90000, roughness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0xFF5900, roughness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0xFFD500, roughness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0x009B48, roughness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0x0045AD, roughness: 0.2 })
    ];
    const cubeGeometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0B0E14, linewidth: 2 });

    const cubeGroup = new THREE.Group();
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const mesh = new THREE.Mesh(cubeGeometry, cubeMaterials);
                mesh.position.set(x, y, z);
                mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeometry), edgeMaterial));
                cubeGroup.add(mesh);
            }
        }
    }
    cubeGroup.rotation.set(Math.PI/6, -Math.PI/4, 0);
    scene.add(cubeGroup);

    function animate() {
        requestAnimationFrame(animate);
        cubeGroup.rotation.y += 0.003;
        cubeGroup.rotation.x += 0.001;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 3. 경우의 수 탭 전환 로직
//    (기준 시점 버튼이 플레이어 노드를 교체할 수 있으므로 항상 id로 다시 조회)
function setupTabs(stepId) {
    const tabsContainer = document.getElementById('tabs-' + stepId);
    if (!tabsContainer) return;

    const tabs = tabsContainer.querySelectorAll('.case-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const player = document.getElementById('player-' + stepId);
            if (player) player.setAttribute('alg', e.currentTarget.getAttribute('data-alg'));
            // 선택한 상황에 맞춰 공식 전체 표기도 갱신
            const notation = document.getElementById('notation-' + stepId);
            if (notation) notation.textContent = e.currentTarget.getAttribute('data-alg');
        });
    });
}

// 4. '기준 시점으로' 버튼: 드래그로 돌려본 큐브를 처음 카메라 각도로 되돌림.
//    twisty-player는 카메라 속성값이 같으면 재적용해도 반응하지 않으므로,
//    현재 속성(선택된 알고리즘 포함)을 그대로 가진 새 노드로 교체해 시점을 초기화한다.
function setupResetButtons() {
    const players = document.querySelectorAll('twisty-player[control-panel="bottom"]');
    players.forEach((player, i) => {
        if (!player.id) player.id = 'view-player-' + i;
        const pid = player.id;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'view-reset-btn';
        btn.textContent = '🧭 기준 시점으로';
        btn.addEventListener('click', () => {
            const el = document.getElementById(pid);
            if (!el) return;
            const fresh = el.cloneNode(true); // 현재 alg 등 속성 유지, 카메라만 기준값으로 재초기화
            el.replaceWith(fresh);
        });

        player.parentElement.appendChild(btn);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initHeroCube();
    setupTabs('step1'); // 흰색 십자가 상황별 탭
    setupTabs('step1b'); // 십자가 색 맞추기 탭
    setupTabs('step2'); // 1층 코너 상황별 탭
    setupTabs('step4'); // 2층 완성 탭
    setupTabs('step5'); // 노란색 십자가 탭
    setupTabs('step7'); // 테두리 정렬 탭
    setupResetButtons(); // 모든 조작용 큐브에 기준 시점 버튼 추가
});
