import * as THREE from "three";
import {
  createMercuryTexture,
  createVenusTexture,
  createEarthTexture,
  createEarthRoughnessTexture,
  createEarthNightTexture,
  createCraterBumpMap,
  createEarthCloudsTexture,
  createMarsTexture,
  createJupiterTexture,
  createSaturnTexture,
  createSaturnRingsTexture,
  createUranusTexture,
  createNeptuneTexture,
  createNebulaTexture,
} from "./planet-textures";

// ─── ORBIT LINES ───
export const orbitRadii = [8.0, 16.0, 24.0, 32.0, 44.0, 58.0, 72.0, 86.0];
export const orbitColors = [0x94a3b8, 0xeab308, 0x3b82f6, 0xef4444, 0xd97706, 0xfacc15, 0x22d3ee, 0x818cf8];

export function buildOrbitLines(getSegs: (d: number, m: number) => number) {
  const group = new THREE.Group();
  orbitRadii.forEach((r, idx) => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: orbitColors[idx],
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    group.add(line);
  });
  return group;
}

// ─── ATMOSPHERE GLOW SHADER ───
export function createAtmosphereMaterial(color: THREE.Color, intensity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGlowColor: { value: color },
      uIntensity: { value: intensity },
      uSunViewDir: { value: new THREE.Vector3(0, 0, 1) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vViewPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uGlowColor;
      uniform float uIntensity;
      uniform vec3 uSunViewDir;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(-vViewPos);
        vec3 normal = normalize(vNormal);
        float fresnel = 1.0 - dot(normal, viewDir);
        fresnel = pow(fresnel, 4.0) * uIntensity;
        float daySide = dot(normal, normalize(uSunViewDir));
        float dayFactor = smoothstep(-0.25, 0.35, daySide);
        float sunsetFactor = smoothstep(0.35, -0.1, daySide) * smoothstep(-0.25, 0.05, daySide);
        vec3 sunsetColor = vec3(1.0, 0.42, 0.12);
        vec3 finalGlowColor = mix(uGlowColor, sunsetColor, sunsetFactor * 0.9);
        gl_FragColor = vec4(finalGlowColor, fresnel * dayFactor);
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ─── SUN PLASMA SHADER ───
export function createSunShaderMat() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0xff3800) },
      uColor2: { value: new THREE.Color(0xffbb00) },
    },
    vertexShader: `
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - D.yyy;
        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x4 = x_ * ns.x + ns.yyyy;
        vec4 y4 = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x4) - abs(y4);
        vec4 b0 = vec4(x4.xy, y4.xy);
        vec4 b1 = vec4(x4.zw, y4.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }

      uniform float uTime;
      varying vec3 vNormal;
      varying float vNoise;
      varying vec3 vPosition;
      void main() {
        vNormal = normal;
        vPosition = position;
        vNoise = snoise(position * 2.0 + vec3(0.0, uTime * 0.18, uTime * 0.06));
        vec3 newPos = position + normal * vNoise * 0.06;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec3 vNormal;
      varying float vNoise;
      varying vec3 vPosition;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 vd = normalize(vec3(0.0, 0.0, 1.0));
        float fresnel = pow(1.0 - max(dot(n, vd), 0.0), 2.5);
        float blend = n.y * 0.5 + 0.5 + vNoise * 0.25;
        vec3 base = mix(uColor1, uColor2, blend + sin(uTime * 0.4) * 0.12);
        vec3 hot = vec3(1.0, 0.95, 0.8);
        vec3 finalColor = mix(base, hot, fresnel * 0.9 + vNoise * 0.15);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

// ─── WAYPOINTS ───
export const planetWaypoints = [
  { pos: new THREE.Vector3(0.0, 0.0, 0.0), size: 0.0, name: "Tata Surya" },
  { pos: new THREE.Vector3(0.0, 0.0, 0.0), size: 1.5, name: "Matahari" },
  { pos: new THREE.Vector3(1.0, 0.3, -8.0), size: 0.32, name: "Merkurius" },
  { pos: new THREE.Vector3(-1.2, -0.4, -16.0), size: 0.48, name: "Venus" },
  { pos: new THREE.Vector3(1.5, 0.5, -24.0), size: 0.52, name: "Bumi" },
  { pos: new THREE.Vector3(-1.0, -0.3, -32.0), size: 0.42, name: "Mars" },
  { pos: new THREE.Vector3(2.5, 0.8, -44.0), size: 1.1, name: "Yupiter" },
  { pos: new THREE.Vector3(-3.0, -0.6, -58.0), size: 0.82, name: "Saturnus" },
  { pos: new THREE.Vector3(2.0, 0.7, -72.0), size: 0.65, name: "Uranus" },
  { pos: new THREE.Vector3(-1.8, -0.5, -86.0), size: 0.62, name: "Neptunus" },
];

export function getCameraWaypoints(isMobile: boolean) {
  return isMobile
    ? [
        new THREE.Vector3(0.0, 120.0, 120.0),
        new THREE.Vector3(0.0, 0.3, -5.5),
        new THREE.Vector3(1.0, 0.6, -13.5),
        new THREE.Vector3(-1.2, -0.1, -21.5),
        new THREE.Vector3(1.5, 0.8, -29.5),
        new THREE.Vector3(-1.0, 0.0, -37.5),
        new THREE.Vector3(2.5, 1.1, -51.5),
        new THREE.Vector3(-3.0, -0.3, -65.5),
        new THREE.Vector3(2.0, 1.0, -79.5),
        new THREE.Vector3(-1.8, -0.2, -93.5),
      ]
    : [
        new THREE.Vector3(0.0, 105.0, 105.0),
        new THREE.Vector3(0.0, 0.3, -4.0),
        new THREE.Vector3(1.0, 0.6, -11.5),
        new THREE.Vector3(-1.2, -0.1, -19.5),
        new THREE.Vector3(1.5, 0.8, -27.5),
        new THREE.Vector3(-1.0, 0.0, -35.5),
        new THREE.Vector3(2.5, 1.1, -48.5),
        new THREE.Vector3(-3.0, -0.3, -62.5),
        new THREE.Vector3(2.0, 1.0, -76.5),
        new THREE.Vector3(-1.8, -0.2, -90.5),
      ];
}

// ─── LABEL DATA ───
export const labelData = [
  { name: "TATA SURYA", desc: "SDN 1 Kenanga", stat: "Ekosistem Pendidikan Terpadu", color: "#8b5cf6" },
  { name: "MATAHARI", desc: "Bintang G2V · Pusat Tata Surya", stat: "Suhu inti ~15 juta °C", color: "#f97316" },
  { name: "MERKURIUS", desc: "Planet Berbatu Terkecil", stat: "0,39 SA · Orbit 88 hari", color: "#94a3b8" },
  { name: "VENUS", desc: "Kembaran Bumi · Terpanas", stat: "Permukaan ~462 °C", color: "#eab308" },
  { name: "BUMI", desc: "Zona Layak Huni · Air Cair", stat: "1,00 SA · 1 Satelit (Bulan)", color: "#3b82f6" },
  { name: "MARS", desc: "Planet Merah · Oksida Besi", stat: "1,52 SA · Olympus Mons", color: "#ef4444" },
  { name: "YUPITER", desc: "Raksasa Gas · Terbesar", stat: "5,20 SA · Great Red Spot", color: "#d97706" },
  { name: "SATURNUS", desc: "Raksasa Gas · Sistem Cincin", stat: "9,58 SA · Cassini Division", color: "#facc15" },
  { name: "URANUS", desc: "Raksasa Es · Rotasi Miring 98°", stat: "19,2 SA · Cincin Vertikal", color: "#22d3ee" },
  { name: "NEPTUNUS", desc: "Raksasa Es · Planet Terluar", stat: "30,1 SA · Angin Supersonik", color: "#818cf8" },
];

// ══════════════════════════════════════════════════════════
// MAIN BUILDER
// ══════════════════════════════════════════════════════════
export interface SceneObjects {
  // Shader materials (need uniform updates)
  sunShaderMat: THREE.ShaderMaterial;
  earthMat: THREE.MeshStandardMaterial;
  earthAtmoMat: THREE.ShaderMaterial;
  venusAtmoMat: THREE.ShaderMaterial;
  uranusAtmoMat: THREE.ShaderMaterial;
  neptuneAtmoMat: THREE.ShaderMaterial;
  jupiterMat: THREE.MeshStandardMaterial;
  saturnMat: THREE.MeshStandardMaterial;
  starMat: THREE.ShaderMaterial;

  // Sun
  sunMesh: THREE.Mesh;
  coronaSprite: THREE.Sprite;

  // Mercury
  mercuryMesh: THREE.Mesh;

  // Venus
  venusMesh: THREE.Mesh;
  venusAtmoMesh: THREE.Mesh;

  // Earth system
  earthGroup: THREE.Group;
  earthMesh: THREE.Mesh;
  earthCloudsMesh: THREE.Mesh;
  earthAtmoMesh: THREE.Mesh;
  moonOrbitGroup: THREE.Group;

  // Mars
  marsMesh: THREE.Mesh;

  // Jupiter
  jupiterMesh: THREE.Mesh;

  // Saturn system
  saturnGroup: THREE.Group;
  saturnMesh: THREE.Mesh;
  saturnRingMesh: THREE.Mesh;

  // Uranus system
  uranusGroup: THREE.Group;
  uranusMesh: THREE.Mesh;
  uranusAtmoMesh: THREE.Mesh;
  uranusRingMesh: THREE.Mesh;

  // Neptune
  neptuneMesh: THREE.Mesh;
  neptuneAtmoMesh: THREE.Mesh;

  // Extras
  orbitLinesGroup: THREE.Group;
  asteroidBeltGroup: THREE.Group;
  asteroids: THREE.Mesh[];
  nebulae: THREE.Sprite[];
  shootingStars: { mesh: THREE.Line; speed: number; active: boolean; delay: number }[];
  starField: THREE.Points;

  // HUD
  labelElements: HTMLDivElement[];
  planetMeshes: THREE.Object3D[];

  // Disposables for cleanup
  disposables: {
    geos: THREE.BufferGeometry[];
    asteroidGeos: THREE.BufferGeometry[];
    textures: THREE.Texture[];
    materials: THREE.Material[];
    orbitLineGeos: THREE.BufferGeometry[];
    orbitLineMats: THREE.Material[];
  };
}

export function buildSceneObjects(
  scene: THREE.Scene,
  solarSystemGroup: THREE.Group,
  getSegs: (d: number, m: number) => number,
  isMobile: boolean,
  hudContainer: HTMLDivElement,
): SceneObjects {
  const geos: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  // ─── Orbit Lines ───
  const orbitLinesGroup = buildOrbitLines(getSegs);
  solarSystemGroup.add(orbitLinesGroup);

  // ─── Textures ───
  const mercuryTex = createMercuryTexture();
  const mercuryBumpTex = createCraterBumpMap();
  const venusTex = createVenusTexture();
  const earthDayTex = createEarthTexture();
  const earthNightTex = createEarthNightTexture();
  const earthRoughnessTex = createEarthRoughnessTexture();
  const earthCloudsTex = createEarthCloudsTexture();
  const marsTex = createMarsTexture();
  const marsBumpTex = createCraterBumpMap();
  const jupiterTex = createJupiterTexture();
  const saturnTex = createSaturnTexture();
  const saturnRingsTex = createSaturnRingsTexture();
  const uranusTex = createUranusTexture();
  const neptuneTex = createNeptuneTexture();

  textures.push(
    mercuryTex, mercuryBumpTex, venusTex, earthDayTex, earthNightTex,
    earthRoughnessTex, earthCloudsTex, marsTex, marsBumpTex,
    jupiterTex, saturnTex, saturnRingsTex, uranusTex, neptuneTex,
  );

  // ─── Materials ───
  const mercuryMat = new THREE.MeshStandardMaterial({ map: mercuryTex, bumpMap: mercuryBumpTex, bumpScale: 0.008, roughness: 0.9, metalness: 0.1 });
  const venusMat = new THREE.MeshStandardMaterial({ map: venusTex, roughness: 0.92 });
  const earthMat = new THREE.MeshStandardMaterial({ map: earthDayTex, roughnessMap: earthRoughnessTex, metalness: 0.1 });
  const marsMat = new THREE.MeshStandardMaterial({ map: marsTex, bumpMap: marsBumpTex, bumpScale: 0.015, roughness: 0.85 });
  const jupiterMat = new THREE.MeshStandardMaterial({ map: jupiterTex, roughness: 0.42 });
  const saturnMat = new THREE.MeshStandardMaterial({ map: saturnTex, roughness: 0.52 });
  const saturnRingMat = new THREE.MeshStandardMaterial({ map: saturnRingsTex, side: THREE.DoubleSide, transparent: true, opacity: 0.95, roughness: 0.4, metalness: 0.6 });
  const uranusMat = new THREE.MeshStandardMaterial({ map: uranusTex, roughness: 0.38, metalness: 0.08 });
  const neptuneMat = new THREE.MeshStandardMaterial({ map: neptuneTex, roughness: 0.45 });

  materials.push(mercuryMat, venusMat, earthMat, marsMat, jupiterMat, saturnMat, saturnRingMat, uranusMat, neptuneMat);

  // Earth day/night shader patch
  earthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNightMap = { value: earthNightTex };
    shader.uniforms.uSunViewDir = { value: new THREE.Vector3(0, 0, 1) };
    earthMat.userData.shader = shader;
    shader.fragmentShader = 'uniform sampler2D uNightMap;\nuniform vec3 uSunViewDir;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 texelColor = texture2D( map, vMapUv );',
      `
        vec4 dayColor = texture2D( map, vMapUv );
        vec4 nightColor = texture2D( uNightMap, vMapUv );
        float dayFactor = dot(normalize(vNormal), normalize(uSunViewDir));
        float blend = smoothstep(-0.15, 0.15, dayFactor);
        vec4 texelColor = mix(nightColor, dayColor, blend);
      `,
    );
  };

  // Jupiter band animation shader patch
  jupiterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    jupiterMat.userData.shader = shader;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `
        #include <uv_vertex>
        float latitude = sin(uv.y * 3.14159 * 8.0);
        vMapUv.x += uTime * latitude * 0.012;
        vMapUv.x += sin(uv.y * 45.0 + uTime * 0.08) * 0.0015;
      `,
    );
  };

  // Saturn band animation shader patch
  saturnMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    saturnMat.userData.shader = shader;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `
        #include <uv_vertex>
        float latitude = sin(uv.y * 3.14159 * 4.0);
        vMapUv.x += uTime * latitude * 0.008;
      `,
    );
  };

  // Atmosphere materials
  const earthAtmoMat = createAtmosphereMaterial(new THREE.Color(0x4488ff), 1.6);
  const venusAtmoMat = createAtmosphereMaterial(new THREE.Color(0xddaa44), 1.2);
  const neptuneAtmoMat = createAtmosphereMaterial(new THREE.Color(0x3355cc), 1.4);
  const uranusAtmoMat = createAtmosphereMaterial(new THREE.Color(0x55cccc), 1.1);
  materials.push(earthAtmoMat, venusAtmoMat, neptuneAtmoMat, uranusAtmoMat);

  // ─── Sun ───
  const sunShaderMat = createSunShaderMat();
  materials.push(sunShaderMat);

  const sunGeo = new THREE.SphereGeometry(1.5, getSegs(48, 24), getSegs(48, 24));
  geos.push(sunGeo);
  const sunMesh = new THREE.Mesh(sunGeo, sunShaderMat);
  sunMesh.position.copy(planetWaypoints[1].pos);
  solarSystemGroup.add(sunMesh);

  // Sun Corona Glow
  const coronaCanvas = document.createElement("canvas");
  coronaCanvas.width = 256; coronaCanvas.height = 256;
  const coronaCtx = coronaCanvas.getContext("2d")!;
  const coronaGrad = coronaCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  coronaGrad.addColorStop(0, "rgba(255, 200, 80, 0.6)");
  coronaGrad.addColorStop(0.2, "rgba(255, 160, 40, 0.3)");
  coronaGrad.addColorStop(0.45, "rgba(255, 100, 20, 0.1)");
  coronaGrad.addColorStop(0.7, "rgba(255, 60, 10, 0.03)");
  coronaGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  coronaCtx.fillStyle = coronaGrad;
  coronaCtx.fillRect(0, 0, 256, 256);
  const coronaTex = new THREE.CanvasTexture(coronaCanvas);
  textures.push(coronaTex);
  const coronaMat = new THREE.SpriteMaterial({ map: coronaTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  materials.push(coronaMat);
  const coronaSprite = new THREE.Sprite(coronaMat);
  coronaSprite.scale.set(6, 6, 1);
  coronaSprite.position.copy(planetWaypoints[1].pos);
  solarSystemGroup.add(coronaSprite);

  // ─── Mercury ───
  const mercuryGeo = new THREE.SphereGeometry(0.32, getSegs(24, 12), getSegs(24, 12));
  geos.push(mercuryGeo);
  const mercuryMesh = new THREE.Mesh(mercuryGeo, mercuryMat);
  mercuryMesh.position.copy(planetWaypoints[2].pos);
  mercuryMesh.castShadow = !isMobile;
  solarSystemGroup.add(mercuryMesh);

  // ─── Venus + atmosphere ───
  const venusGeo = new THREE.SphereGeometry(0.48, getSegs(24, 12), getSegs(24, 12));
  geos.push(venusGeo);
  const venusMesh = new THREE.Mesh(venusGeo, venusMat);
  venusMesh.position.copy(planetWaypoints[3].pos);
  venusMesh.castShadow = !isMobile;
  solarSystemGroup.add(venusMesh);
  const venusAtmoGeo = new THREE.SphereGeometry(0.53, getSegs(24, 12), getSegs(24, 12));
  geos.push(venusAtmoGeo);
  const venusAtmoMesh = new THREE.Mesh(venusAtmoGeo, venusAtmoMat);
  venusAtmoMesh.position.copy(planetWaypoints[3].pos);
  solarSystemGroup.add(venusAtmoMesh);

  // ─── Earth + clouds + atmosphere + Moon ───
  const earthGroup = new THREE.Group();
  earthGroup.position.copy(planetWaypoints[4].pos);

  const earthGeo = new THREE.SphereGeometry(0.52, getSegs(32, 16), getSegs(32, 16));
  geos.push(earthGeo);
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.castShadow = !isMobile;
  earthGroup.add(earthMesh);

  const earthCloudsTexLocal = createEarthCloudsTexture();
  textures.push(earthCloudsTexLocal);
  const earthCloudsGeo = new THREE.SphereGeometry(0.535, getSegs(32, 16), getSegs(32, 16));
  geos.push(earthCloudsGeo);
  const earthCloudsMat = new THREE.MeshStandardMaterial({ map: earthCloudsTexLocal, transparent: true, opacity: 0.82, depthWrite: false });
  materials.push(earthCloudsMat);
  const earthCloudsMesh = new THREE.Mesh(earthCloudsGeo, earthCloudsMat);
  earthGroup.add(earthCloudsMesh);

  const earthAtmoGeo = new THREE.SphereGeometry(0.58, getSegs(32, 16), getSegs(32, 16));
  geos.push(earthAtmoGeo);
  const earthAtmoMesh = new THREE.Mesh(earthAtmoGeo, earthAtmoMat);
  earthGroup.add(earthAtmoMesh);

  const moonOrbitGroup = new THREE.Group();
  earthGroup.add(moonOrbitGroup);
  const moonGeo = new THREE.SphereGeometry(0.07, getSegs(16, 8), getSegs(16, 8));
  geos.push(moonGeo);
  const moonMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.92 });
  materials.push(moonMat);
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(0.95, 0, 0);
  moonMesh.castShadow = !isMobile;
  moonOrbitGroup.add(moonMesh);
  solarSystemGroup.add(earthGroup);

  // ─── Mars ───
  const marsGeo = new THREE.SphereGeometry(0.42, getSegs(24, 12), getSegs(24, 12));
  geos.push(marsGeo);
  const marsMesh = new THREE.Mesh(marsGeo, marsMat);
  marsMesh.position.copy(planetWaypoints[5].pos);
  marsMesh.castShadow = !isMobile;
  solarSystemGroup.add(marsMesh);

  // ─── Jupiter ───
  const jupiterGeo = new THREE.SphereGeometry(1.1, getSegs(48, 24), getSegs(48, 24));
  geos.push(jupiterGeo);
  const jupiterMesh = new THREE.Mesh(jupiterGeo, jupiterMat);
  jupiterMesh.position.copy(planetWaypoints[6].pos);
  jupiterMesh.castShadow = !isMobile;
  solarSystemGroup.add(jupiterMesh);

  // ─── Saturn + rings ───
  const saturnGroup = new THREE.Group();
  saturnGroup.position.copy(planetWaypoints[7].pos);
  const saturnGeo = new THREE.SphereGeometry(0.82, getSegs(32, 16), getSegs(32, 16));
  geos.push(saturnGeo);
  const saturnMesh = new THREE.Mesh(saturnGeo, saturnMat);
  saturnMesh.castShadow = !isMobile;
  saturnMesh.receiveShadow = !isMobile;
  saturnGroup.add(saturnMesh);
  const saturnRingGeo = new THREE.RingGeometry(0.82 * 1.3, 0.82 * 2.5, getSegs(96, 48));
  geos.push(saturnRingGeo);
  const saturnRingMesh = new THREE.Mesh(saturnRingGeo, saturnRingMat);
  saturnRingMesh.rotation.x = Math.PI / 2.3;
  saturnRingMesh.castShadow = !isMobile;
  saturnRingMesh.receiveShadow = !isMobile;
  saturnGroup.add(saturnRingMesh);
  solarSystemGroup.add(saturnGroup);

  // ─── Uranus + atmosphere + ring ───
  const uranusGroup = new THREE.Group();
  uranusGroup.position.copy(planetWaypoints[8].pos);
  const uranusGeo = new THREE.SphereGeometry(0.65, getSegs(32, 16), getSegs(32, 16));
  geos.push(uranusGeo);
  const uranusMesh = new THREE.Mesh(uranusGeo, uranusMat);
  uranusMesh.castShadow = !isMobile;
  uranusGroup.add(uranusMesh);
  const uranusAtmoGeo = new THREE.SphereGeometry(0.72, getSegs(32, 16), getSegs(32, 16));
  geos.push(uranusAtmoGeo);
  const uranusAtmoMesh = new THREE.Mesh(uranusAtmoGeo, uranusAtmoMat);
  uranusGroup.add(uranusAtmoMesh);
  const uranusRingGeo = new THREE.RingGeometry(0.82, 0.88, getSegs(48, 24));
  geos.push(uranusRingGeo);
  const uranusRingMesh = new THREE.Mesh(uranusRingGeo, new THREE.MeshStandardMaterial({
    color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.3,
  }));
  materials.push(uranusRingMesh.material as THREE.MeshStandardMaterial);
  uranusRingMesh.rotation.y = Math.PI / 6;
  uranusRingMesh.rotation.x = Math.PI / 2;
  uranusGroup.add(uranusRingMesh);
  solarSystemGroup.add(uranusGroup);

  // ─── Neptune + atmosphere ───
  const neptuneGeo = new THREE.SphereGeometry(0.62, getSegs(32, 16), getSegs(32, 16));
  geos.push(neptuneGeo);
  const neptuneMesh = new THREE.Mesh(neptuneGeo, neptuneMat);
  neptuneMesh.position.copy(planetWaypoints[9].pos);
  neptuneMesh.castShadow = !isMobile;
  solarSystemGroup.add(neptuneMesh);
  const neptuneAtmoGeo = new THREE.SphereGeometry(0.68, getSegs(32, 16), getSegs(32, 16));
  geos.push(neptuneAtmoGeo);
  const neptuneAtmoMesh = new THREE.Mesh(neptuneAtmoGeo, neptuneAtmoMat);
  neptuneAtmoMesh.position.copy(planetWaypoints[9].pos);
  solarSystemGroup.add(neptuneAtmoMesh);

  // ─── Asteroid Belt ───
  const asteroidBeltGroup = new THREE.Group();
  solarSystemGroup.add(asteroidBeltGroup);
  const asteroidCount = isMobile ? 25 : 100;
  const asteroids: THREE.Mesh[] = [];
  const asteroidGeos = [
    new THREE.DodecahedronGeometry(0.04, 0),
    new THREE.DodecahedronGeometry(0.04, 1),
    new THREE.IcosahedronGeometry(0.04, 0),
  ];
  const asteroidMat = new THREE.MeshStandardMaterial({ color: 0x5e6872, roughness: 0.95, metalness: 0.05 });
  materials.push(asteroidMat);
  const beltCenter = new THREE.Vector3(0.75, 0.25, -38.0);
  for (let i = 0; i < asteroidCount; i++) {
    const geo = asteroidGeos[Math.floor(Math.random() * asteroidGeos.length)];
    const ast = new THREE.Mesh(geo, asteroidMat);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 4.2 + 0.5;
    ast.position.set(
      beltCenter.x + Math.cos(angle) * radius,
      beltCenter.y + Math.sin(angle) * radius,
      beltCenter.z + (Math.random() - 0.5) * 6,
    );
    ast.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    const s = Math.random() * 0.8 + 0.2;
    ast.scale.set(s, s * (0.6 + Math.random() * 0.8), s);
    asteroidBeltGroup.add(ast);
    asteroids.push(ast);
  }

  // ─── Nebulae ───
  const nebulaConfigs = [
    { r: 120, g: 45, b: 180, x: -4, y: 2, z: -12, scale: 16 },
    { r: 180, g: 35, b: 100, x: 5, y: -1, z: -38, scale: 22 },
    { r: 40, g: 90, b: 200, x: -3, y: 1.5, z: -65, scale: 20 },
    { r: 60, g: 140, b: 180, x: 4, y: -2, z: -80, scale: 18 },
  ];
  const nebulae: THREE.Sprite[] = [];
  (isMobile ? nebulaConfigs.slice(0, 2) : nebulaConfigs).forEach((nc) => {
    const tex = createNebulaTexture(nc.r, nc.g, nc.b);
    textures.push(tex);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    materials.push(mat);
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(nc.x, nc.y, nc.z);
    sprite.scale.set(nc.scale, nc.scale, 1);
    scene.add(sprite);
    nebulae.push(sprite);
  });

  // ─── Shooting Stars ───
  const shootingStarCount = isMobile ? 0 : 4;
  const shootingStars: { mesh: THREE.Line; speed: number; active: boolean; delay: number }[] = [];
  for (let i = 0; i < shootingStarCount; i++) {
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.5, -0.7, 0.4)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geos.push(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    materials.push(mat);
    const mesh = new THREE.Line(geo, mat);
    scene.add(mesh);
    shootingStars.push({ mesh, speed: Math.random() * 0.3 + 0.2, active: false, delay: Math.random() * 4 });
  }

  // ─── Starfield ───
  const starCount = isMobile ? 150 : 420;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPalette = [
    [0.7, 0.8, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.95, 0.85],
    [1.0, 0.85, 0.6],
    [1.0, 0.7, 0.5],
  ];
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    starPositions[i3] = (Math.random() - 0.5) * 100;
    starPositions[i3 + 1] = (Math.random() - 0.5) * 100;
    starPositions[i3 + 2] = Math.random() * 200 - 180;
    const palette = starPalette[Math.floor(Math.random() * starPalette.length)];
    starColors[i3] = palette[0];
    starColors[i3 + 1] = palette[1];
    starColors[i3 + 2] = palette[2];
    starSizes[i] = Math.random() * 2.5 + 0.4;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  geos.push(starGeo);

  const starDotC = document.createElement("canvas");
  starDotC.width = 32; starDotC.height = 32;
  const starDotCtx = starDotC.getContext("2d")!;
  const sdGrad = starDotCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  sdGrad.addColorStop(0, "rgba(255,255,255,1)");
  sdGrad.addColorStop(0.15, "rgba(255,255,255,0.8)");
  sdGrad.addColorStop(0.5, "rgba(255,255,255,0.15)");
  sdGrad.addColorStop(1, "rgba(255,255,255,0)");
  starDotCtx.fillStyle = sdGrad;
  starDotCtx.fillRect(0, 0, 32, 32);
  const starDotTex = new THREE.CanvasTexture(starDotC);
  textures.push(starDotTex);

  const starMat = new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.15 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSize;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        float hash = sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453;
        vTwinkle = sin(uTime * 2.5 + hash) * 0.35 + 0.65;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * vTwinkle * (350.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.05, dist) * vTwinkle;
        gl_FragColor = vec4(vColor, alpha * 0.9);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.push(starMat);
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── HUD Labels ───
  const labelElements: HTMLDivElement[] = [];
  labelData.forEach((data) => {
    const el = document.createElement("div");
    el.className = "absolute pointer-events-none opacity-0 select-none flex items-start gap-4 z-30 transition-opacity duration-300";
    el.style.display = "none";
    el.style.left = "0px";
    el.style.top = "0px";
    el.innerHTML = `
      <div class="flex flex-col items-center gap-1.5 pt-1.5">
        <div class="h-4 w-4 rounded-full ring-2 ring-offset-2 ring-offset-black/60" style="background:${data.color}; box-shadow: 0 0 12px ${data.color}dd; ring-color:${data.color}88"></div>
        <div class="w-px h-10 opacity-60" style="background:${data.color}"></div>
      </div>
      <div class="bg-black/90 backdrop-blur-xl border border-white/15 rounded-2xl px-5 py-4 shadow-2xl min-w-[260px] md:min-w-[280px] flex flex-col gap-2">
        <div class="font-mono font-black tracking-[0.2em] text-[16px] md:text-[18px] leading-none pb-0.5" style="color:${data.color}">${data.name}</div>
        <div class="text-[13px] md:text-[14px] text-zinc-200 font-sans leading-relaxed mt-0.5">${data.desc}</div>
        <div class="text-[12px] md:text-[13px] text-zinc-350 font-mono leading-normal border-t border-white/15 pt-2 mt-1">${data.stat}</div>
      </div>
    `;
    hudContainer.appendChild(el);
    labelElements.push(el);
  });

  const planetMeshes: THREE.Object3D[] = [
    solarSystemGroup, // Index 0: Overview
    sunMesh,          // Index 1: Matahari
    mercuryMesh,      // Index 2: Merkurius
    venusMesh,        // Index 3: Venus
    earthGroup,       // Index 4: Bumi
    marsMesh,         // Index 5: Mars
    jupiterMesh,      // Index 6: Yupiter
    saturnGroup,      // Index 7: Saturnus
    uranusGroup,      // Index 8: Uranus
    neptuneMesh,      // Index 9: Neptunus
  ];

  // Collect orbit line geometries/materials for cleanup
  const orbitLineGeos: THREE.BufferGeometry[] = [];
  const orbitLineMats: THREE.Material[] = [];
  orbitLinesGroup.children.forEach((child) => {
    const line = child as THREE.Line;
    orbitLineGeos.push(line.geometry as THREE.BufferGeometry);
    const lm = line.material;
    orbitLineMats.push(Array.isArray(lm) ? lm[0] : lm);
  });

  return {
    sunShaderMat,
    earthMat,
    earthAtmoMat,
    venusAtmoMat,
    uranusAtmoMat,
    neptuneAtmoMat,
    jupiterMat,
    saturnMat,
    starMat,

    sunMesh,
    coronaSprite,

    mercuryMesh,
    venusMesh,
    venusAtmoMesh,

    earthGroup,
    earthMesh,
    earthCloudsMesh,
    earthAtmoMesh,
    moonOrbitGroup,

    marsMesh,
    jupiterMesh,

    saturnGroup,
    saturnMesh,
    saturnRingMesh,

    uranusGroup,
    uranusMesh,
    uranusAtmoMesh,
    uranusRingMesh,

    neptuneMesh,
    neptuneAtmoMesh,

    orbitLinesGroup,
    asteroidBeltGroup,
    asteroids,
    nebulae,
    shootingStars,
    starField,

    labelElements,
    planetMeshes,

    disposables: {
      geos,
      asteroidGeos,
      textures,
      materials,
      orbitLineGeos,
      orbitLineMats,
    },
  };
}