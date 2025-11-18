// PatientPortal.jsx
import React, { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
/*
  FINAL FIXED PatientPortal.jsx
  - REVERTED DATA to placeholders.
  - STATIC PLACEMENT: Using specified left/top values.
  - FIXED: Corrected lineStart points to ensure SVG lines are visible and connect logically to the model.
  - **NEW:** Added the provided image as background for the 3D model area.
  - Model acts as a visibility trigger.
*/

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

function calcAge(dob) {
  if (!dob) return "";
  const b = new Date(dob);
  const diff = Date.now() - b.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

// ---------------- HumanModel (simplified for static card placement) ----------------
function HumanModel({ glb = "/models/human.glb", onModelClick = () => {} }) {
  const { scene } = useGLTF(glb, true);
  const group = useRef();
  const { camera } = useThree();

  // Auto-scale & apply exact positioning
  useEffect(() => {
    if (!scene) return;
    const root = scene;

    let target = null;
    root.traverse((o) => {
      if (!target && o.isSkinnedMesh) target = o;
    });
    if (!target) target = root.getObjectByName("mixamorigHips") || root;

    const bbox = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    if (!isFinite(size.y) || size.y === 0) {
      root.scale.setScalar(1);
      root.position.set(0, -0.9, 0);
      camera.position.set(0, 1.55, 3.2);
      camera.updateProjectionMatrix();
      return;
    }

    const TARGET_HEIGHT = 1.9;
    const scale = TARGET_HEIGHT / size.y;
    root.scale.setScalar(scale);

    root.position.set(-center.x * scale, -center.y * scale + TARGET_HEIGHT / 2 - 1.05, -center.z * scale);

    camera.position.set(0, 1.55, 3.2);
    camera.updateProjectionMatrix();
  }, [scene, camera]);

  return (
    <group ref={group} onClick={onModelClick} dispose={null} style={{ cursor: "pointer" }}>
      {scene && <primitive object={scene} />}
    </group>
  );
}

// ---------------- UI components ----------------
function GlassStatCard({ title, lines = [], styleProps = {}, id }) {
  const left = styleProps.left;
  const top = styleProps.top;
  const transform = styleProps.transform || "translate(-50%,-50%)";
  return (
    <motion.div
      key={id || title}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "absolute",
        left,
        top,
        transform,
        padding: "12px 14px",
        minWidth: 170,
        ...glassBase,
        color: "#041225",
        fontWeight: 700,
        zIndex: 30,
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.85 }}>{title}</div>
      <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13, color: "#08203a", lineHeight: 1.3 }}>
        {lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: "#475569" }}>—</div>}
      </div>
    </motion.div>
  );
}

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

