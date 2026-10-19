import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function OrbitScene() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 7.6;
    const sculpture = new THREE.Group();
    // The knot is the entire artwork; there is no surrounding orbit ring.
    const geometry = new THREE.TorusKnotGeometry(1.28, 0.43, 180, 18, 2, 3);
    const rootStyles = getComputedStyle(document.documentElement);
    const surface = new THREE.MeshBasicMaterial({
      color: rootStyles.getPropertyValue("--accent").trim() || "#fc5000",
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const wire = new THREE.MeshBasicMaterial({
      color: "#3b210e",
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    sculpture.add(
      new THREE.Mesh(geometry, surface),
      new THREE.Mesh(geometry, wire),
    );
    sculpture.rotation.set(0.35, 0.4, 0.08);
    scene.add(sculpture);

    let frame = null;
    let visible = true;
    let previousTime = null;
    const canAnimate = () => visible && !document.hidden && !motion.matches;
    function draw(time) {
      frame = null;
      if (!canAnimate()) return;
      if (previousTime !== null) {
        const delta = Math.min((time - previousTime) / 1000, 0.05);
        sculpture.rotation.y += delta * 0.2;
        sculpture.rotation.x += delta * 0.07;
      }
      previousTime = time;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    }
    function updateAnimation() {
      previousTime = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      renderer.render(scene, camera);
      if (canAnimate()) frame = requestAnimationFrame(draw);
    }
    function resize() {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateAnimation();
    });
    intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", updateAnimation);
    motion.addEventListener("change", updateAnimation);
    resize();
    updateAnimation();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", updateAnimation);
      motion.removeEventListener("change", updateAnimation);
      geometry.dispose();
      surface.dispose();
      wire.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="orbit-art" aria-hidden="true">
      <div className="scene-canvas" ref={containerRef} />
      <svg className="scene-fallback" viewBox="0 0 400 400" fill="none">
        <path
          d="M200 102C317 16 369 189 259 255C152 321 34 223 93 142C151 60 313 143 294 241C273 350 117 334 114 229C111 126 271 64 301 163C333 264 147 314 115 215C88 127 199 52 255 111C317 175 245 307 169 277C84 244 126 133 200 102Z"
          stroke="var(--accent)"
          strokeWidth="32"
        />
        <path
          d="M200 102C317 16 369 189 259 255C152 321 34 223 93 142C151 60 313 143 294 241C273 350 117 334 114 229C111 126 271 64 301 163C333 264 147 314 115 215C88 127 199 52 255 111C317 175 245 307 169 277C84 244 126 133 200 102Z"
          stroke="var(--ink)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
