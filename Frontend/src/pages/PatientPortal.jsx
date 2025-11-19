// PatientPortal.jsx
import React, { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import usePatientStore from "../Store/PatientStore";

/*
  Final PatientPortal.jsx
  - Uses your model positioning exactly:
    root.position.set(-center.x*scale, -center.y*scale + TARGET_HEIGHT/2 - 1.05, -center.z*scale)
  - Option B4 (floating cloud) card placement
  - SVG bezier lines from body points to glass cards
  - Donut chart under contact
  - Fetches data from GET /dashboard/patient/data (credentials: include)
*/

// ---------- Config ----------
const DATA_URL = "/dashboard/patient/data";
const DEFAULT_AVATAR =
  "https://img.freepik.com/premium-photo/human-resources-manager-digital-avatar-generative-ai_934475-9192.jpg?ga=GA1.1.273726104.1763057097&semt=ais_hybrid&w=740&q=80";

const glassBase = {
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 12,
  boxShadow: "0 12px 40px rgba(8,18,40,0.06)",
  color: "#061226",
};

// ---------- Helpers ----------
function calcAge(dob) {
  if (!dob) return "";
  const b = new Date(dob);
  const diff = Date.now() - b.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

// ---------- HumanModel: loads GLB, auto-scale, EXACT positioning, projects body points ----------
function HumanModel({ glb = "/models/human.glb", onBodyPoints = () => {}, onModelClick = () => {} }) {
  const { scene } = useGLTF(glb, true);
  const group = useRef();
  const { camera, gl } = useThree();

  // logical body parts -> candidate node names in GLB (extend if needed)
  const boneMap = useMemo(() => ({
    brain: ["mixamorigHead", "Head", "head"],
    lungs: ["mixamorigSpine1", "Chest", "Torso"],
    heart: ["mixamorigSpine2", "Chest", "Torso"],
    digest: ["mixamorigHips", "Stomach", "Abdomen"],
    liver: ["mixamorigHips", "Liver"],
    kidney: ["mixamorigHips", "Kidney"],
    msk: ["mixamorigRightUpLeg", "mixamorigLeftUpLeg", "mixamorigHips"],
    mobility: ["mixamorigRightUpLeg", "mixamorigLeftUpLeg"]
  }), []);

  // Auto-scale and apply YOUR exact positioning (uses -1.05 offset you specified)
  useEffect(() => {
    if (!scene) return;
    const root = scene;

    // pick a target mesh for bounding box (skinned mesh preferred)
    let target = null;
    root.traverse(o => { if (!target && o.isSkinnedMesh) target = o; });
    if (!target) {
      target = root.getObjectByName("mixamorigHips") || root;
    }

    const bbox = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const center = new THREE.Vector3(); bbox.getCenter(center);

    // guard against invalid sizes
    if (!isFinite(size.y) || size.y === 0) {
      root.scale.setScalar(1);
      // root position is for chaingg the location of 3D model
      root.position.set(0, -0.9, 0);
      camera.position.set(0, 1.55, 3.2);
      camera.updateProjectionMatrix();
      return;
    }

    const TARGET_HEIGHT = 1.9;
    const scale = TARGET_HEIGHT / size.y;

    root.scale.setScalar(scale);

    // --- YOUR exact positioning (important) ---
    root.position.set(
      -center.x * scale,
      -center.y * scale + TARGET_HEIGHT / 2 - 1.05,
      -center.z * scale
    );

    // set camera to fixed composition (keeps same look you used)
    camera.position.set(0, 1.55, 3.2);
    camera.updateProjectionMatrix();
  }, [scene, camera]);

  // continuously compute projected screen coordinates for each body point
  useEffect(() => {
    if (!scene) return;
    let alive = true;
    const tmp = new THREE.Vector3();

    function worldToScreen(worldV) {
      const v = worldV.clone();
      v.project(camera);
      const dom = gl.domElement;
      const width = dom.clientWidth || dom.width || window.innerWidth;
      const height = dom.clientHeight || dom.height || window.innerHeight;
      return [ (v.x * 0.5 + 0.5) * width, (-v.y * 0.5 + 0.5) * height ];
    }

    function loop() {
      if (!alive) return;
      const out = {};
      for (const key of Object.keys(boneMap)) {
        let nodeFound = null;
        for (const cand of boneMap[key]) {
          const n = scene.getObjectByName(cand);
          if (n) { nodeFound = n; break; }
        }
        if (!nodeFound) {
          nodeFound = scene.getObjectByName("mixamorigHips") || scene;
        }
        nodeFound.getWorldPosition(tmp);
        tmp.add(new THREE.Vector3(0, 0.02, 0)); // small nudge outward
        out[key] = worldToScreen(tmp);
      }
      onBodyPoints(out);
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
    return () => { alive = false; };
  }, [scene, camera, gl, boneMap, onBodyPoints]);

  return (
    <group ref={group} onClick={onModelClick} dispose={null} style={{ cursor: "pointer" }}>
      {scene && <primitive object={scene} />}
    </group>
  );
}

// ---------- UI: Glass Stat Card ----------
function GlassStatCard({ title, lines = [], styleProps = {}, id }) {
  return (
    <motion.div
      key={id || title}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      style={{ position: "absolute", padding: "12px 14px", minWidth: 170, ...glassBase, color: "#041225", fontWeight: 700, ...styleProps }}
    >
      <div style={{ fontSize: 12, opacity: 0.85 }}>{title}</div>
      <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13, color: "#08203a", lineHeight: 1.3 }}>
        {lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: "#475569" }}>No data available</div>}
      </div>
    </motion.div>
  );
}

