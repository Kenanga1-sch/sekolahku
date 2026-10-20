"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HERO_SHADER_SOURCE } from "./hero-shader-source";

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
out vec4 outColor;
${HERO_SHADER_SOURCE}
void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  outColor = color;
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HeroShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let gl: WebGL2RenderingContext | null = null;
    let frameId = 0;
    let visible = true;
    let mounted = true;
    let hasFrame = false;
    let lastTime = 0;
    let elapsed = 0;
    let timeLocation: WebGLUniformLocation | null = null;
    let resolutionLocation: WebGLUniformLocation | null = null;

    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const start = () => {
      if (!gl || frameId || reduceMotion.matches || document.hidden || !visible) return;
      lastTime = performance.now();
      frameId = requestAnimationFrame(draw);
    };

    const draw = (now: number) => {
      frameId = 0;
      if (!mounted || !gl || reduceMotion.matches || document.hidden || !visible) return;
      const delta = Math.min(now - lastTime, 64);
      lastTime = now;
      elapsed += delta * 0.001;
      gl.uniform1f(timeLocation, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!hasFrame) {
        hasFrame = true;
        setReady(true);
      }
      frameId = requestAnimationFrame(draw);
    };

    const resize = () => {
      if (!gl) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const quality = rect.width > 1100 ? 0.7 : 0.85;
      const scale = Math.min(dpr * quality, 1920 / rect.width);
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const init = () => {
      gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
      if (!gl) return false;

      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vertex || !fragment) return false;

      const program = gl.createProgram();
      if (!program) return false;
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      timeLocation = gl.getUniformLocation(program, "iTime");
      resolutionLocation = gl.getUniformLocation(program, "iResolution");
      gl.clearColor(0.886, 0.957, 0.941, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      resize();
      return true;
    };

    if (!init()) return;

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    );
    intersection.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const onMotionChange = () => {
      if (reduceMotion.matches) {
        stop();
        setReady(false);
      } else {
        start();
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      setReady(false);
    };

    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", onMotionChange);
    canvas.addEventListener("webglcontextlost", onContextLost);

    start();

    return () => {
      mounted = false;
      stop();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div className="hero-shader-poster absolute inset-0" />
      <canvas
        ref={canvasRef}
        className={cn(
          "hero-shader-canvas absolute inset-0 h-full w-full transition-opacity duration-700 motion-reduce:opacity-0",
          ready ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
