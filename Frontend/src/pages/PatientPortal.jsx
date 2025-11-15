// PatientPortal.jsx
// Updated: model-click opens glass-morphism stat ring around the model with connecting lines.
// Replace your existing PatientPortal.jsx / App.jsx with this file.

import React, { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";

// ---------- Styles ----------
const glassBase = {
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 14,
  boxShadow: "0 8px 30px rgba(16,24,40,0.06)",
  color: "#0b1220",
};

const styles = {
  page: {
    height: "100vh",
    width: "100%",
    background: "linear-gradient(180deg,#e9f0ff 0%, #e6eefc 100%)",
    boxSizing: "border-box",
    padding: 20,
    display: "grid",
    gridTemplateColumns: "360px 1fr 360px",
    gap: 20,
  },
  leftCol: { display: "flex", flexDirection: "column", gap: 20 },
  rightCol: { display: "flex", flexDirection: "column", gap: 20 },
  centerCol: {
    position: "relative",
    height: "calc(100vh - 40px)",
    // no inner white box — canvas uses full available area
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 18,
  },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  smallCard: { padding: 16, ...glassBase },
};

// ---------- Demo data ----------
const MEDICAL_TIMELINE = [
  { id: 1, title: "Backpain Checkup", date: "02/03/2025", note: "Prescribed physiotherapy" },
  { id: 2, title: "Neurological Test", date: "02/05/2025", note: "Followup in 6 months" },
  { id: 3, title: "Knee Surgery", date: "02/06/2025", note: "Arthroscopy performed" },
];

const STATS = [
  { id: "head", title: "Head", value: "Normal" },
  { id: "chest", title: "Chest", value: "116 / 70" },
  { id: "shoulder", title: "Shoulder", value: "Healthy" },
  { id: "knee", title: "Knee", value: "No Issues" },
];

// ---------- HumanModel (clickable entire model) ----------
function HumanModel({ glbPath = '/models/human.glb', onModelClick }) {
  const gltf = useGLTF(glbPath, true);
  const group = useRef();
  
  useEffect(() => {
  if (!gltf?.scene) return;

  const root = gltf.scene;

  // 1. Find first SkinnedMesh (safe way)
  let target = null;
  root.traverse((obj) => {
    if (!target && obj.isSkinnedMesh) target = obj;
  });

  // fallback: find hips bone
  if (!target) {
    target = root.getObjectByName("mixamorigHips");
  }

  // fallback: ANY mesh
  if (!target) {
    root.traverse((obj) => {
      if (!target && obj.isMesh) target = obj;
    });
  }

  // last fallback: use root (won’t NaN crash)
  if (!target) {
    console.warn("No mesh found. Using root as target.");
    target = root;
  }

  // 2. Compute bounding box safely
  const bbox = new THREE.Box3().setFromObject(target);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  if (size.y === 0 || !isFinite(size.y)) {
    console.warn("Invalid bounding box", size);
    return; // do not apply NaN scale
  }

  const center = new THREE.Vector3();
  bbox.getCenter(center);

  // 3. Scale to target height
  const TARGET = 1.9;
  const scale = TARGET / size.y;

  root.scale.setScalar(scale);

  // 4. Recenter
  root.position.set(
    -center.x * scale,
    -center.y * scale + TARGET / 2 - 0.1,
    -center.z * scale
  );
  root.position.set(
  -center.x * scale,
  -center.y * scale + (TARGET / 2) - 1.05,  // lifted upward
  -center.z * scale
);


}, [gltf]);


  return (
    <group ref={group} onClick={onModelClick} dispose={null}>
      <primitive object={gltf.scene} />
    </group>
  );
}

// ---------- Glass stat card (absolute positioned) ----------
function GlassStatCard({ title, value, styleProps }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.28 }}
      style={{
        position: "absolute",
        padding: "14px 16px",
        minWidth: 150,
        ...glassBase,
        color: "#081028",
        fontWeight: 700,
        ...styleProps,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 18, marginTop: 6 }}>{value}</div>
    </motion.div>
  );
}

