import * as THREE from "three";
export function mountNetwork(
  host: HTMLDivElement,
  target: number,
  zoom: number,
) {
  const start = performance.now();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x102131, 1);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-9, 9, 7, -7, 0.1, 100);
  camera.position.set(12, 16, 18);
  camera.lookAt(0, 0, 0);
  camera.zoom = zoom;
  scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x344758, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-4, 12, 5);
  scene.add(sun);
  const positions = [
    [-5, 0],
    [0, 0],
    [5, 0],
    [2, -4],
    [-2, 4],
    [5, 4],
  ];
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }
  box(0, -0.2, 0, 14, 0.35, 12, 0x1a3345);
  scene.add(new THREE.GridHelper(14, 14, 0x3d5868, 0x274253));
  positions.forEach(([x, z], i) => {
    if (i === 1) return;
    const selected = i === target;
    box(x, 0.06, z, 2.5, 0.12, 2, selected ? 0x28788b : 0x284252);
    if (i === 4) {
      box(x, 0.65, z, 1.7, 1.3, 1.2, 0xb9ac82);
      box(x, 1.38, z, 1.9, 0.15, 1.4, 0xe3cf92);
      for (const dx of [-1, 1])
        box(x + dx, 0.45, z + 0.8, 0.09, 0.9, 0.09, 0xe3cf92);
    } else if (i === 5) {
      for (const dx of [-0.5, 0.5])
        box(x + dx, 0.45, z, 0.8, 0.9, 1.2, 0xa7b6c3);
      for (const dx of [-1.1, 1.1])
        box(x + dx, 0.45, z, 0.08, 0.9, 2, 0xe6ad77);
      box(x, 0.9, z + 0.95, 2.2, 0.08, 0.08, 0xe6ad77);
    } else {
      box(x, 0.75, z, 1.9, 1.5, 1.35, selected ? 0x79c6d1 : 0x90aaba);
      box(x, 1.58, z, 2.15, 0.15, 1.6, 0xcde0e5);
      box(x, 0.5, z + 0.69, 0.8, 1, 0.05, 0x334f62);
      for (const dx of [-0.62, 0.62])
        box(x + dx, 1.1, z + 0.7, 0.3, 0.3, 0.05, 0xc3edfa);
    }
  });
  // The vehicle marks a decision point, never a measured GPS position.
  box(0, 0.55, 0, 1.5, 0.8, 0.7, 0xdcecf0);
  box(0.95, 0.4, 0, 0.5, 0.55, 0.7, 0x56cde2);
  box(1.2, 0.55, 0, 0.06, 0.22, 0.6, 0x234358);
  for (const x of [-0.5, 0.5, 1])
    for (const z of [-0.4, 0.4]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.13, 12),
        new THREE.MeshStandardMaterial({ color: 0x101722 }),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.16, z);
      scene.add(wheel);
    }
  const original = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5, 0.18, 0),
      new THREE.Vector3(5, 0.18, 0),
    ]),
    new THREE.LineDashedMaterial({
      color: 0xb5c5d3,
      dashSize: 0.3,
      gapSize: 0.22,
    }),
  );
  original.computeLineDistances();
  scene.add(original);
  const [tx, tz] = positions[target];
  const path = [new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(tx, 0.22, tz)];
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(path),
      1,
      0.065,
      6,
      false,
    ),
    new THREE.MeshBasicMaterial({ color: 0x67d8ef }),
  );
  scene.add(line);
  const labels = positions.map(([x, z], i) => {
    const el = document.createElement("span");
    el.className = "network-marker";
    el.textContent = String(i + 1);
    el.setAttribute("aria-hidden", "true");
    host.appendChild(el);
    return { el, point: new THREE.Vector3(x, 2.1, z) };
  });
  function draw() {
    const drawStart = performance.now();
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h);
    const aspect = w / h;
    const halfHeight = Math.max(8, 8 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    labels.forEach(({ el, point }) => {
      const v = point.clone().project(camera);
      el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    });
    host.dataset.drawCalls = String(renderer.info.render.calls);
    host.dataset.triangles = String(renderer.info.render.triangles);
    host.dataset.renderMs = String(Math.round(performance.now() - drawStart));
  }
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();
  host.dataset.initMs = String(Math.round(performance.now() - start));
  return () => {
    observer.disconnect();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    labels.forEach(({ el }) => el.remove());
    renderer.dispose();
    renderer.domElement.remove();
  };
}
