"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";

export default function Demo3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !containerRef.current || !hudRef.current) return;

    const container = containerRef.current;
    const hudContainer = hudRef.current;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    hudContainer.innerHTML = "";

    // ─── SCENE ───
    const scene = new THREE.Scene();

    // ─── CAMERA ───
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 350);
    camera.position.set(0, 0.3, -4.0);

    const isMobile = width < 768;
    const getSegs = (desktopSegs: number, mobileSegs: number) => isMobile ? mobileSegs : desktopSegs;

    // ─── RENDERER ───
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const solarSystemGroup = new THREE.Group();
    scene.add(solarSystemGroup);

    // Orbit lines group for visual tracks when planets orbit
    const orbitLinesGroup = new THREE.Group();
    solarSystemGroup.add(orbitLinesGroup);

    const orbitRadii = [8.0, 16.0, 24.0, 32.0, 44.0, 58.0, 72.0, 86.0];
    const orbitColors = [0x94a3b8, 0xeab308, 0x3b82f6, 0xef4444, 0xd97706, 0xfacc15, 0x22d3ee, 0x818cf8];

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
        depthWrite: false
      });
      const line = new THREE.Line(geo, mat);
      orbitLinesGroup.add(line);
    });

    // ─── LIGHTING ───
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xfff4e0, 4.0, 150, 0.4);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Rim light for dramatic planet silhouettes
    const rimLight = new THREE.DirectionalLight(0x4477aa, 0.3);
    rimLight.position.set(-5, 8, 12);
    scene.add(rimLight);

    // Camera-following headlight so planets facing us stay visible
    const headlight = new THREE.DirectionalLight(0xddeeff, 0.7);
    headlight.position.set(0, 0.5, -1);
    scene.add(headlight);

    // ═══════════════════════════════════════════
    // PROCEDURAL TEXTURE GENERATORS (High-Res)
    // ═══════════════════════════════════════════

    // ── Mercury: cratered gray surface ──
    const createMercuryTexture = () => {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 128;
      const ctx = c.getContext("2d")!;
      // Base gray
      ctx.fillStyle = "#6b6b6b";
      ctx.fillRect(0, 0, 256, 128);
      // Surface variation
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
      // Major craters (darker circles with lighter rims)
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
    };

    // ── Venus: thick sulfuric acid cloud bands ──
    const createVenusTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;
      // Base golden-orange
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#c9a050");
      grad.addColorStop(0.3, "#e2bf72");
      grad.addColorStop(0.5, "#d4a85a");
      grad.addColorStop(0.7, "#e8c97e");
      grad.addColorStop(1, "#b8903f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);
      // Cloud swirls
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
    };

    // ── Earth: realistic continents on blue ocean ──
    const createEarthTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;
      // Ocean gradient (deeper blues near poles)
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

      // Continents - drawn as approximate shapes
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

      // Africa
      drawContinent([
        [255,72],[270,68],[280,80],[285,95],[290,120],[285,145],[275,160],[260,170],[250,165],
        [242,150],[240,130],[235,110],[240,90],[248,78]
      ], "#1e6b3a");

      // Europe
      drawContinent([
        [240,50],[260,42],[280,40],[290,48],[285,60],[270,65],[255,68],[245,62],[238,55]
      ], "#2a7a45");

      // Asia (large mass)
      drawContinent([
        [290,38],[320,30],[350,35],[380,42],[395,55],[400,72],[390,85],[370,80],[355,75],
        [340,82],[325,78],[310,70],[300,60],[290,52]
      ], "#257040");

      // India
      drawContinent([
        [325,82],[340,85],[338,105],[330,118],[320,110],[318,95]
      ], "#2d8048");

      // Southeast Asia islands
      drawContinent([[370,90],[385,88],[390,95],[380,100],[372,97]], "#2a7a45");
      drawContinent([[395,98],[410,95],[415,102],[405,108],[395,105]], "#257040");

      // Australia
      drawContinent([
        [385,140],[410,135],[425,140],[430,155],[425,165],[405,170],[390,162],[385,150]
      ], "#6b8a3a");

      // North America
      drawContinent([
        [80,35],[110,28],[135,32],[150,40],[155,55],[145,70],[130,80],[115,85],
        [100,82],[85,75],[75,60],[72,45]
      ], "#2d7842");

      // Central America
      drawContinent([[130,82],[140,88],[138,98],[128,95],[125,88]], "#358a4d");

      // South America
      drawContinent([
        [130,100],[145,105],[155,120],[158,140],[152,165],[140,180],[125,185],
        [115,175],[112,155],[118,135],[125,115]
      ], "#287538");

      // Greenland
      drawContinent([
        [155,18],[175,15],[185,22],[180,32],[168,35],[158,28]
      ], "#e8e8e0");

      // Polar ice caps
      ctx.fillStyle = "#dfe8f0";
      ctx.fillRect(0, 0, 512, 10);
      ctx.fillStyle = "#e0e8f0";
      ctx.fillRect(0, 246, 512, 10);

      // Shallow water highlights near coasts
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 4;
      // Just add a subtle glow effect around continents
      ctx.globalAlpha = 1;

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      return tex;
    };

    // ── Earth: roughness map for shiny oceans and matte land ──
    const createEarthRoughnessTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;
      // Ocean is very glossy (low roughness)
      ctx.fillStyle = "#090909";
      ctx.fillRect(0, 0, 512, 256);

      const drawContinentRough = (points: [number, number][]) => {
        ctx.fillStyle = "#d0d0d0"; // land is rough
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.fill();
      };

      // Africa
      drawContinentRough([
        [255,72],[270,68],[280,80],[285,95],[290,120],[285,145],[275,160],[260,170],[250,165],
        [242,150],[240,130],[235,110],[240,90],[248,78]
      ]);

      // Europe
      drawContinentRough([
        [240,50],[260,42],[280,40],[290,48],[285,60],[270,65],[255,68],[245,62],[238,55]
      ]);

      // Asia
      drawContinentRough([
        [290,38],[320,30],[350,35],[380,42],[395,55],[400,72],[390,85],[370,80],[355,75],
        [340,82],[325,78],[310,70],[300,60],[290,52]
      ]);

      // India
      drawContinentRough([
        [325,82],[340,85],[338,105],[330,118],[320,110],[318,95]
      ]);

      // Southeast Asia islands
      drawContinentRough([[370,90],[385,88],[390,95],[380,100],[372,97]]);
      drawContinentRough([[395,98],[410,95],[415,102],[405,108],[395,105]]);

      // Australia
      drawContinentRough([
        [385,140],[410,135],[425,140],[430,155],[425,165],[405,170],[390,162],[385,150]
      ]);

      // North America
      drawContinentRough([
        [80,35],[110,28],[135,32],[150,40],[155,55],[145,70],[130,80],[115,85],
        [100,82],[85,75],[75,60],[72,45]
      ]);

      // Central America
      drawContinentRough([[130,82],[140,88],[138,98],[128,95],[125,88]]);

      // South America
      drawContinentRough([
        [130,100],[145,105],[155,120],[158,140],[152,165],[140,180],[125,185],
        [115,175],[112,155],[118,135],[125,115]
      ]);

      // Greenland
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const glPoints: [number, number][] = [[155,18],[175,15],[185,22],[180,32],[168,35],[158,28]];
      ctx.moveTo(glPoints[0][0], glPoints[0][1]);
      for (let i = 1; i < glPoints.length; i++) {
        ctx.lineTo(glPoints[i][0], glPoints[i][1]);
      }
      ctx.closePath();
      ctx.fill();

      // Polar ice caps (rough ice)
      ctx.fillStyle = "#e5e5e5";
      ctx.fillRect(0, 0, 512, 10);
      ctx.fillRect(0, 246, 512, 10);

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      return tex;
    };

    // ── Earth: realistic continents at night with city lights ──
    const createEarthNightTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;
      // Deep night ocean (very dark indigo-black)
      ctx.fillStyle = "#010309";
      ctx.fillRect(0, 0, 512, 256);

      const drawContinentNight = (points: [number, number][]) => {
        ctx.save();
        ctx.fillStyle = "#030612"; // very dark land
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.fill();

        // Clip to landmass to restrict city lights to land
        ctx.clip();

        // Draw glowing city light clusters (amber/gold dots)
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
          // Concentrate lights inside the landmass
          const px = minX + Math.random() * w;
          const py = minY + Math.random() * h;
          const size = Math.random() * 1.2 + 0.3;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Add extra dense clusters representing metropolitan areas
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

      // Africa
      drawContinentNight([
        [255,72],[270,68],[280,80],[285,95],[290,120],[285,145],[275,160],[260,170],[250,165],
        [242,150],[240,130],[235,110],[240,90],[248,78]
      ]);

      // Europe
      drawContinentNight([
        [240,50],[260,42],[280,40],[290,48],[285,60],[270,65],[255,68],[245,62],[238,55]
      ]);

      // Asia
      drawContinentNight([
        [290,38],[320,30],[350,35],[380,42],[395,55],[400,72],[390,85],[370,80],[355,75],
        [340,82],[325,78],[310,70],[300,60],[290,52]
      ]);

      // India
      drawContinentNight([
        [325,82],[340,85],[338,105],[330,118],[320,110],[318,95]
      ]);

      // Southeast Asia islands
      drawContinentNight([[370,90],[385,88],[390,95],[380,100],[372,97]]);
      drawContinentNight([[395,98],[410,95],[415,102],[405,108],[395,105]]);

      // Australia
      drawContinentNight([
        [385,140],[410,135],[425,140],[430,155],[425,165],[405,170],[390,162],[385,150]
      ]);

      // North America
      drawContinentNight([
        [80,35],[110,28],[135,32],[150,40],[155,55],[145,70],[130,80],[115,85],
        [100,82],[85,75],[75,60],[72,45]
      ]);

      // Central America
      drawContinentNight([[130,82],[140,88],[138,98],[128,95],[125,88]]);

      // South America
      drawContinentNight([
        [130,100],[145,105],[155,120],[158,140],[152,165],[140,180],[125,185],
        [115,175],[112,155],[118,135],[125,115]
      ]);

      // Greenland
      ctx.fillStyle = "#0a0f1d";
      ctx.beginPath();
      const glPoints: [number, number][] = [[155,18],[175,15],[185,22],[180,32],[168,35],[158,28]];
      ctx.moveTo(glPoints[0][0], glPoints[0][1]);
      for (let i = 1; i < glPoints.length; i++) {
        ctx.lineTo(glPoints[i][0], glPoints[i][1]);
      }
      ctx.closePath();
      ctx.fill();

      // Polar ice caps (faint dark blue reflection)
      ctx.fillStyle = "#0c101c";
      ctx.fillRect(0, 0, 512, 10);
      ctx.fillRect(0, 246, 512, 10);

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      return tex;
    };

    // ── Mars/Mercury Bump Map: grayscale noise ──
    const createCraterBumpMap = () => {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 128;
      const ctx = c.getContext("2d")!;
      // Base mid-gray
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 256, 128);
      // Generate craters
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
    };

    // ── Earth Cloud Layer ──
    const createEarthCloudsTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, 512, 256);
      // Organic cloud patterns
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.35 + 0.15})`;
        ctx.beginPath();
        const x = Math.random() * 512;
        const y = Math.random() * 180 + 38;
        const rx = Math.random() * 40 + 12;
        const ry = Math.random() * 6 + 1.5;
        ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Secondary smaller puffs around main cloud
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
    };

    // ── Mars: rust oxide with ice caps and canyons ──
    const createMarsTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;
      // Base rust gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#a04520");
      grad.addColorStop(0.3, "#c45525");
      grad.addColorStop(0.5, "#b84e22");
      grad.addColorStop(0.7, "#c45828");
      grad.addColorStop(1, "#8a3a18");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Dark volcanic highlands
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(80, 30, 10, ${Math.random() * 0.35 + 0.12})`;
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 180 + 38, Math.random() * 28 + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Valles Marineris (canyon system near equator)
      ctx.strokeStyle = "rgba(60, 20, 5, 0.5)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(180, 130);
      ctx.bezierCurveTo(220, 125, 280, 135, 340, 128);
      ctx.stroke();

      // Olympus Mons (large circular feature)
      ctx.fillStyle = "rgba(160, 80, 40, 0.4)";
      ctx.beginPath();
      ctx.arc(140, 90, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 50, 20, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // North polar ice cap
      ctx.fillStyle = "#e8ddd0";
      ctx.beginPath();
      ctx.ellipse(256, 0, 120, 22, 0, 0, Math.PI);
      ctx.fill();

      // South polar ice cap (smaller)
      ctx.fillStyle = "#e0d5c5";
      ctx.beginPath();
      ctx.ellipse(256, 256, 80, 16, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      return new THREE.CanvasTexture(c);
    };

    // ── Jupiter: smooth multi-band gas with Great Red Spot ──
    const createJupiterTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d")!;

      // Draw horizontal bands with smooth gradient transitions
      const bands = [
        { y: 0, h: 18, c1: "#8a6535", c2: "#a07840" },     // North polar
        { y: 18, h: 20, c1: "#d4a55a", c2: "#e8c07a" },    // NTB
        { y: 38, h: 22, c1: "#c49048", c2: "#d0a058" },
        { y: 60, h: 18, c1: "#e8c880", c2: "#f0d898" },    // NEB
        { y: 78, h: 25, c1: "#a87038", c2: "#c08848" },     // dark equatorial
        { y: 103, h: 20, c1: "#e0c078", c2: "#ecd090" },
        { y: 123, h: 22, c1: "#b87840", c2: "#d09050" },    // SEB
        { y: 145, h: 25, c1: "#dbb868", c2: "#e8c878" },
        { y: 170, h: 20, c1: "#a87040", c2: "#c08850" },    // STB
        { y: 190, h: 25, c1: "#d8b060", c2: "#e0c070" },
        { y: 215, h: 20, c1: "#c09848", c2: "#d0a858" },
        { y: 235, h: 21, c1: "#8a6535", c2: "#987040" },    // South polar
      ];

      bands.forEach(band => {
        const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
        grad.addColorStop(0, band.c1);
        grad.addColorStop(0.5, band.c2);
        grad.addColorStop(1, band.c1);
        ctx.fillStyle = grad;
        ctx.fillRect(0, band.y, 512, band.h);
      });

      // Turbulent swirl details
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

      // Great Red Spot (Southern hemisphere, multi-layered)
      const grsX = 320, grsY = 170;
      // Outer rim
      ctx.fillStyle = "rgba(150, 50, 25, 0.85)";
      ctx.beginPath();
      ctx.ellipse(grsX, grsY, 28, 14, 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Middle layer
      ctx.fillStyle = "rgba(185, 65, 35, 0.9)";
      ctx.beginPath();
      ctx.ellipse(grsX, grsY, 20, 10, 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Inner eye
      ctx.fillStyle = "rgba(210, 90, 50, 0.8)";
      ctx.beginPath();
      ctx.ellipse(grsX, grsY, 10, 5, 0.08, 0, Math.PI * 2);
      ctx.fill();

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      return tex;
    };

    // ── Saturn: subtle golden bands ──
    const createSaturnTexture = () => {
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
      // Subtle bands
      for (let i = 0; i < 16; i++) {
        ctx.globalAlpha = Math.random() * 0.12 + 0.03;
        ctx.fillStyle = Math.random() > 0.5 ? "#f0e0b0" : "#a08040";
        ctx.fillRect(0, Math.random() * 256, 512, Math.random() * 10 + 2);
      }
      ctx.globalAlpha = 1;
      return new THREE.CanvasTexture(c);
    };

    // ── Saturn Rings: realistic radial density profile ──
    const createSaturnRingsTexture = () => {
      const c = document.createElement("canvas");
      c.width = 2; c.height = 512;
      const ctx = c.getContext("2d")!;
      for (let y = 0; y < 512; y++) {
        const t = y / 512;
        let r = 200, g = 185, b = 160, a = 0;

        if (t < 0.08) {
          // D Ring (very faint inner)
          a = t / 0.08 * 0.08;
          r = 140; g = 130; b = 115;
        } else if (t < 0.15) {
          // C Ring (faint)
          a = 0.25;
          r = 155; g = 145; b = 125;
        } else if (t < 0.42) {
          // B Ring (brightest, most dense)
          const bt = (t - 0.15) / 0.27;
          a = 0.7 + Math.sin(bt * Math.PI) * 0.25;
          r = 220 + Math.sin(bt * 6) * 10;
          g = 205 + Math.sin(bt * 6) * 10;
          b = 175 + Math.sin(bt * 6) * 8;
        } else if (t < 0.48) {
          // Cassini Division (gap)
          a = 0.03;
        } else if (t < 0.72) {
          // A Ring (medium density)
          const at = (t - 0.48) / 0.24;
          a = 0.5 + Math.sin(at * Math.PI) * 0.2;
          r = 195; g = 180; b = 155;
          // Encke Gap
          if (at > 0.72 && at < 0.78) a = 0.05;
        } else if (t < 0.78) {
          // Roche Division
          a = 0.02;
        } else if (t < 0.85) {
          // F Ring (thin, bright)
          const ft = (t - 0.78) / 0.07;
          a = Math.sin(ft * Math.PI) * 0.55;
          r = 210; g = 195; b = 170;
        } else {
          // Beyond rings
          a = Math.max(0, (1 - t) / 0.15 * 0.05);
        }

        ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
        ctx.fillRect(0, y, 2, 1);
      }
      return new THREE.CanvasTexture(c);
    };

    // ── Uranus: subtle cyan-green with faint banding ──
    const createUranusTexture = () => {
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
    };

    // ── Neptune: deep sapphire blue with methane clouds and Dark Spot ──
    const createNeptuneTexture = () => {
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

      // Methane cloud bands
      for (let i = 0; i < 12; i++) {
        ctx.globalAlpha = Math.random() * 0.18 + 0.06;
        ctx.fillStyle = Math.random() > 0.4 ? "#5588cc" : "#88bbee";
        ctx.beginPath();
        ctx.ellipse(256, Math.random() * 200 + 28, Math.random() * 180 + 60, Math.random() * 3 + 0.8, (Math.random() - 0.5) * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Great Dark Spot
      ctx.fillStyle = "rgba(5, 12, 35, 0.8)";
      ctx.beginPath();
      ctx.ellipse(340, 108, 22, 12, 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Bright companion cloud
      ctx.fillStyle = "rgba(150, 200, 255, 0.6)";
      ctx.beginPath();
      ctx.ellipse(355, 95, 12, 3, -0.1, 0, Math.PI * 2);
      ctx.fill();

      return new THREE.CanvasTexture(c);
    };

    // ── Nebula sprite texture ──
    const createNebulaTexture = (r: number, g: number, b: number) => {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 128;
      const ctx = c.getContext("2d")!;
      // Multiple overlapping gradients for organic look
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
    };

    // ═══════════════════════════════════════
    // ATMOSPHERE GLOW SHADER (Fresnel Rim + Day Mask)
    // ═══════════════════════════════════════
    const createAtmosphereMaterial = (color: THREE.Color, intensity: number) => {
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
            
            // Mask glow on the day-side facing the Sun
            float daySide = dot(normal, normalize(uSunViewDir));
            float dayFactor = smoothstep(-0.25, 0.35, daySide);
            
            // Sunset transition blend at the terminator (peaks when daySide is near 0.0)
            float sunsetFactor = smoothstep(0.35, -0.1, daySide) * smoothstep(-0.25, 0.05, daySide);
            vec3 sunsetColor = vec3(1.0, 0.42, 0.12); // glowing orange-red
            vec3 finalGlowColor = mix(uGlowColor, sunsetColor, sunsetFactor * 0.9);
            
            gl_FragColor = vec4(finalGlowColor, fresnel * dayFactor);
          }
        `,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    };

    // ═══════════════════════════════════════
    // SUN PLASMA SHADER
    // ═══════════════════════════════════════
    const sunShaderMat = new THREE.ShaderMaterial({
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
          // Hot core white-yellow highlights
          vec3 hot = vec3(1.0, 0.95, 0.8);
          vec3 finalColor = mix(base, hot, fresnel * 0.9 + vNoise * 0.15);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    // ═══════════════════════════════════════
    // MATERIALS
    // ═══════════════════════════════════════
    const mercuryTex = createMercuryTexture();
    const mercuryBumpTex = createCraterBumpMap();
    const mercuryMat = new THREE.MeshStandardMaterial({ 
      map: mercuryTex, 
      bumpMap: mercuryBumpTex, 
      bumpScale: 0.008, 
      roughness: 0.9, 
      metalness: 0.1 
    });

    const venusTex = createVenusTexture();
    const venusMat = new THREE.MeshStandardMaterial({ map: venusTex, roughness: 0.92 });

    const earthDayTex = createEarthTexture();
    const earthNightTex = createEarthNightTexture();
    const earthRoughnessTex = createEarthRoughnessTexture();
    const earthMat = new THREE.MeshStandardMaterial({ 
      map: earthDayTex, 
      roughnessMap: earthRoughnessTex,
      metalness: 0.1 
    });

    // Custom shader compilation for Earth day/night blending
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
        
        // Calculate lighting dot product based on normal and Sun direction in view space
        float dayFactor = dot(normalize(vNormal), normalize(uSunViewDir));
        float blend = smoothstep(-0.15, 0.15, dayFactor);
        
        vec4 texelColor = mix(nightColor, dayColor, blend);
        `
      );
    };

    const marsTex = createMarsTexture();
    const marsBumpTex = createCraterBumpMap();
    const marsMat = new THREE.MeshStandardMaterial({ 
      map: marsTex, 
      bumpMap: marsBumpTex, 
      bumpScale: 0.015, 
      roughness: 0.85 
    });

    const jupiterTex = createJupiterTexture();
    const jupiterMat = new THREE.MeshStandardMaterial({ map: jupiterTex, roughness: 0.42 });
    jupiterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      jupiterMat.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        // Slide bands in alternating horizontal directions based on latitude
        float latitude = sin(uv.y * 3.14159 * 8.0);
        vMapUv.x += uTime * latitude * 0.012;
        vMapUv.x += sin(uv.y * 45.0 + uTime * 0.08) * 0.0015; // fine wind turbulence
        `
      );
    };

    const saturnTex = createSaturnTexture();
    const saturnMat = new THREE.MeshStandardMaterial({ map: saturnTex, roughness: 0.52 });
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
        `
      );
    };

    const saturnRingsTex = createSaturnRingsTexture();
    const saturnRingMat = new THREE.MeshStandardMaterial({
      map: saturnRingsTex, side: THREE.DoubleSide,
      transparent: true, opacity: 0.95, roughness: 0.4, metalness: 0.6,
    });

    const uranusTex = createUranusTexture();
    const uranusMat = new THREE.MeshStandardMaterial({ map: uranusTex, roughness: 0.38, metalness: 0.08 });

    const neptuneTex = createNeptuneTexture();
    const neptuneMat = new THREE.MeshStandardMaterial({ map: neptuneTex, roughness: 0.45 });

    // Atmosphere materials
    const earthAtmoMat = createAtmosphereMaterial(new THREE.Color(0x4488ff), 1.6);
    const venusAtmoMat = createAtmosphereMaterial(new THREE.Color(0xddaa44), 1.2);
    const neptuneAtmoMat = createAtmosphereMaterial(new THREE.Color(0x3355cc), 1.4);
    const uranusAtmoMat = createAtmosphereMaterial(new THREE.Color(0x55cccc), 1.1);

    // ═══════════════════════════════════════
    // WAYPOINTS
    // ═══════════════════════════════════════
    const planetWaypoints = [
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

    const cameraWaypoints = isMobile ? [
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
    ] : [
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

    // ═══════════════════════════════════════
    // MESH INSTANCES
    // ═══════════════════════════════════════

    // ── Sun ──
    const sunGeo = new THREE.SphereGeometry(1.5, getSegs(48, 24), getSegs(48, 24));
    const sunMesh = new THREE.Mesh(sunGeo, sunShaderMat);
    sunMesh.position.copy(planetWaypoints[1].pos);
    solarSystemGroup.add(sunMesh);

    // Sun Corona Glow (additive sprite)
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
    const coronaMat = new THREE.SpriteMaterial({
      map: coronaTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const coronaSprite = new THREE.Sprite(coronaMat);
    coronaSprite.scale.set(6, 6, 1);
    coronaSprite.position.copy(planetWaypoints[1].pos);
    solarSystemGroup.add(coronaSprite);

    // ── Mercury ──
    const mercuryGeo = new THREE.SphereGeometry(0.32, getSegs(24, 12), getSegs(24, 12));
    const mercuryMesh = new THREE.Mesh(mercuryGeo, mercuryMat);
    mercuryMesh.position.copy(planetWaypoints[2].pos);
    mercuryMesh.castShadow = !isMobile;
    solarSystemGroup.add(mercuryMesh);

    // ── Venus + atmosphere ──
    const venusGeo = new THREE.SphereGeometry(0.48, getSegs(24, 12), getSegs(24, 12));
    const venusMesh = new THREE.Mesh(venusGeo, venusMat);
    venusMesh.position.copy(planetWaypoints[3].pos);
    venusMesh.castShadow = !isMobile;
    solarSystemGroup.add(venusMesh);
    const venusAtmoGeo = new THREE.SphereGeometry(0.53, getSegs(24, 12), getSegs(24, 12));
    const venusAtmoMesh = new THREE.Mesh(venusAtmoGeo, venusAtmoMat);
    venusAtmoMesh.position.copy(planetWaypoints[3].pos);
    solarSystemGroup.add(venusAtmoMesh);

    // ── Earth + clouds + atmosphere + Moon ──
    const earthGroup = new THREE.Group();
    earthGroup.position.copy(planetWaypoints[4].pos);

    const earthGeo = new THREE.SphereGeometry(0.52, getSegs(32, 16), getSegs(32, 16));
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.castShadow = !isMobile;
    earthGroup.add(earthMesh);

    const earthCloudsTex = createEarthCloudsTexture();
    const earthCloudsGeo = new THREE.SphereGeometry(0.535, getSegs(32, 16), getSegs(32, 16));
    const earthCloudsMat = new THREE.MeshStandardMaterial({
      map: earthCloudsTex, transparent: true, opacity: 0.82, depthWrite: false,
    });
    const earthCloudsMesh = new THREE.Mesh(earthCloudsGeo, earthCloudsMat);
    earthGroup.add(earthCloudsMesh);

    const earthAtmoGeo = new THREE.SphereGeometry(0.58, getSegs(32, 16), getSegs(32, 16));
    const earthAtmoMesh = new THREE.Mesh(earthAtmoGeo, earthAtmoMat);
    earthGroup.add(earthAtmoMesh);

    // Moon orbiting Earth
    const moonOrbitGroup = new THREE.Group();
    earthGroup.add(moonOrbitGroup);
    const moonGeo = new THREE.SphereGeometry(0.07, getSegs(16, 8), getSegs(16, 8));
    const moonMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.92 });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(0.95, 0, 0);
    moonMesh.castShadow = !isMobile;
    moonOrbitGroup.add(moonMesh);

    solarSystemGroup.add(earthGroup);

    // ── Mars ──
    const marsGeo = new THREE.SphereGeometry(0.42, getSegs(24, 12), getSegs(24, 12));
    const marsMesh = new THREE.Mesh(marsGeo, marsMat);
    marsMesh.position.copy(planetWaypoints[5].pos);
    marsMesh.castShadow = !isMobile;
    solarSystemGroup.add(marsMesh);

    // ── Jupiter ──
    const jupiterGeo = new THREE.SphereGeometry(1.1, getSegs(48, 24), getSegs(48, 24));
    const jupiterMesh = new THREE.Mesh(jupiterGeo, jupiterMat);
    jupiterMesh.position.copy(planetWaypoints[6].pos);
    jupiterMesh.castShadow = !isMobile;
    solarSystemGroup.add(jupiterMesh);

    // ── Saturn + rings ──
    const saturnGroup = new THREE.Group();
    saturnGroup.position.copy(planetWaypoints[7].pos);
    const saturnGeo = new THREE.SphereGeometry(0.82, getSegs(32, 16), getSegs(32, 16));
    const saturnMesh = new THREE.Mesh(saturnGeo, saturnMat);
    saturnMesh.castShadow = !isMobile;
    saturnMesh.receiveShadow = !isMobile; // receive shadow from rings
    saturnGroup.add(saturnMesh);
    const saturnRingGeo = new THREE.RingGeometry(0.82 * 1.3, 0.82 * 2.5, getSegs(96, 48));
    const saturnRingMesh = new THREE.Mesh(saturnRingGeo, saturnRingMat);
    saturnRingMesh.rotation.x = Math.PI / 2.3;
    saturnRingMesh.castShadow = !isMobile;
    saturnRingMesh.receiveShadow = !isMobile; // receive shadow from planet
    saturnGroup.add(saturnRingMesh);
    solarSystemGroup.add(saturnGroup);

    // ── Uranus + atmosphere + ring ──
    const uranusGroup = new THREE.Group();
    uranusGroup.position.copy(planetWaypoints[8].pos);
    const uranusGeo = new THREE.SphereGeometry(0.65, getSegs(32, 16), getSegs(32, 16));
    const uranusMesh = new THREE.Mesh(uranusGeo, uranusMat);
    uranusMesh.castShadow = !isMobile;
    uranusGroup.add(uranusMesh);
    const uranusAtmoGeo = new THREE.SphereGeometry(0.72, getSegs(32, 16), getSegs(32, 16));
    const uranusAtmoMesh = new THREE.Mesh(uranusAtmoGeo, uranusAtmoMat);
    uranusGroup.add(uranusAtmoMesh);
    const uranusRingGeo = new THREE.RingGeometry(0.82, 0.88, getSegs(48, 24));
    const uranusRingMesh = new THREE.Mesh(uranusRingGeo, new THREE.MeshStandardMaterial({
      color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.3
    }));
    uranusRingMesh.rotation.y = Math.PI / 6;
    uranusRingMesh.rotation.x = Math.PI / 2;
    uranusGroup.add(uranusRingMesh);
    solarSystemGroup.add(uranusGroup);

    // ── Neptune + atmosphere ──
    const neptuneGeo = new THREE.SphereGeometry(0.62, getSegs(32, 16), getSegs(32, 16));
    const neptuneMesh = new THREE.Mesh(neptuneGeo, neptuneMat);
    neptuneMesh.position.copy(planetWaypoints[9].pos);
    neptuneMesh.castShadow = !isMobile;
    solarSystemGroup.add(neptuneMesh);
    const neptuneAtmoGeo = new THREE.SphereGeometry(0.68, getSegs(32, 16), getSegs(32, 16));
    const neptuneAtmoMesh = new THREE.Mesh(neptuneAtmoGeo, neptuneAtmoMat);
    neptuneAtmoMesh.position.copy(planetWaypoints[9].pos);
    solarSystemGroup.add(neptuneAtmoMesh);

    // ═══════════════════════════════════════
    // ASTEROID BELT
    // ═══════════════════════════════════════
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
    const beltCenter = new THREE.Vector3(0.75, 0.25, -38.0);

    for (let i = 0; i < asteroidCount; i++) {
      const geo = asteroidGeos[Math.floor(Math.random() * asteroidGeos.length)];
      const ast = new THREE.Mesh(geo, asteroidMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 4.2 + 0.5;
      ast.position.set(
        beltCenter.x + Math.cos(angle) * radius,
        beltCenter.y + Math.sin(angle) * radius,
        beltCenter.z + (Math.random() - 0.5) * 6
      );
      ast.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const s = Math.random() * 0.8 + 0.2;
      ast.scale.set(s, s * (0.6 + Math.random() * 0.8), s); // irregular
      asteroidBeltGroup.add(ast);
      asteroids.push(ast);
    }

    // ═══════════════════════════════════════
    // NEBULAE (space dust clouds)
    // ═══════════════════════════════════════
    const nebulaConfigs = [
      { r: 120, g: 45, b: 180, x: -4, y: 2, z: -12, scale: 16 },
      { r: 180, g: 35, b: 100, x: 5, y: -1, z: -38, scale: 22 },
      { r: 40, g: 90, b: 200, x: -3, y: 1.5, z: -65, scale: 20 },
      { r: 60, g: 140, b: 180, x: 4, y: -2, z: -80, scale: 18 },
    ];
    const nebulae: THREE.Sprite[] = [];
    (isMobile ? nebulaConfigs.slice(0, 2) : nebulaConfigs).forEach(nc => {
      const tex = createNebulaTexture(nc.r, nc.g, nc.b);
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(nc.x, nc.y, nc.z);
      sprite.scale.set(nc.scale, nc.scale, 1);
      scene.add(sprite);
      nebulae.push(sprite);
    });

    // ═══════════════════════════════════════
    // SHOOTING STARS
    // ═══════════════════════════════════════
    const shootingStarCount = isMobile ? 0 : 4;
    const shootingStars: { mesh: THREE.Line; speed: number; active: boolean; delay: number }[] = [];
    for (let i = 0; i < shootingStarCount; i++) {
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.5, -0.7, 0.4)];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      const mesh = new THREE.Line(geo, mat);
      scene.add(mesh);
      shootingStars.push({ mesh, speed: Math.random() * 0.3 + 0.2, active: false, delay: Math.random() * 4 });
    }

    // ═══════════════════════════════════════
    // STARFIELD (color-varied, size-varied)
    // ═══════════════════════════════════════
    const starCount = isMobile ? 150 : 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const starPalette = [
      [0.7, 0.8, 1.0],   // Blue-white (hot)
      [1.0, 1.0, 1.0],   // Pure white
      [1.0, 0.95, 0.85],  // Yellow-white (Sun-like)
      [1.0, 0.85, 0.6],   // Orange (K-type)
      [1.0, 0.7, 0.5],    // Red giant tint
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
    // Star dot texture
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

    // Twinkling Star shader material
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
          
          // Generate individual twinkle using position hash
          float hash = sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453;
          vTwinkle = sin(uTime * 2.5 + hash) * 0.35 + 0.65; // oscillates between 0.3 and 1.0
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * vTwinkle * (350.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          // Circular soft star point
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;
          
          // Soft edge fade
          float alpha = smoothstep(0.5, 0.05, dist) * vTwinkle;
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ═══════════════════════════════════════
    // HUD LABELS (Screen-projected)
    // ═══════════════════════════════════════
    const labelData = [
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

    const planetMeshes = [
      solarSystemGroup, // Index 0: Overview (Tata Surya)
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

    // ═══════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════
    let scrollPercent = 0;
    let targetScrollPercent = 0;
    const scrollContainer = document.getElementById("public-scroll-container");
    const handleScroll = () => {
      if (!scrollContainer) return;
      targetScrollPercent = scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight || 1);
    };
    if (scrollContainer) scrollContainer.addEventListener("scroll", handleScroll);

    let mouseX = 0, mouseY = 0, targetMX = 0, targetMY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const clock = new THREE.Clock();
    const tempV = new THREE.Vector3();
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const getOrbitalPosition = (index: number, elapsed: number) => {
      const speeds = [
        0,       // index 0 (Overview)
        0,       // index 1 (Sun)
        0.8,     // index 2 (Mercury)
        0.5,     // index 3 (Venus)
        0.35,    // index 4 (Earth)
        0.25,    // index 5 (Mars)
        0.12,    // index 6 (Jupiter)
        0.08,    // index 7 (Saturn)
        0.04,    // index 8 (Uranus)
        0.02     // index 9 (Neptune)
      ];
      const offsets = [
        0,
        0,   // Sun
        0.0, // Mercury
        1.2, // Venus
        2.5, // Earth
        3.8, // Mars
        0.7, // Jupiter
        4.5, // Saturn
        2.0, // Uranus
        5.1  // Neptune
      ];

      const R = Math.abs(planetWaypoints[index].pos.z);
      const speed = speeds[index] || 0;
      const offset = offsets[index] || 0;

      const angle = elapsed * speed + offset;
      return new THREE.Vector3(
        Math.cos(angle) * R,
        planetWaypoints[index].pos.y,
        Math.sin(angle) * R
      );
    };

    const getStageFromScroll = (s: number) => {
      return s * 9.0;
    };

    const animateLoop = () => {
      const elapsed = clock.getElapsedTime();

      scrollPercent = lerp(scrollPercent, targetScrollPercent, 0.07);
      targetMX = lerp(targetMX, mouseX, 0.04);
      targetMY = lerp(targetMY, mouseY, 0.04);

      sunShaderMat.uniforms.uTime.value = elapsed;

      // Update shader uniforms for Sun position and animations
      const tempSunWorldDir = new THREE.Vector3().copy(planetWaypoints[4].pos).negate().normalize();
      const sunViewDir = tempSunWorldDir.clone().transformDirection(camera.matrixWorldInverse);
      if (earthMat.userData.shader) {
        earthMat.userData.shader.uniforms.uSunViewDir.value.copy(sunViewDir);
      }
      earthAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);
      venusAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);
      uranusAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);
      neptuneAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);

      if (jupiterMat.userData.shader) {
        jupiterMat.userData.shader.uniforms.uTime.value = elapsed;
      }
      if (saturnMat.userData.shader) {
        saturnMat.userData.shader.uniforms.uTime.value = elapsed;
      }

      // Camera interpolation
      const totalStages = cameraWaypoints.length - 1;
      const stage = getStageFromScroll(scrollPercent);
      const idx = Math.min(Math.floor(stage), totalStages - 1);
      const t = stage - idx;

      // Smooth step easing for organic transitions at resting points
      const easedT = t * t * (3 - 2 * t);

      const camTarget = new THREE.Vector3();
      if (idx === 0) {
        // Quadratic Bezier curve for a majestic, sweeping camera swoop down to the Sun
        const p0 = cameraWaypoints[0];
        // Control point: arcing down and forward towards the Sun
        const p1 = new THREE.Vector3(0.0, 35.0, 20.0);
        const p2 = cameraWaypoints[1];
        
        const mt = 1 - easedT;
        camTarget.set(
          mt * mt * p0.x + 2 * mt * easedT * p1.x + easedT * easedT * p2.x,
          mt * mt * p0.y + 2 * mt * easedT * p1.y + easedT * easedT * p2.y,
          mt * mt * p0.z + 2 * mt * easedT * p1.z + easedT * easedT * p2.z
        );
      } else {
        camTarget.lerpVectors(cameraWaypoints[idx], cameraWaypoints[idx + 1], easedT);
      }
      
      // Responsive layout calculation:
      // On mobile/portrait (aspect <= 0.8), keep the focus centered (targetX = 0).
      // On desktop/landscape (aspect >= 1.5), shift focus to the right (targetX = 0.52).
      // Smoothly interpolate between them for intermediate aspect ratios.
      const aspect = height > 0 ? width / height : 1.0;
      let targetX = 0.0;
      if (aspect > 0.8) {
        const factor = Math.min(1.0, (aspect - 0.8) / 0.7);
        targetX = factor * 0.52;
      }

      // Calculate camera distance to the default focused target
      const lookTargetDefault = new THREE.Vector3().lerpVectors(planetWaypoints[idx].pos, planetWaypoints[idx + 1].pos, t);
      const D = camTarget.distanceTo(lookTargetDefault);

      // Frustum half-width at distance D (using camera FOV of 45 deg)
      const frustumHalfWidth = D * 0.41421 * aspect;

      // Determine lookTarget X offset to shift planets to the right.
      // During flight stages (idx >= 1), the camera is looking in the positive Z direction,
      // where the local coordinate system of the camera is flipped: +X is screen-left, -X is screen-right.
      // To shift the planets to the right side of the screen, we must shift the look target to the positive X (left in camera space).
      // During overview stage (idx === 0), the camera is looking in the negative Z direction (+X is screen-right, -X is screen-left),
      // so the offset must be negative to shift the system right.
      let xOffset = targetX * frustumHalfWidth;
      let camCorrection = 0.3;

      if (idx === 0) {
        // Blend smoothly from a negative overview offset (-40.0) to the positive flight offset
        const overviewOffset = -40.0;
        xOffset = lerp(overviewOffset, targetX * frustumHalfWidth, t);
        camCorrection = lerp(-0.3, 0.3, t);
      }

      // Shift camera by xOffset + camCorrection to keep planets on the right side of the screen
      camera.position.x = camTarget.x + xOffset + camCorrection + targetMX * 0.3;
      camera.position.y = camTarget.y + targetMY * 0.3;
      camera.position.z = camTarget.z;

      const lookTarget = lookTargetDefault.clone();
      lookTarget.x += xOffset;
      if (isMobile) {
        // Shift planet up on mobile screens by pointing camera slightly down
        lookTarget.y -= 0.65;
      }

      camera.lookAt(lookTarget);

      // Make headlight follow camera direction
      headlight.position.copy(camera.position);
      headlight.position.z -= 2;

      // Rotations
      mercuryMesh.rotation.y = elapsed * 0.1;
      venusMesh.rotation.y = -elapsed * 0.04; // retrograde
      earthMesh.rotation.y = elapsed * 0.15;
      earthCloudsMesh.rotation.y = elapsed * 0.2;
      moonOrbitGroup.rotation.y = elapsed * 0.4;
      marsMesh.rotation.y = elapsed * 0.12;
      jupiterMesh.rotation.y = elapsed * 0.25;
      saturnMesh.rotation.y = elapsed * 0.2;
      saturnRingMesh.rotation.z = -elapsed * 0.03;
      uranusMesh.rotation.y = elapsed * 0.1;
      neptuneMesh.rotation.y = elapsed * 0.08;

      // Orbit blending at the very beginning of scroll (stage 0 to 1)
      const blendToOrbit = idx === 0 ? (1.0 - easedT) : 0.0;

      const getTargetPos = (i: number, originalPos: THREE.Vector3) => {
        if (blendToOrbit <= 0.0) return originalPos;
        const orbPos = getOrbitalPosition(i, elapsed);
        return new THREE.Vector3().lerpVectors(originalPos, orbPos, blendToOrbit);
      };

      mercuryMesh.position.copy(getTargetPos(2, planetWaypoints[2].pos));
      
      const venusPos = getTargetPos(3, planetWaypoints[3].pos);
      venusMesh.position.copy(venusPos);
      venusAtmoMesh.position.copy(venusPos);

      earthGroup.position.copy(getTargetPos(4, planetWaypoints[4].pos));

      marsMesh.position.copy(getTargetPos(5, planetWaypoints[5].pos));

      jupiterMesh.position.copy(getTargetPos(6, planetWaypoints[6].pos));

      saturnGroup.position.copy(getTargetPos(7, planetWaypoints[7].pos));

      uranusGroup.position.copy(getTargetPos(8, planetWaypoints[8].pos));

      const neptunePos = getTargetPos(9, planetWaypoints[9].pos);
      neptuneMesh.position.copy(neptunePos);
      neptuneAtmoMesh.position.copy(neptunePos);

      // Faintly fade in the orbit lines as we blend to orbit mode
      orbitLinesGroup.children.forEach((child) => {
        const line = child as THREE.Line;
        (line.material as THREE.LineBasicMaterial).opacity = 0.15 * blendToOrbit;
      });

      // Sun corona gentle pulse
      const coronaPulse = 5.8 + Math.sin(elapsed * 0.8) * 0.4;
      coronaSprite.scale.set(coronaPulse, coronaPulse, 1);

      // Asteroid drift
      asteroids.forEach((a) => { a.rotation.x += 0.002; a.rotation.y += 0.003; });
      asteroidBeltGroup.rotation.z = elapsed * 0.005;

      starField.rotation.y = elapsed * 0.003;
      if (starMat.uniforms && starMat.uniforms.uTime) {
        starMat.uniforms.uTime.value = elapsed;
      }
      
      // Nebulae rotating drift
      nebulae.forEach((n, i) => {
        n.rotation.z = elapsed * 0.012 * (i % 2 === 0 ? 1 : -1);
      });

      // Shooting stars
      shootingStars.forEach((s) => {
        if (!s.active) {
          s.delay -= 0.016;
          if (s.delay <= 0) {
            s.active = true;
            s.mesh.position.set(
              camera.position.x + (Math.random() - 0.5) * 25,
              camera.position.y + (Math.random() - 0.5) * 18,
              camera.position.z - (Math.random() * 30 + 5)
            );
            (s.mesh.material as THREE.LineBasicMaterial).opacity = 0.9;
          }
        } else {
          s.mesh.position.x += s.speed * 2.5;
          s.mesh.position.y += s.speed * 1.2;
          s.mesh.position.z -= s.speed * 0.5;
          const mat = s.mesh.material as THREE.LineBasicMaterial;
          mat.opacity -= 0.022;
          if (mat.opacity <= 0) { s.active = false; s.delay = Math.random() * 6 + 3; }
        }
      });

      // Force world matrix updates of nested meshes so HUD tracking is perfectly in sync
      solarSystemGroup.updateMatrixWorld(true);

      // HUD label projection
      planetWaypoints.forEach((wp, i) => {
        const mesh = planetMeshes[i];
        if (!mesh) return;

        // Get the current dynamic position of the planet
        tempV.setFromMatrixPosition(mesh.matrixWorld);
        const meshWorldPos = tempV.clone();

        tempV.project(camera);
        const label = labelElements[i];
        if (!label) return;

        const inView = tempV.z > -1 && tempV.z < 1;
        if (inView) {
          const sx = (tempV.x * 0.5 + 0.5) * width;
          const sy = (-(tempV.y * 0.5) + 0.5) * height;
          const dist = camera.position.distanceTo(meshWorldPos);

          // Calculate opacity based on stage proximity instead of raw 3D camera distance
          const stageDist = Math.abs(stage - i);
          let opacity = 0.0;
          if (stageDist < 0.6) {
            opacity = 1.0;
          } else if (stageDist < 0.95) {
            opacity = 1.0 - (stageDist - 0.6) / 0.35;
          }

          // Hide Overview (Tata Surya) label entirely and suppress other labels when in Hero section
          if (i === 0 || stage < 0.8) {
            opacity = 0.0;
          }

          // Safety fade-out if camera gets too close to prevent label clipping
          if (dist < 2.0) {
            opacity = Math.min(opacity, Math.max(0, dist - 1.0));
          }

          label.style.transform = `translate(${sx}px, ${sy}px)`;
          label.style.opacity = opacity.toString();
          label.style.display = opacity > 0.01 ? "flex" : "none";
        } else {
          label.style.display = "none";
          label.style.opacity = "0";
        }
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animateLoop);
    };
    animateLoop();

    const handleResize = () => {
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // ─── CLEANUP ───
    return () => {
      if (scrollContainer) scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);

      scene.clear();
      // Dispose geometries
      [sunGeo, mercuryGeo, venusGeo, venusAtmoGeo, earthGeo, earthCloudsGeo, earthAtmoGeo, moonGeo,
       marsGeo, jupiterGeo, saturnGeo, saturnRingGeo, uranusGeo, uranusAtmoGeo, uranusRingGeo,
       neptuneGeo, neptuneAtmoGeo, starGeo].forEach(g => g.dispose());
      asteroidGeos.forEach(g => g.dispose());
      shootingStars.forEach(s => { s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); });
      // Dispose textures
      [mercuryTex, mercuryBumpTex, venusTex, earthDayTex, earthNightTex, earthRoughnessTex, earthCloudsTex, marsTex, marsBumpTex,
       jupiterTex, saturnTex, saturnRingsTex, uranusTex, neptuneTex, coronaTex, starDotTex].forEach(t => t.dispose());
      // Dispose materials
      [sunShaderMat, mercuryMat, venusMat, earthMat, earthCloudsMat, earthAtmoMat, venusAtmoMat,
       marsMat, jupiterMat, saturnMat, saturnRingMat, uranusMat, neptuneMat, neptuneAtmoMat,
       uranusAtmoMat, moonMat, asteroidMat, coronaMat, starMat].forEach(m => m.dispose());

      // Dispose orbit lines
      orbitLinesGroup.children.forEach((child) => {
        const line = child as THREE.Line;
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });

      renderer.dispose();
    };
  }, [isClient]);

  return (
    <div className="relative w-full h-full select-none">
      <div ref={containerRef} className="w-full h-full pointer-events-none" />
      <div ref={hudRef} className="absolute inset-0 pointer-events-none overflow-hidden z-20" />
    </div>
  );
}