// ---------- Main component ----------
export default function PatientPortal() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [rect, setRect] = useState({ width: 1, height: 1, left: 0, top: 0 });

  // positions for cards (percentages relative to center container)
  // these are tuned for the model / canvas center; you can tweak in pxPercent if needed
  const cardPositions = [
    { id: "head", leftP: 50, topP: 8 }, // top-center
    { id: "chest", leftP: 72, topP: 40 }, // right-center
    { id: "shoulder", leftP: 18, topP: 40 }, // left-center
    { id: "knee", leftP: 50, topP: 78 }, // bottom-center
  ];

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ width: r.width, height: r.height, left: r.left, top: r.top });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      if (ro && containerRef.current) ro.unobserve(containerRef.current);
    };
  }, []);

  // compute pixel coords for SVG lines (center and each card)
  const centerPx = { x: rect.width / 2, y: rect.height / 2 };

  function cardPx(pos) {
    // card center pixel using percent values
    return {
      x: (pos.leftP / 100) * rect.width,
      y: (pos.topP / 100) * rect.height,
    };
  }

  // clickable overlay text hint (optional)
  const hintStyle = {
    position: "absolute",
    bottom: 22,
    left: "50%",
    transform: "translateX(-50%)",
    color: "#21314a",
    fontSize: 13,
    background: "rgba(255,255,255,0.85)",
    padding: "8px 12px",
    borderRadius: 12,
    boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
  };

  return (
    <div style={styles.page}>
      {/* LEFT */}
      <div style={styles.leftCol}>
        <div style={{ ...styles.smallCard, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(255,255,255,0.6)" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Hudson Dylan</div>
              <div style={{ color: "#586376", fontSize: 13 }}>Male • 49 years</div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button style={{ padding: "8px 12px", borderRadius: 9, background: "#4f46e5", color: "white", border: "none" }}>
              Open Charts
            </button>
            <button style={{ padding: "8px 12px", borderRadius: 9, background: "transparent", border: "1px solid rgba(0,0,0,0.06)" }}>
              Timeline
            </button>
          </div>
        </div>

        <div style={{ ...styles.smallCard, padding: 18 }}>
          <div style={{ fontSize: 13, color: "#586376" }}>Patient Body</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>96%</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>Health Body Condition</div>
        </div>
      </div>

      {/* CENTER - canvas fills whole center column */}
      <div style={styles.centerCol} ref={containerRef}>
        <Canvas camera={{ position: [0, 0.8, 2.6], fov: 46 }}>
          <ambientLight intensity={0.95} />
          <directionalLight intensity={1} position={[4, 5, 5]} />
          <Suspense fallback={null}>
            <HumanModel onModelClick={() => setOpen((s) => !s)} />
            <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.4} maxPolarAngle={Math.PI - 0.5} />
          </Suspense>
        </Canvas>

        {/* Hint */}
        {!open && <div style={hintStyle}>Click the model to view organ stats</div>}

        {/* SVG overlay for connecting lines */}
        <svg
          width={rect.width}
          height={rect.height}
          viewBox={`0 0 ${rect.width} ${rect.height}`}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
          {/* center dot for reference (hidden) */}
          {/* lines to cards */}
          {open &&
            cardPositions.map((pos) => {
              const p = cardPx(pos);
              // subtle curved line using quadratic bezier (from center to card)
              const midX = (centerPx.x + p.x) / 2;
              const midY = (centerPx.y + p.y) / 2 - 30; // lift mid to curve
              // build path
              const d = `M ${centerPx.x} ${centerPx.y} Q ${midX} ${midY} ${p.x} ${p.y}`;
              return <path key={pos.id} d={d} stroke="rgba(255,255,255,0.6)" strokeWidth="2.3" fill="none" strokeLinecap="round" />;
            })}
        </svg>

        {/* Glass cards around model */}
        <AnimatePresence>
          {open &&
            STATS.map((s, i) => {
              const pos = cardPositions[i];
              const leftPx = `${pos.leftP}%`;
              const topPx = `${pos.topP}%`;
              // nudge so card center sits at percent point
              const cardStyle = {
                left: leftPx,
                top: topPx,
                transform: "translate(-50%, -50%)",
                color: "#071122",
              };
              return <GlassStatCard key={s.id} title={s.title} value={s.value} styleProps={cardStyle} />;
            })}
        </AnimatePresence>
      </div>

      {/* RIGHT */}
      <div style={styles.rightCol}>
        <div style={{ ...styles.smallCard, padding: 18 }}>
          <div style={{ fontWeight: 700 }}>Vitals</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div style={{ ...glassBase, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#586376" }}>Blood Pressure</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>116/70</div>
            </div>
            <div style={{ ...glassBase, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#586376" }}>Heart Rate</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>120 bpm</div>
            </div>
            <div style={{ ...glassBase, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#586376" }}>Blood Count</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>80 - 90</div>
            </div>
            <div style={{ ...glassBase, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#586376" }}>Glucose</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>230 /ml</div>
            </div>
          </div>
        </div>

        <div style={{ ...styles.smallCard, padding: 18 }}>
          <div style={{ fontWeight: 700 }}>Medical History</div>
          <ul style={{ marginTop: 10 }}>
            {MEDICAL_TIMELINE.map((it) => (
              <li key={it.id} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{it.title}</div>
                <div style={{ fontSize: 12, color: "#586376" }}>{it.date}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
