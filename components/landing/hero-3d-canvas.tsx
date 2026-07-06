"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";

export default function Hero3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 6;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Group to hold all objects for parallax effect
    const sceneGroup = new THREE.Group();
    scene.add(sceneGroup);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 5, 4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // Cool colored rim lights for glossy pastel styling
    const blueLight = new THREE.PointLight(0x60a5fa, 1.5, 10);
    blueLight.position.set(-4, -2, 2);
    scene.add(blueLight);

    const amberLight = new THREE.PointLight(0xfbbf24, 1.5, 10);
    amberLight.position.set(3, -3, 2);
    scene.add(amberLight);

    // 5. Materials
    const bookCoverMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6, // Royal Blue
      roughness: 0.2,
      metalness: 0.1,
    });

    const bookPagesMat = new THREE.MeshStandardMaterial({
      color: 0xfcf8f2, // Off-white warm pages
      roughness: 0.8,
      metalness: 0.0,
    });

    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber Yellow
      roughness: 0.3,
      metalness: 0.1,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937, // Charcoal Dark
      roughness: 0.5,
      metalness: 0.2,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xe5c296, // Light wood
      roughness: 0.7,
      metalness: 0.0,
    });

    const redMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Bright Red
      roughness: 0.3,
      metalness: 0.1,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Gold
      roughness: 0.2,
      metalness: 0.8, // Metallic gold
    });

    const globeCyanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan
      roughness: 0.3,
      metalness: 0.2,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db, // Silver/Chrome stand
      roughness: 0.1,
      metalness: 0.9,
    });

    // 6. Creating 3D Objects programmatically

    // --- Object A: 3D Book ---
    const bookGroup = new THREE.Group();
    // Cover
    const coverGeo = new THREE.BoxGeometry(1.2, 1.6, 0.24);
    const coverMesh = new THREE.Mesh(coverGeo, bookCoverMat);
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    bookGroup.add(coverMesh);
    // Pages
    const pagesGeo = new THREE.BoxGeometry(1.12, 1.5, 0.2);
    const pagesMesh = new THREE.Mesh(pagesGeo, bookPagesMat);
    pagesMesh.position.x = 0.06; // shift slightly to expose pages
    bookGroup.add(pagesMesh);
    // Ribbon Bookmark
    const ribbonGeo = new THREE.BoxGeometry(0.1, 0.6, 0.02);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, redMat);
    ribbonMesh.position.set(-0.1, -0.7, 0.08);
    ribbonMesh.rotation.z = 0.1;
    bookGroup.add(ribbonMesh);

    bookGroup.position.set(-1.6, 0.8, 0.5);
    bookGroup.rotation.set(0.4, 0.6, -0.2);
    sceneGroup.add(bookGroup);

    // --- Object B: 3D Pencil ---
    const pencilGroup = new THREE.Group();
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
    const bodyMesh = new THREE.Mesh(bodyGeo, yellowMat);
    bodyMesh.castShadow = true;
    pencilGroup.add(bodyMesh);
    // Wood Tip
    const tipGeo = new THREE.ConeGeometry(0.08, 0.24, 6);
    const tipMesh = new THREE.Mesh(tipGeo, woodMat);
    tipMesh.position.y = 0.72; // top of cylinder body (1.2/2 + 0.24/2)
    pencilGroup.add(tipMesh);
    // Graphite Lead
    const leadGeo = new THREE.ConeGeometry(0.03, 0.09, 6);
    const leadMesh = new THREE.Mesh(leadGeo, darkMat);
    leadMesh.position.y = 0.825; // tip top
    pencilGroup.add(leadMesh);
    // Silver Ferrul
    const ferrulGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.15, 6);
    const ferrulMesh = new THREE.Mesh(ferrulGeo, chromeMat);
    ferrulMesh.position.y = -0.675; // bottom of cylinder body
    pencilGroup.add(ferrulMesh);
    // Eraser
    const eraserGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 6);
    const eraserMesh = new THREE.Mesh(eraserGeo, redMat);
    eraserMesh.position.y = -0.825;
    pencilGroup.add(eraserMesh);

    pencilGroup.position.set(1.6, -0.6, 0.6);
    pencilGroup.rotation.set(-0.6, 0.2, 0.8);
    sceneGroup.add(pencilGroup);

    // --- Object C: Graduation Cap ---
    const capGroup = new THREE.Group();
    // Mortar Board (Flat square)
    const boardGeo = new THREE.BoxGeometry(1.3, 0.06, 1.3);
    const boardMesh = new THREE.Mesh(boardGeo, darkMat);
    boardMesh.castShadow = true;
    capGroup.add(boardMesh);
    // Skull Cap (Underneath base)
    const capBaseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.32, 16);
    const capBaseMesh = new THREE.Mesh(capBaseGeo, darkMat);
    capBaseMesh.position.y = -0.19;
    capBaseMesh.castShadow = true;
    capGroup.add(capBaseMesh);
    // Gold Tassel Button
    const tasselBtnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8);
    const tasselBtnMesh = new THREE.Mesh(tasselBtnGeo, goldMat);
    tasselBtnMesh.position.y = 0.05;
    capGroup.add(tasselBtnMesh);
    // Gold Tassel Cord
    const tasselCordGeo = new THREE.BoxGeometry(0.02, 0.02, 0.6);
    const tasselCordMesh = new THREE.Mesh(tasselCordGeo, goldMat);
    tasselCordMesh.position.set(0.24, 0.04, 0.24);
    tasselCordMesh.rotation.y = Math.PI / 4;
    capGroup.add(tasselCordMesh);
    // Gold Tassel Band/Fringe
    const tasselFringeGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);
    const tasselFringeMesh = new THREE.Mesh(tasselFringeGeo, goldMat);
    tasselFringeMesh.position.set(0.46, -0.06, 0.46);
    capGroup.add(tasselFringeMesh);

    capGroup.position.set(1.4, 1.2, -0.2);
    capGroup.rotation.set(0.2, -0.4, 0.1);
    sceneGroup.add(capGroup);

    // --- Object D: 3D Globe ---
    const globeGroup = new THREE.Group();
    // Sphere
    const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const sphereMesh = new THREE.Mesh(sphereGeo, globeCyanMat);
    sphereMesh.castShadow = true;
    globeGroup.add(sphereMesh);
    // Latitude/Longitude Grid Overlay (Wireframe sphere)
    const gridGeo = new THREE.SphereGeometry(0.555, 12, 12);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    globeGroup.add(gridMesh);
    // Stand ring (half torus)
    const standRingGeo = new THREE.TorusGeometry(0.7, 0.06, 8, 32, Math.PI + 0.1);
    const standRingMesh = new THREE.Mesh(standRingGeo, chromeMat);
    standRingMesh.rotation.z = -Math.PI / 2;
    standRingMesh.position.y = 0.05;
    globeGroup.add(standRingMesh);
    // Stand base
    const standBaseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 16);
    const standBaseMesh = new THREE.Mesh(standBaseGeo, chromeMat);
    standBaseMesh.position.y = -0.75;
    globeGroup.add(standBaseMesh);
    const standBarGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const standBarMesh = new THREE.Mesh(standBarGeo, chromeMat);
    standBarMesh.position.y = -0.65;
    globeGroup.add(standBarMesh);

    globeGroup.position.set(-1.5, -0.8, 0.2);
    globeGroup.rotation.set(0.3, -0.6, -0.2);
    sceneGroup.add(globeGroup);

    // --- Particle System (Background Dots) ---
    const particleCount = 60;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Random coordinates in a bounding box
      particlePositions[i] = (Math.random() - 0.5) * 8; // X
      particlePositions[i + 1] = (Math.random() - 0.5) * 6; // Y
      particlePositions[i + 2] = (Math.random() - 0.5) * 3 - 1.5; // Z (behind meshes)
    }

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );

    // Create custom circle particle map
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
    }
    const particleTexture = new THREE.CanvasTexture(canvas);

    const particleMaterial = new THREE.PointsMaterial({
      color: 0x60a5fa, // Soft blue stars
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      map: particleTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // 7. Interaction and Animation
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      // Coordinates normalized from -1 to 1
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const clock = new THREE.Clock();

    const animateLoop = () => {
      const elapsedTime = clock.getElapsedTime();

      // Slow idle rotation of objects
      bookGroup.rotation.y = 0.6 + Math.sin(elapsedTime * 0.4) * 0.15;
      bookGroup.rotation.x = 0.4 + Math.cos(elapsedTime * 0.3) * 0.1;
      bookGroup.position.y = 0.8 + Math.sin(elapsedTime * 0.5) * 0.1;

      pencilGroup.rotation.y = 0.2 + Math.cos(elapsedTime * 0.5) * 0.2;
      pencilGroup.rotation.x = -0.6 + Math.sin(elapsedTime * 0.4) * 0.15;
      pencilGroup.position.y = -0.6 + Math.sin(elapsedTime * 0.6) * 0.08;

      capGroup.rotation.y = -0.4 + Math.sin(elapsedTime * 0.3) * 0.15;
      capGroup.rotation.z = 0.1 + Math.cos(elapsedTime * 0.45) * 0.08;
      capGroup.position.y = 1.2 + Math.sin(elapsedTime * 0.4) * 0.07;

      globeGroup.rotation.y = elapsedTime * 0.25; // continuously rotate globe
      globeGroup.position.y = -0.8 + Math.sin(elapsedTime * 0.55) * 0.09;

      // Rotate background particles slowly
      particleSystem.rotation.y = elapsedTime * 0.02;
      particleSystem.rotation.x = elapsedTime * 0.01;

      // Mouse Parallax interpolation (smooth damping)
      targetX += (mouseX - targetX) * 0.06;
      targetY += (mouseY - targetY) * 0.06;

      sceneGroup.rotation.y = targetX * 0.4;
      sceneGroup.rotation.x = -targetY * 0.4;

      renderer.render(scene, camera);
      requestAnimationFrame(animateLoop);
    };

    animateLoop();

    // 8. Resizing handler
    const handleResize = () => {
      const w = container.clientWidth || 500;
      const h = container.clientHeight || 500;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      // Dispose Three.js objects to avoid memory leaks
      scene.clear();
      coverGeo.dispose();
      pagesGeo.dispose();
      ribbonGeo.dispose();
      bodyGeo.dispose();
      tipGeo.dispose();
      leadGeo.dispose();
      ferrulGeo.dispose();
      eraserGeo.dispose();
      boardGeo.dispose();
      capBaseGeo.dispose();
      tasselBtnGeo.dispose();
      tasselCordGeo.dispose();
      tasselFringeGeo.dispose();
      sphereGeo.dispose();
      gridGeo.dispose();
      standRingGeo.dispose();
      standBaseGeo.dispose();
      standBarGeo.dispose();
      particleGeometry.dispose();
      particleTexture.dispose();
      
      bookCoverMat.dispose();
      bookPagesMat.dispose();
      yellowMat.dispose();
      darkMat.dispose();
      woodMat.dispose();
      redMat.dispose();
      goldMat.dispose();
      globeCyanMat.dispose();
      chromeMat.dispose();
      gridMat.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, [isClient]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[320px] sm:h-[450px] md:h-[550px] lg:h-[600px] xl:h-[650px] select-none cursor-grab active:cursor-grabbing relative z-20"
    />
  );
}
