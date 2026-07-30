import * as THREE from "three";

// ── Mercury: cratered gray surface ──
export function createMercuryTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#6b6b6b";
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = Math.random() * 4 + 0.5;
    const shade = 60 + Math.random() * 60;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 5}, ${Math.random() * 0.5 + 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = Math.random() * 8 + 3;
    ctx.strokeStyle = `rgba(140, 140, 140, 0.4)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(45, 45, 45, 0.3)`;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// ── Venus: thick sulfuric acid cloud bands ──
export function createVenusTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#c9a050");
  grad.addColorStop(0.3, "#e2bf72");
  grad.addColorStop(0.5, "#d4a85a");
  grad.addColorStop(0.7, "#e8c97e");
  grad.addColorStop(1, "#b8903f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 30; i++) {
    ctx.globalAlpha = Math.random() * 0.25 + 0.08;
    ctx.fillStyle = Math.random() > 0.5 ? "#f5e1b0" : "#a07830";
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.ellipse(256, y, Math.random() * 200 + 80, Math.random() * 8 + 2, (Math.random() - 0.5) * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

// ── Earth: realistic continents on blue ocean ──
export function createEarthTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
  oceanGrad.addColorStop(0, "#0a1628");
  oceanGrad.addColorStop(0.15, "#0c2854");
  oceanGrad.addColorStop(0.35, "#0e3a78");
  oceanGrad.addColorStop(0.5, "#104080");
  oceanGrad.addColorStop(0.65, "#0e3a78");
  oceanGrad.addColorStop(0.85, "#0c2854");
  oceanGrad.addColorStop(1, "#0a1628");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 512, 256);

  const drawContinent = (points: [number, number][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawContinent([
    [255,72],[270,68],[280,80],[285,95],[290,120],[285,145],[275,160],[260,170],[250,165],
    [242,150],[240,130],[235,110],[240,90],[248,78]
  ], "#1e6b3a");
  drawContinent([
    [240,50],[260,42],[280,40],[290,48],[285,60],[270,65],[255,68],[245,62],[238,55]
  ], "#2a7a45");
  drawContinent([
    [290,38],[320,30],[350,35],[380,42],[395,55],[400,72],[390,85],[370,80],[355,75],
    [340,82],[325,78],[310,70],[300,60],[290,52]
  ], "#257040");
  drawContinent([
    [325,82],[340,85],[338,105],[330,118],[320,110],[318,95]
  ], "#2d8048");
  drawContinent([[370,90],[385,88],[390,95],[380,100],[372,97]], "#2a7a45");
  drawContinent([[395,98],[410,95],[415,102],[405,108],[395,105]], "#257040");
  drawContinent([
    [385,140],[410,135],[425,140],[430,155],[425,165],[405,170],[390,162],[385,150]
  ], "#6b8a3a");
  drawContinent([
    [80,35],[110,28],[135,32],[150,40],[155,55],[145,70],[130,80],[115,85],
    [100,82],[85,75],[75,60],[72,45]
  ], "#2d7842");
  drawContinent([[130,82],[140,88],[138,98],[128,95],[125,88]], "#358a4d");
  drawContinent([
    [130,100],[145,105],[155,120],[158,140],[152,165],[140,180],[125,185],
    [115,175],[112,155],[118,135],[125,115]
  ], "#287538");
  drawContinent([
    [155,18],[175,15],[185,22],[180,32],[168,35],[158,28]
  ], "#e8e8e0");

  ctx.fillStyle = "#dfe8f0";
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillStyle = "#e0e8f0";
  ctx.fillRect(0, 246, 512, 10);

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#3498db";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ── Earth: roughness map for shiny oceans and matte land ──
export function createEarthRoughnessTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, 512, 256);

  const drawContinentRough = (points: [number, number][]) => {
    ctx.fillStyle = "#d0d0d0";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawContinentRough([
    [255,72],[270,68],[280,80],[285,95],[290,120],[285,145],[275,160],[260,170],[250,165],
    [242,150],[240,130],[235,110],[240,90],[248,78]
  ]);
  drawContinentRough([
    [240,50],[260,42],[280,40],[290,48],[285,60],[270,65],[255,68],[245,62],[238,55]
  ]);
  drawContinentRough([
    [290,38],[320,30],[350,35],[380,42],[395,55],[400,72],[390,85],[370,80],[355,75],
    [340,82],[325,78],[310,70],[300,60],[290,52]
  ]);
  drawContinentRough([
    [325,82],[340,85],[338,105],[330,118],[320,110],[318,95]
  ]);
  drawContinentRough([[370,90],[385,88],[390,95],[380,100],[372,97]]);
  drawContinentRough([[395,98],[410,95],[415,102],[405,108],[395,105]]);
  drawContinentRough([
    [385,140],[410,135],[425,140],[430,155],[425,165],[405,170],[390,162],[385,150]
  ]);
  drawContinentRough([
    [80,35],[110,28],[135,32],[150,40],[155,55],[145,70],[130,80],[115,85],
    [100,82],[85,75],[75,60],[72,45]
  ]);
  drawContinentRough([[130,82],[140,88],[138,98],[128,95],[125,88]]);
  drawContinentRough([
    [130,100],[145,105],[155,120],[158,140],[152,165],[140,180],[125,185],
    [115,175],[112,155],[118,135],[125,115]
  ]);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const glPoints: [number, number][] = [[155,18],[175,15],[185,22],[180,32],[168,35],[158,28]];
  ctx.moveTo(glPoints[0][0], glPoints[0][1]);
  for (let i = 1; i < glPoints.length; i++) {
    ctx.lineTo(glPoints[i][0], glPoints[i][1]);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillRect(0, 246, 512, 10);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ── Earth: realistic continents at night with city lights ──
export function createEarthNightTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#010309";
  ctx.fillRect(0, 0, 512, 256);

  const drawContinentNight = (points: [number, number][]) => {
    ctx.save();
    ctx.fillStyle = "#030612";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();

    ctx.clip();

    ctx.fillStyle = "rgba(255, 205, 75, 0.9)";

    let minX = 512, maxX = 0, minY = 256, maxY = 0;
    points.forEach(p => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    const density = Math.floor(area * 0.15);

    for (let j = 0; j < density; j++) {
      const px = minX + Math.random() * w;
      const py = minY + Math.random() * h;
      const size = Math.random() * 1.2 + 0.3;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255, 225, 140, 0.95)";
    const cities = Math.max(1, Math.floor(w / 35));
    for (let k = 0; k < cities; k++) {
      const cx = minX + Math.random() * w;
      const cy = minY + Math.random() * h;
      const count = Math.floor(Math.random() * 6) + 4;
      for (let m = 0; m < count; m++) {
        const px = cx + (Math.random() - 0.5) * 10;
        const py = cy + (Math.random() - 0.5) * 10;
        const size = Math.random() * 1.4 + 0.4;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  drawContinentNight([
    [255,72],[270,68],[280,80],[285,95],[290,120],[285,145],[275,160],[260,170],[250,165],
    [242,150],[240,130],[235,110],[240,90],[248,78]
  ]);
  drawContinentNight([
    [240,50],[260,42],[280,40],[290,48],[285,60],[270,65],[255,68],[245,62],[238,55]
  ]);
  drawContinentNight([
    [290,38],[320,30],[350,35],[380,42],[395,55],[400,72],[390,85],[370,80],[355,75],
    [340,82],[325,78],[310,70],[300,60],[290,52]
  ]);
  drawContinentNight([
    [325,82],[340,85],[338,105],[330,118],[320,110],[318,95]
  ]);
  drawContinentNight([[370,90],[385,88],[390,95],[380,100],[372,97]]);
  drawContinentNight([[395,98],[410,95],[415,102],[405,108],[395,105]]);
  drawContinentNight([
    [385,140],[410,135],[425,140],[430,155],[425,165],[405,170],[390,162],[385,150]
  ]);
  drawContinentNight([
    [80,35],[110,28],[135,32],[150,40],[155,55],[145,70],[130,80],[115,85],
    [100,82],[85,75],[75,60],[72,45]
  ]);
  drawContinentNight([[130,82],[140,88],[138,98],[128,95],[125,88]]);
  drawContinentNight([
    [130,100],[145,105],[155,120],[158,140],[152,165],[140,180],[125,185],
    [115,175],[112,155],[118,135],[125,115]
  ]);

  ctx.fillStyle = "#0a0f1d";
  ctx.beginPath();
  const glPoints: [number, number][] = [[155,18],[175,15],[185,22],[180,32],[168,35],[158,28]];
  ctx.moveTo(glPoints[0][0], glPoints[0][1]);
  for (let i = 1; i < glPoints.length; i++) {
    ctx.lineTo(glPoints[i][0], glPoints[i][1]);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0c101c";
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillRect(0, 246, 512, 10);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ── Mars/Mercury Bump Map: grayscale noise ──
export function createCraterBumpMap() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = Math.random() * 3.5 + 0.5;
    const shadow = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${shadow}, ${shadow}, ${shadow})`;
    ctx.globalAlpha = Math.random() * 0.12 + 0.03;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ── Earth Cloud Layer ──
export function createEarthCloudsTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.35 + 0.15})`;
    ctx.beginPath();
    const x = Math.random() * 512;
    const y = Math.random() * 180 + 38;
    const rx = Math.random() * 40 + 12;
    const ry = Math.random() * 6 + 1.5;
    ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.18 + 0.05})`;
      ctx.beginPath();
      ctx.ellipse(
        x + (Math.random() - 0.5) * rx * 1.5,
        y + (Math.random() - 0.5) * 8,
        rx * (Math.random() * 0.4 + 0.2),
        ry * (Math.random() * 0.5 + 0.3),
        (Math.random() - 0.5) * 0.3, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

// ── Mars: rust oxide with ice caps and canyons ──
export function createMarsTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#a04520");
  grad.addColorStop(0.3, "#c45525");
  grad.addColorStop(0.5, "#b84e22");
  grad.addColorStop(0.7, "#c45828");
  grad.addColorStop(1, "#8a3a18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(80, 30, 10, ${Math.random() * 0.35 + 0.12})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 180 + 38, Math.random() * 28 + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(60, 20, 5, 0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(180, 130);
  ctx.bezierCurveTo(220, 125, 280, 135, 340, 128);
  ctx.stroke();

  ctx.fillStyle = "rgba(160, 80, 40, 0.4)";
  ctx.beginPath();
  ctx.arc(140, 90, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(100, 50, 20, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#e8ddd0";
  ctx.beginPath();
  ctx.ellipse(256, 0, 120, 22, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = "#e0d5c5";
  ctx.beginPath();
  ctx.ellipse(256, 256, 80, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(c);
}

// ── Jupiter: smooth multi-band gas with Great Red Spot ──
export function createJupiterTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;

  const bands = [
    { y: 0, h: 18, c1: "#8a6535", c2: "#a07840" },
    { y: 18, h: 20, c1: "#d4a55a", c2: "#e8c07a" },
    { y: 38, h: 22, c1: "#c49048", c2: "#d0a058" },
    { y: 60, h: 18, c1: "#e8c880", c2: "#f0d898" },
    { y: 78, h: 25, c1: "#a87038", c2: "#c08848" },
    { y: 103, h: 20, c1: "#e0c078", c2: "#ecd090" },
    { y: 123, h: 22, c1: "#b87840", c2: "#d09050" },
    { y: 145, h: 25, c1: "#dbb868", c2: "#e8c878" },
    { y: 170, h: 20, c1: "#a87040", c2: "#c08850" },
    { y: 190, h: 25, c1: "#d8b060", c2: "#e0c070" },
    { y: 215, h: 20, c1: "#c09848", c2: "#d0a858" },
    { y: 235, h: 21, c1: "#8a6535", c2: "#987040" },
  ];

  bands.forEach(band => {
    const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
    grad.addColorStop(0, band.c1);
    grad.addColorStop(0.5, band.c2);
    grad.addColorStop(1, band.c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, band.y, 512, band.h);
  });

  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = Math.random() * 0.15 + 0.03;
    ctx.fillStyle = Math.random() > 0.5 ? "#f0d898" : "#906030";
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 512, Math.random() * 256,
      Math.random() * 25 + 5, Math.random() * 3 + 0.5,
      (Math.random() - 0.5) * 0.2, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const grsX = 320, grsY = 170;
  ctx.fillStyle = "rgba(150, 50, 25, 0.85)";
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, 28, 14, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(185, 65, 35, 0.9)";
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, 20, 10, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(210, 90, 50, 0.8)";
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, 10, 5, 0.08, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ── Saturn: subtle golden bands ──
export function createSaturnTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#c5a050");
  grad.addColorStop(0.2, "#dfc088");
  grad.addColorStop(0.4, "#c8a858");
  grad.addColorStop(0.5, "#e0c890");
  grad.addColorStop(0.6, "#d0b068");
  grad.addColorStop(0.8, "#dfc088");
  grad.addColorStop(1, "#b89048");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = Math.random() * 0.12 + 0.03;
    ctx.fillStyle = Math.random() > 0.5 ? "#f0e0b0" : "#a08040";
    ctx.fillRect(0, Math.random() * 256, 512, Math.random() * 10 + 2);
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

// ── Saturn Rings: realistic radial density profile ──
export function createSaturnRingsTexture() {
  const c = document.createElement("canvas");
  c.width = 2; c.height = 512;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < 512; y++) {
    const t = y / 512;
    let r = 200, g = 185, b = 160, a = 0;

    if (t < 0.08) {
      a = t / 0.08 * 0.08;
      r = 140; g = 130; b = 115;
    } else if (t < 0.15) {
      a = 0.25;
      r = 155; g = 145; b = 125;
    } else if (t < 0.42) {
      const bt = (t - 0.15) / 0.27;
      a = 0.7 + Math.sin(bt * Math.PI) * 0.25;
      r = 220 + Math.sin(bt * 6) * 10;
      g = 205 + Math.sin(bt * 6) * 10;
      b = 175 + Math.sin(bt * 6) * 8;
    } else if (t < 0.48) {
      a = 0.03;
    } else if (t < 0.72) {
      const at = (t - 0.48) / 0.24;
      a = 0.5 + Math.sin(at * Math.PI) * 0.2;
      r = 195; g = 180; b = 155;
      if (at > 0.72 && at < 0.78) a = 0.05;
    } else if (t < 0.78) {
      a = 0.02;
    } else if (t < 0.85) {
      const ft = (t - 0.78) / 0.07;
      a = Math.sin(ft * Math.PI) * 0.55;
      r = 210; g = 195; b = 170;
    } else {
      a = Math.max(0, (1 - t) / 0.15 * 0.05);
    }

    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
    ctx.fillRect(0, y, 2, 1);
  }
  return new THREE.CanvasTexture(c);
}

// ── Uranus: subtle cyan-green with faint banding ──
export function createUranusTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#6ecfcf");
  grad.addColorStop(0.3, "#7edcd8");
  grad.addColorStop(0.5, "#82e0db");
  grad.addColorStop(0.7, "#78d8d5");
  grad.addColorStop(1, "#65c5c5");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = Math.random() * 0.06 + 0.02;
    ctx.fillStyle = "#a0f0e8";
    ctx.fillRect(0, Math.random() * 128, 256, Math.random() * 6 + 1);
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

// ── Neptune: deep sapphire blue with methane clouds and Dark Spot ──
export function createNeptuneTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#0a1850");
  grad.addColorStop(0.25, "#122878");
  grad.addColorStop(0.5, "#1535a0");
  grad.addColorStop(0.75, "#122878");
  grad.addColorStop(1, "#0a1850");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 12; i++) {
    ctx.globalAlpha = Math.random() * 0.18 + 0.06;
    ctx.fillStyle = Math.random() > 0.4 ? "#5588cc" : "#88bbee";
    ctx.beginPath();
    ctx.ellipse(256, Math.random() * 200 + 28, Math.random() * 180 + 60, Math.random() * 3 + 0.8, (Math.random() - 0.5) * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(5, 12, 35, 0.8)";
  ctx.beginPath();
  ctx.ellipse(340, 108, 22, 12, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150, 200, 255, 0.6)";
  ctx.beginPath();
  ctx.ellipse(355, 95, 12, 3, -0.1, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(c);
}

// ── Nebula sprite texture ──
export function createNebulaTexture(r: number, g: number, b: number) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < 5; i++) {
    const cx = 64 + (Math.random() - 0.5) * 30;
    const cy = 64 + (Math.random() - 0.5) * 30;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + Math.random() * 20);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.2 + Math.random() * 0.15})`);
    grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${0.05 + Math.random() * 0.05})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}
