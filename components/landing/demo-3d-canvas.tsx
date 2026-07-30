"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import {
  buildSceneObjects,
  planetWaypoints,
  getCameraWaypoints,
} from "./planet-builders";

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
    const getSegs = (desktopSegs: number, mobileSegs: number) =>
      isMobile ? mobileSegs : desktopSegs;

    // ─── RENDERER ───
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
    });
    renderer.setPixelRatio(
      isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5),
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const solarSystemGroup = new THREE.Group();
    scene.add(solarSystemGroup);

    // ─── LIGHTING ───
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xfff4e0, 4.0, 150, 0.4);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x4477aa, 0.3);
    rimLight.position.set(-5, 8, 12);
    scene.add(rimLight);

    const headlight = new THREE.DirectionalLight(0xddeeff, 0.7);
    headlight.position.set(0, 0.5, -1);
    scene.add(headlight);

    // ─── BUILD SCENE OBJECTS ───
    const objs = buildSceneObjects(
      scene,
      solarSystemGroup,
      getSegs,
      isMobile,
      hudContainer,
    );

    const cameraWaypoints = getCameraWaypoints(isMobile);

    // ─── EVENT HANDLERS ───
    let scrollPercent = 0;
    let targetScrollPercent = 0;
    const scrollContainer = document.getElementById("public-scroll-container");
    const handleScroll = () => {
      if (!scrollContainer) return;
      targetScrollPercent =
        scrollContainer.scrollTop /
        (scrollContainer.scrollHeight - scrollContainer.clientHeight || 1);
    };
    if (scrollContainer)
      scrollContainer.addEventListener("scroll", handleScroll);

    let mouseX = 0,
      mouseY = 0,
      targetMX = 0,
      targetMY = 0;
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
        0, 0, 0.8, 0.5, 0.35, 0.25, 0.12, 0.08, 0.04, 0.02,
      ];
      const offsets = [
        0, 0, 0.0, 1.2, 2.5, 3.8, 0.7, 4.5, 2.0, 5.1,
      ];
      const R = Math.abs(planetWaypoints[index].pos.z);
      const speed = speeds[index] || 0;
      const offset = offsets[index] || 0;
      const angle = elapsed * speed + offset;
      return new THREE.Vector3(
        Math.cos(angle) * R,
        planetWaypoints[index].pos.y,
        Math.sin(angle) * R,
      );
    };

    const getStageFromScroll = (s: number) => s * 9.0;

    // ─── ANIMATION LOOP ───
    const animateLoop = () => {
      const elapsed = clock.getElapsedTime();

      scrollPercent = lerp(scrollPercent, targetScrollPercent, 0.07);
      targetMX = lerp(targetMX, mouseX, 0.04);
      targetMY = lerp(targetMY, mouseY, 0.04);

      objs.sunShaderMat.uniforms.uTime.value = elapsed;

      const tempSunWorldDir = new THREE.Vector3()
        .copy(planetWaypoints[4].pos)
        .negate()
        .normalize();
      const sunViewDir = tempSunWorldDir
        .clone()
        .transformDirection(camera.matrixWorldInverse);
      if (objs.earthMat.userData.shader) {
        (objs.earthMat.userData.shader as any).uniforms.uSunViewDir.value.copy(
          sunViewDir,
        );
      }
      objs.earthAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);
      objs.venusAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);
      objs.uranusAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);
      objs.neptuneAtmoMat.uniforms.uSunViewDir.value.copy(sunViewDir);

      if (objs.jupiterMat.userData.shader) {
        (objs.jupiterMat.userData.shader as any).uniforms.uTime.value =
          elapsed;
      }
      if (objs.saturnMat.userData.shader) {
        (objs.saturnMat.userData.shader as any).uniforms.uTime.value = elapsed;
      }

      // Camera interpolation
      const totalStages = cameraWaypoints.length - 1;
      const stage = getStageFromScroll(scrollPercent);
      const idx = Math.min(Math.floor(stage), totalStages - 1);
      const t = stage - idx;
      const easedT = t * t * (3 - 2 * t);

      const camTarget = new THREE.Vector3();
      if (idx === 0) {
        const p0 = cameraWaypoints[0];
        const p1 = new THREE.Vector3(0.0, 35.0, 20.0);
        const p2 = cameraWaypoints[1];
        const mt = 1 - easedT;
        camTarget.set(
          mt * mt * p0.x + 2 * mt * easedT * p1.x + easedT * easedT * p2.x,
          mt * mt * p0.y + 2 * mt * easedT * p1.y + easedT * easedT * p2.y,
          mt * mt * p0.z + 2 * mt * easedT * p1.z + easedT * easedT * p2.z,
        );
      } else {
        camTarget.lerpVectors(
          cameraWaypoints[idx],
          cameraWaypoints[idx + 1],
          easedT,
        );
      }

      const aspect = height > 0 ? width / height : 1.0;
      let targetX = 0.0;
      if (aspect > 0.8) {
        const factor = Math.min(1.0, (aspect - 0.8) / 0.7);
        targetX = factor * 0.52;
      }

      const lookTargetDefault = new THREE.Vector3().lerpVectors(
        planetWaypoints[idx].pos,
        planetWaypoints[idx + 1].pos,
        t,
      );
      const D = camTarget.distanceTo(lookTargetDefault);
      const frustumHalfWidth = D * 0.41421 * aspect;

      let xOffset = targetX * frustumHalfWidth;
      let camCorrection = 0.3;

      if (idx === 0) {
        const overviewOffset = -40.0;
        xOffset = lerp(overviewOffset, targetX * frustumHalfWidth, t);
        camCorrection = lerp(-0.3, 0.3, t);
      }

      camera.position.x =
        camTarget.x + xOffset + camCorrection + targetMX * 0.3;
      camera.position.y = camTarget.y + targetMY * 0.3;
      camera.position.z = camTarget.z;

      const lookTarget = lookTargetDefault.clone();
      lookTarget.x += xOffset;
      if (isMobile) {
        lookTarget.y -= 0.65;
      }

      camera.lookAt(lookTarget);

      headlight.position.copy(camera.position);
      headlight.position.z -= 2;

      // Rotations
      objs.mercuryMesh.rotation.y = elapsed * 0.1;
      objs.venusMesh.rotation.y = -elapsed * 0.04;
      objs.earthMesh.rotation.y = elapsed * 0.15;
      objs.earthCloudsMesh.rotation.y = elapsed * 0.2;
      objs.moonOrbitGroup.rotation.y = elapsed * 0.4;
      objs.marsMesh.rotation.y = elapsed * 0.12;
      objs.jupiterMesh.rotation.y = elapsed * 0.25;
      objs.saturnMesh.rotation.y = elapsed * 0.2;
      objs.saturnRingMesh.rotation.z = -elapsed * 0.03;
      objs.uranusMesh.rotation.y = elapsed * 0.1;
      objs.neptuneMesh.rotation.y = elapsed * 0.08;

      // Orbit blending
      const blendToOrbit = idx === 0 ? 1.0 - easedT : 0.0;

      const getTargetPos = (i: number, originalPos: THREE.Vector3) => {
        if (blendToOrbit <= 0.0) return originalPos;
        const orbPos = getOrbitalPosition(i, elapsed);
        return new THREE.Vector3().lerpVectors(originalPos, orbPos, blendToOrbit);
      };

      objs.mercuryMesh.position.copy(
        getTargetPos(2, planetWaypoints[2].pos),
      );

      const venusPos = getTargetPos(3, planetWaypoints[3].pos);
      objs.venusMesh.position.copy(venusPos);
      objs.venusAtmoMesh.position.copy(venusPos);

      objs.earthGroup.position.copy(
        getTargetPos(4, planetWaypoints[4].pos),
      );
      objs.marsMesh.position.copy(
        getTargetPos(5, planetWaypoints[5].pos),
      );
      objs.jupiterMesh.position.copy(
        getTargetPos(6, planetWaypoints[6].pos),
      );
      objs.saturnGroup.position.copy(
        getTargetPos(7, planetWaypoints[7].pos),
      );
      objs.uranusGroup.position.copy(
        getTargetPos(8, planetWaypoints[8].pos),
      );

      const neptunePos = getTargetPos(9, planetWaypoints[9].pos);
      objs.neptuneMesh.position.copy(neptunePos);
      objs.neptuneAtmoMesh.position.copy(neptunePos);

      objs.orbitLinesGroup.children.forEach((child) => {
        const line = child as THREE.Line;
        (line.material as THREE.LineBasicMaterial).opacity =
          0.15 * blendToOrbit;
      });

      const coronaPulse = 5.8 + Math.sin(elapsed * 0.8) * 0.4;
      objs.coronaSprite.scale.set(coronaPulse, coronaPulse, 1);

      objs.asteroids.forEach((a) => {
        a.rotation.x += 0.002;
        a.rotation.y += 0.003;
      });
      objs.asteroidBeltGroup.rotation.z = elapsed * 0.005;

      objs.starField.rotation.y = elapsed * 0.003;
      if (objs.starMat.uniforms?.uTime) {
        objs.starMat.uniforms.uTime.value = elapsed;
      }

      objs.nebulae.forEach((n, i) => {
        n.rotation.z = elapsed * 0.012 * (i % 2 === 0 ? 1 : -1);
      });

      objs.shootingStars.forEach((s) => {
        if (!s.active) {
          s.delay -= 0.016;
          if (s.delay <= 0) {
            s.active = true;
            s.mesh.position.set(
              camera.position.x + (Math.random() - 0.5) * 25,
              camera.position.y + (Math.random() - 0.5) * 18,
              camera.position.z - (Math.random() * 30 + 5),
            );
            (s.mesh.material as THREE.LineBasicMaterial).opacity = 0.9;
          }
        } else {
          s.mesh.position.x += s.speed * 2.5;
          s.mesh.position.y += s.speed * 1.2;
          s.mesh.position.z -= s.speed * 0.5;
          const mat = s.mesh.material as THREE.LineBasicMaterial;
          mat.opacity -= 0.022;
          if (mat.opacity <= 0) {
            s.active = false;
            s.delay = Math.random() * 6 + 3;
          }
        }
      });

      solarSystemGroup.updateMatrixWorld(true);

      // HUD label projection
      planetWaypoints.forEach((wp, i) => {
        const mesh = objs.planetMeshes[i];
        if (!mesh) return;

        tempV.setFromMatrixPosition(mesh.matrixWorld);
        tempV.project(camera);

        const label = objs.labelElements[i];
        if (!label) return;

        const inView = tempV.z > -1 && tempV.z < 1;
        if (inView) {
          const sx = (tempV.x * 0.5 + 0.5) * width;
          const sy = (-(tempV.y * 0.5) + 0.5) * height;

          const stageDist = Math.abs(stage - i);
          let opacity = 0.0;
          if (stageDist < 0.6) {
            opacity = 1.0;
          } else if (stageDist < 0.95) {
            opacity = 1.0 - (stageDist - 0.6) / 0.35;
          }

          if (i === 0 || stage < 0.8) {
            opacity = 0.0;
          }

          const dist = camera.position.distanceTo(mesh.position);
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
      if (scrollContainer)
        scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);

      scene.clear();

      const d = objs.disposables;
      d.geos.forEach((g) => g.dispose());
      d.asteroidGeos.forEach((g) => g.dispose());
      d.textures.forEach((t) => t.dispose());
      d.materials.forEach((m) => m.dispose());
      d.orbitLineGeos.forEach((g) => g.dispose());
      d.orbitLineMats.forEach((m) => m.dispose());

      objs.shootingStars.forEach((s) => {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
      });

      renderer.dispose();
    };
  }, [isClient]);

  return (
    <div className="relative w-full h-full select-none">
      <div ref={containerRef} className="w-full h-full pointer-events-none" />
      <div
        ref={hudRef}
        className="absolute inset-0 pointer-events-none overflow-hidden z-20"
      />
    </div>
  );
}