// ---------- Donut chart ----------
function Donut({ percent = 80, size = 140 }) {
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const healthy = Math.max(0, Math.min(100, Math.round(percent)));
  const dash = (healthy / 100) * c;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="18" />
          <circle r={r} fill="none" stroke="rgba(79,70,229,0.92)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90)" />
        </g>
      </svg>
      <div style={{ fontWeight: 800 }}>{healthy}%</div>
      <div style={{ fontSize: 12, color: "#475569" }}>Body Condition</div>
    </div>
  );
}

// ---------- Main Component ----------
export default function PatientPortal() {
  const { patientData } = usePatientStore(); // getting patientData form backend as:eg., patientData.name

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openCloud, setOpenCloud] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const containerRef = useRef(null);
  const [rect, setRect] = useState({ width: 1, height: 1 });
  const [bodyPoints, setBodyPoints] = useState({}); // { brain: [x,y], ... }

  // measure center column area for svg/card placement (Canvas is full center column)
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ width: r.width, height: r.height });
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

  // fetch patient data from your backend endpoint
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(DATA_URL, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Fetch ${res.status}: ${txt}`);
        }
        return res.json();
      })
      .then(data => { if (!mounted) return; setPatient(data.patient || data); })
      .catch(e => { console.error("patient fetch error:", e); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => (mounted = false);
  }, []);

  // center point relative to center container
  const centerPx = { x: rect.width / 2, y: rect.height / 2 };

  // sizing parameters
  const baseRadius = Math.min(rect.width, rect.height) * 0.28;
  const modelSafeRadius = Math.min(rect.width, rect.height) * 0.18;

  // order for display
  const statOrder = ["brain","lungs","heart","digest","liver","kidney","msk","mobility"];

  // derive stat display from patient object (keeps naming consistent with backend model)
  const derive = (p) => {
    const out = {};
    out.brain = [p?.currentHealth?.mentalHealthStatus || "No data available"];
    out.lungs = [p?.medicalHistory?.organHealth || "No respiratory data"];
    out.heart = [`BP: ${p?.diagnostics?.vitalSigns?.bloodPressure || "—"}`, `HR: ${p?.diagnostics?.vitalSigns?.heartRate || "—"}`];
    out.digest = [p?.diagnostics?.organFunction?.others || "No digestive data"];
    out.liver = [p?.diagnostics?.organFunction?.liver || "No liver data"];
    out.kidney = [p?.diagnostics?.organFunction?.kidney || "No kidney data"];
    const surg = (p?.medicalHistory?.surgicalProcedures || []).slice(-2).reverse();
    out.msk = surg.length ? surg : ["No musculoskeletal records"];
    out.mobility = [p?.currentHealth?.exerciseRoutine || "Routine not updated"];
    return out;
  };
  const stats = derive(patient);

  // compute card placements using projected body points and push outward
  function computeCardPlacement() {
    const placements = {};
    if (!rect.width || !rect.height) return placements;
    for (let i = 0; i < statOrder.length; i++) {
      const id = statOrder[i];
      const bp = bodyPoints[id];
      // default origin near center if missing
      let sx = centerPx.x, sy = centerPx.y;
      if (bp && bp.length === 2 && isFinite(bp[0]) && isFinite(bp[1])) {
        sx = bp[0]; sy = bp[1];
      } else {
        // fallback angle spread
        const angle = -90 + i * (360 / statOrder.length);
        const rad = (angle * Math.PI) / 180;
        sx = centerPx.x + Math.cos(rad) * (baseRadius * 0.6);
        sy = centerPx.y + Math.sin(rad) * (baseRadius * 0.6);
      }

      // vector from center to origin
      let dirX = sx - centerPx.x;
      let dirY = sy - centerPx.y;
      let len = Math.hypot(dirX, dirY);
      if (len < 1e-3) { dirX = 1; dirY = 0; len = 1; }
      dirX /= len; dirY /= len;

      // push outward so cards don't overlap model safe radius
      const push = modelSafeRadius + 40 + ((i % 3) * 10);
      const targetX = centerPx.x + dirX * push;
      const targetY = centerPx.y + dirY * push;

      const padding = 20;
      const left = Math.min(Math.max(targetX, padding), rect.width - padding);
      const top = Math.min(Math.max(targetY, padding), rect.height - padding);

      placements[id] = { x: left, y: top, screenOrigin: [sx, sy] };
    }
    return placements;
  }

  const cardPlacements = computeCardPlacement();

  if (loading) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ ...glassBase, padding: 18 }}>Loading patient dashboard...</div></div>;
  }

  const profilePic = (patient && patient.profilePic) || DEFAULT_AVATAR;
  const name = (patient && patient.name) || "Unknown Patient";
  const uid = (patient && patient.uid) || "—";
  const email = (patient && patient.email) || "—";
  const age = patient?.dob ? calcAge(patient.dob) : "";

  let bodyPercent = 80;
  if (patient?.diagnostics?.vitalSigns?.bmi) {
    const bmi = parseFloat(patient.diagnostics.vitalSigns.bmi);
    if (isFinite(bmi)) bodyPercent = Math.max(30, Math.min(98, Math.round(100 - Math.abs(22 - bmi) * 4)));
  }

  return (
    <div style={{ height: "100vh", width: "100%", background: "linear-gradient(180deg,#e8efff,#e6eefc)", padding: 18, boxSizing: "border-box" }}>
      {/* header */}
      <div><h1 className="text-2xl font-bold mb-4">Welcome, {patientData.name}</h1></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>MediVault</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveTab("overview")} style={{ padding: "8px 12px", borderRadius: 10, background: activeTab === "overview" ? "#eef2ff" : "transparent", border: "none" }}>Overview</button>
            <button onClick={() => setActiveTab("timeline")} style={{ padding: "8px 12px", borderRadius: 10, background: activeTab === "timeline" ? "#eef2ff" : "transparent", border: "none" }}>Timeline</button>
            <button onClick={() => setActiveTab("allergies")} style={{ padding: "8px 12px", borderRadius: 10, background: activeTab === "allergies" ? "#eef2ff" : "transparent", border: "none" }}>Allergies & Immunization</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800 }}>{name}</div>
            <div style={{ fontSize: 12, color: "#475569" }}>{uid} • {patient?.gender || "—"} {age ? `• ${age} yrs` : ""}</div>
          </div>
          <img src={profilePic} alt="avatar" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "2px solid rgba(255,255,255,0.5)" }} />
        </div>
      </div>

      {/* grid */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr 360px", gap: 18, height: "calc(100vh - 86px)" }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ padding: 12, ...glassBase }}>
            <div style={{ display: "flex", gap: 12 }}>
              <img src={profilePic} alt="pf" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} />
              <div>
                <div style={{ fontWeight: 800 }}>{name}</div>
                <div style={{ fontSize: 13, color: "#475569" }}>{email}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>{patient?.gender || "—"} {age ? `• ${age} yrs` : ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(79,70,229,0.08)", fontWeight: 700 }}>{patient?.diagnostics?.vitalSigns?.bloodPressure || "BP —"}</div>
              <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(79,70,229,0.08)", fontWeight: 700 }}>{patient?.diagnostics?.vitalSigns?.heartRate || "HR —"}</div>
            </div>
          </div>

          <div style={{ padding: 12, ...glassBase }}>
            <div style={{ fontWeight: 800 }}>Quick Health</div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div>Body Condition: <strong>{bodyPercent}%</strong></div>
              <div style={{ marginTop: 6 }}>Exercise: {patient?.currentHealth?.exerciseRoutine || "Not set"}</div>
              <div style={{ marginTop: 6 }}>Medications: {(patient?.currentHealth?.medications || []).length ? patient.currentHealth.medications.map(m => m.name).join(", ") : "None listed"}</div>
            </div>
          </div>

          <div style={{ padding: 12, ...glassBase }}>
            <div style={{ fontWeight: 800 }}>Contact</div>
            <div style={{ marginTop: 8 }}>
              <div>Phone: {patient?.phone || "—"}</div>
              <div style={{ marginTop: 6 }}>Emergency: {patient?.emergencyContact?.name ? `${patient.emergencyContact.name} (${patient.emergencyContact.relation}) ${patient.emergencyContact.phone || ""}` : "—"}</div>
              <div style={{ marginTop: 6 }}>Address: {patient?.address || "—"}</div>
            </div>
          </div>

          <div style={{ padding: 12, ...glassBase, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Donut percent={bodyPercent} />
          </div>
        </div>

        {/* CENTER (canvas + overlay) */}
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "linear-gradient(180deg,#f8fbff,#eef6ff)" }} ref={containerRef}>
          {activeTab === "overview" && (
            <>
              {/* THis if for changin the camera angle of 3D model */}
              <Canvas style={{ width: "100%", height: "100%" }} camera={{ position: [0, 1.6, 4.0], fov: 40 }}>
                <ambientLight intensity={0.95} />
                <directionalLight intensity={1} position={[4, 5, 5]} />
                <Suspense fallback={null}>
                  <HumanModel onBodyPoints={(pts) => setBodyPoints(pts)} onModelClick={() => setOpenCloud(s => !s)} />
                  <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.4} maxPolarAngle={Math.PI - 0.5} />
                  <ContactShadows position={[0, -0.95, 0]} opacity={0.5} scale={2.6} blur={2} far={1.2} />
                </Suspense>
              </Canvas>

              {!openCloud && (
                <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", padding: "8px 12px", background: "rgba(255,255,255,0.9)", borderRadius: 12 }}>
                  Click the model to show organ stats
                </div>
              )}

              {/* SVG lines */} 
              <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                {openCloud && statOrder.map((id, idx) => {
                  const placement = cardPlacements[id];
                  const origin = placement?.screenOrigin;
                  if (!origin || !placement) return null;
                  const sx = origin[0], sy = origin[1];
                  const tx = placement.x, ty = placement.y;
                  const mx = (sx + tx) / 2;
                  const my = (sy + ty) / 2 - 40;
                  const d = `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`;
                  return <path key={id} d={d} stroke="rgba(255,255,255,0.66)" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
                })}
              </svg>

              {/* glass stat cards */}
              <AnimatePresence>
                {openCloud && statOrder.map((id) => {
                  const placement = cardPlacements[id];
                  if (!placement) return null;
                  const styleProps = { left: `${(placement.x / Math.max(1, rect.width)) * 100}%`, top: `${(placement.y / Math.max(1, rect.height)) * 100}%`, transform: "translate(-50%,-50%)" };
                  const titleMap = {
                    brain: "Brain",
                    lungs: "Lungs / Respiratory",
                    heart: "Heart / Chest",
                    digest: "Digestive / Others",
                    liver: "Liver Function",
                    kidney: "Kidney Function",
                    msk: "Musculoskeletal",
                    mobility: "Mobility / Lower Body"
                  };
                  return <GlassStatCard key={id} id={id} title={titleMap[id]} lines={stats[id] || []} styleProps={styleProps} />;
                })}
              </AnimatePresence>
            </>
          )}

          {/* Timeline content */}
          {activeTab === "timeline" && (
            <div style={{ padding: 20, height: "100%", overflow: "auto" }}>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Medical Timeline</div>
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Surgical Procedures</div>
                <ul style={{ marginTop: 8 }}>{(patient?.medicalHistory?.surgicalProcedures || []).length ? patient.medicalHistory.surgicalProcedures.map((s,i) => <li key={i}>{s}</li>) : <li>None recorded</li>}</ul>
              </div>
              <div style={{ height: 12 }} />
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Past Hospitalizations</div>
                <div style={{ marginTop: 8 }}>{(patient?.medicalHistory?.pastHospitalizations || []).length ? patient.medicalHistory.pastHospitalizations.map((h,i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ fontWeight: 700 }}>{h.reason}</div><div style={{ fontSize: 12, color: "#475569" }}>{h.duration} • {h.hospitalName}</div></div>) : <div>No hospitalizations recorded</div>}</div>
              </div>
            </div>
          )}

          {/* Allergies & Immunization content */}
          {activeTab === "allergies" && (
            <div style={{ padding: 20, height: "100%", overflow: "auto" }}>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Allergies & Immunization</div>
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Allergies</div>
                <ul style={{ marginTop: 8 }}>{(patient?.medicalHistory?.allergies || []).length ? patient.medicalHistory.allergies.map((a,i) => <li key={i}>{a}</li>) : <li>No allergies recorded</li>}</ul>
              </div>
              <div style={{ height: 12 }} />
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Vaccination Records</div>
                <ul style={{ marginTop: 8 }}>{(patient?.medicalHistory?.vaccinationRecords || []).length ? patient.medicalHistory.vaccinationRecords.map((v,i) => <li key={i}>{v}</li>) : <li>No vaccination records</li>}</ul>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ padding: 12, ...glassBase }}>
            <div style={{ fontWeight: 800 }}>Vitals</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div style={{ ...glassBase, padding: 10 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>Blood Pressure</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{patient?.diagnostics?.vitalSigns?.bloodPressure || "—"}</div>
              </div>
              <div style={{ ...glassBase, padding: 10 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>Heart Rate</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{patient?.diagnostics?.vitalSigns?.heartRate || "—"}</div>
              </div>
              <div style={{ ...glassBase, padding: 10 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>BMI</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{patient?.diagnostics?.vitalSigns?.bmi || "—"}</div>
              </div>
              <div style={{ ...glassBase, padding: 10 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>Sugar</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{patient?.diagnostics?.vitalSigns?.sugarLevels || "—"}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: 12, ...glassBase }}>
            <div style={{ fontWeight: 800 }}>Medical History Summary</div>
            <div style={{ marginTop: 8 }}>
              <div>Conditions: {(patient?.medicalHistory?.healthConditions || []).join(", ") || "—"}</div>
              <div style={{ marginTop: 6 }}>Organ Health: {patient?.medicalHistory?.organHealth || "—"}</div>
            </div>
          </div>

          <div style={{ padding: 12, ...glassBase }}>
            <div style={{ fontWeight: 800 }}>Admin</div>
            <div style={{ marginTop: 8 }}>
              <div>Next Appointment: {patient?.admin?.nextAppointment ? new Date(patient.admin.nextAppointment).toLocaleString() : "Not set"}</div>
              <div style={{ marginTop: 6 }}>Insurance: {patient?.admin?.insuranceDetails || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