// ---------------- Main ----------------
export default function PatientPortal() {
  toast.success("wooof u made it !!"); 
  const [patient, setPatient] = useState({
    profilePic: DEFAULT_AVATAR,
    name: "Unknown Patient",
    uid: "—",
    email: "—",
    gender: "—",
    dob: null,
    diagnostics: {
      vitalSigns: { bloodPressure: "—", heartRate: "—", bmi: "—", sugarLevels: "—" },
      organFunction: { liver: "—", kidney: "—", others: "—" },
    },
    currentHealth: { mentalHealthStatus: "No data available", exerciseRoutine: "Not set", medications: [] },
    medicalHistory: { organHealth: "—", surgicalProcedures: [], healthConditions: [], allergies: [], vaccinationRecords: [] },
    phone: "—",
    emergencyContact: null,
    address: "—",
    admin: { nextAppointment: null, insuranceDetails: "—" },
  });
  const [loading, setLoading] = useState(true);
  const [openCloud, setOpenCloud] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const containerRef = useRef(null);
  const [rect, setRect] = useState({ width: 1, height: 1 });

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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 500);
    return () => (mounted = false);
  }, []);

  const statOrder = ["brain", "lungs", "heart", "digest", "liver", "kidney", "msk", "mobility"];

  const derive = (p) => {
    const out = {};
    out.brain = [p?.currentHealth?.mentalHealthStatus || "No data available"];
    out.lungs = [p?.medicalHistory?.organHealth || "—"];
    out.heart = [`BP: ${p?.diagnostics?.vitalSigns?.bloodPressure || "—"}`, `HR: ${p?.diagnostics?.vitalSigns?.heartRate || "—"}`];
    out.digest = [p?.diagnostics?.organFunction?.others || "—"];
    out.liver = [p?.diagnostics?.organFunction?.liver || "—"];
    out.kidney = [p?.diagnostics?.organFunction?.kidney || "—"];
    const surg = (p?.medicalHistory?.surgicalProcedures || []).slice(-2).reverse();
    out.msk = surg.length ? surg : ["—"];
    out.mobility = [p?.currentHealth?.exerciseRoutine || "Not set"];
    return out;
  };
  const stats = derive(patient);

  // Health card placement location !!!!
  // FIX: Using the exact left/top coordinates you requested, and correcting lineStart for visibility/connection.
  function computeStaticCardPlacement() {
    return {
      // Left side cards (based on your input)
      brain:    { left: '15%', top: '12%', lineStart: '45% 15%' }, // Adjusted lineStart for head/neck
      lungs:    { left: '07%', top: '33%', lineStart: '42% 35%' }, // Adjusted lineStart for left lung area
      liver:    { left: '09%', top: '50%', lineStart: '44% 45%' }, // Adjusted lineStart for liver/upper abdomen area
      msk:      { left: '11%', top: '74%', lineStart: '46% 70%' }, // Adjusted lineStart for hip/upper leg

      // Right side cards (based on your input)
      heart:    { left: '62%', top: '13%', lineStart: '55% 25%' }, // Adjusted lineStart for upper chest/heart area
      digest:   { left: '68%', top: '33%', lineStart: '58% 45%' }, // Adjusted lineStart for mid-abdomen area
      kidney:   { left: '66%', top: '50%', lineStart: '58% 55%' }, // Adjusted lineStart for kidney area
      mobility: { left: '64%', top: '74%', lineStart: '55% 75%' }, // Adjusted lineStart for lower legs
    };
  }

  const cardPlacements = computeStaticCardPlacement();

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...glassBase, padding: 18 }}>Loading patient dashboard...</div>
      </div>
    );
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

        {/* CENTER (canvas + overlays) */}
        <div
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            // UPDATED: Added the provided image as background
            backgroundImage: `url(/platform.png)`, // Using the direct URL from your uploaded image
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            zIndex: 1,
            height: "100%",
          }}
          ref={containerRef}
        >
          {activeTab === "overview" && (
            <>
              <Canvas style={{ width: "100%", height: "100%" }} camera={{ position: [0, 1.6, 4.0], fov: 40 }}>
                <ambientLight intensity={0.95} />
                <directionalLight intensity={1} position={[4, 5, 5]} />
                <Suspense fallback={null}>
                  <HumanModel onModelClick={() => setOpenCloud((s) => !s)} />
                  <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.4} maxPolarAngle={Math.PI - 0.5} />
                  <ContactShadows position={[0, -0.95, 0]} opacity={0.45} scale={2.6} blur={2} far={1.2} />
                </Suspense>
              </Canvas>

              {!openCloud && (
                <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", padding: "8px 12px", background: "rgba(255,255,255,0.9)", borderRadius: 12, zIndex: 20 }}>
                  Click the model to show organ stats
                </div>
              )}

              {/* SVG lines overlay */}
              <svg
                width={rect.width}
                height={rect.height}
                viewBox={`0 0 ${rect.width} ${rect.height}`}
                style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 25 }}
              >
                {openCloud &&
                  statOrder.map((id) => {
                    const placement = cardPlacements[id];
                    if (!placement) return null;
                    
                    const [sxPercent, syPercent] = placement.lineStart.split(' ').map(p => parseFloat(p) / 100);
                    const sx = rect.width * sxPercent;
                    const sy = rect.height * syPercent;
                    
                    const tx = rect.width * (parseFloat(placement.left) / 100);
                    const ty = rect.height * (parseFloat(placement.top) / 100);
                    
                    const d = `M ${sx} ${sy} L ${tx} ${ty}`;
                    
                    // Increased stroke opacity for better visibility
                    return <path key={id} d={d} stroke="rgba(8,18,40,0.6)" strokeWidth="3" fill="none" strokeLinecap="round" />;
                  })}
              </svg>

              {/* Glass stat cards */}
              <AnimatePresence>
                {openCloud &&
                  statOrder.map((id) => {
                    const placement = cardPlacements[id];
                    if (!placement) return null;
                    const styleProps = {
                      left: placement.left,
                      top: placement.top,
                      transform: "translate(-50%,-50%)",
                    };
                    const titleMap = {
                      brain: "Brain",
                      lungs: "Lungs / Respiratory",
                      heart: "Heart / Chest",
                      digest: "Digestive / Others",
                      liver: "Liver Function",
                      kidney: "Kidney Function",
                      msk: "Musculoskeletal",
                      mobility: "Mobility / Lower Body",
                    };
                    return <GlassStatCard key={id} id={id} title={titleMap[id]} lines={stats[id] || []} styleProps={styleProps} />;
                  })}
              </AnimatePresence>
            </>
          )}

          {/* Timeline */}
          {activeTab === "timeline" && (
            <div style={{ padding: 20, height: "100%", overflow: "auto" }}>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Medical Timeline</div>
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Surgical Procedures</div>
                <ul style={{ marginTop: 8 }}>{(patient?.medicalHistory?.surgicalProcedures || []).length ? patient.medicalHistory.surgicalProcedures.map((s, i) => <li key={i}>{s}</li>) : <li>None recorded</li>}</ul>
              </div>
              <div style={{ height: 12 }} />
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Past Hospitalizations</div>
                <div style={{ marginTop: 8 }}>{(patient?.medicalHistory?.pastHospitalizations || []).length ? patient.medicalHistory.pastHospitalizations.map((h, i) => <div key={i} style={{ marginBottom: 8 }}><div style={{ fontWeight: 700 }}>{h.reason}</div><div style={{ fontSize: 12, color: "#475569" }}>{h.duration} • {h.hospitalName}</div></div>) : <div>No hospitalizations recorded</div>}</div>
              </div>
            </div>
          )}

          {/* Allergies & Immunization */}
          {activeTab === "allergies" && (
            <div style={{ padding: 20, height: "100%", overflow: "auto" }}>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Allergies & Immunization</div>
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Allergies</div>
                <ul style={{ marginTop: 8 }}>{(patient?.medicalHistory?.allergies || []).length ? patient.medicalHistory.allergies.map((a, i) => <li key={i}>{a}</li>) : <li>No allergies recorded</li>}</ul>
              </div>
              <div style={{ height: 12 }} />
              <div style={{ ...glassBase, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Vaccination Records</div>
                <ul style={{ marginTop: 8 }}>{(patient?.medicalHistory?.vaccinationRecords || []).length ? patient.medicalHistory.vaccinationRecords.map((v, i) => <li key={i}>{v}</li>) : <li>No vaccination records</li>}</ul>
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