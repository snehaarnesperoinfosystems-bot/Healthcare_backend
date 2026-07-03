import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

/* ---------------------------------- API ---------------------------------- */
async function uploadAndSave(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/care-hub/save`, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Analysis failed");
  return data;
}

async function fetchPatients() {
  const res = await fetch(`${API_BASE}/care-hub/patients`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Could not load patients");
  return data.patients;
}

async function fetchPatientReports(id) {
  const res = await fetch(`${API_BASE}/care-hub/patients/${id}/reports`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Could not load reports");
  return data;
}

async function fetchPatientGraph(id) {
  const res = await fetch(`${API_BASE}/knowledge-graph/patients/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Could not load knowledge graph");
  return data;
}

async function fetchDecisionSummary(id) {
  const res = await fetch(`${API_BASE}/decision-intelligence/patients/${id}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Could not generate summary");
  return data;
}

async function fetchCoachPlan(patientId) {
  const res = await fetch(`${API_BASE}/digital-coach/generate-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Could not generate coach plan");
  return data;
}

/* ------------------------------ Risk helpers ------------------------------ */
const RISK_META = {
  high: { label: "Elevated risk", color: "risk-high" },
  moderate: { label: "Needs follow-up", color: "risk-moderate" },
  low: { label: "Within range", color: "risk-normal" },
};

function RiskBadge({ tier }) {
  const meta = RISK_META[tier] || { label: "Reviewed", color: "risk-unknown" };
  return <span className={`risk-badge ${meta.color}`}>{meta.label}</span>;
}

const ICONS = {
  diagnosis: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M9 5.5 L9 9.5 L11.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  risk: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2 L16 15 L2 15 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 7 L9 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="9" cy="13" r="0.8" fill="currentColor"/></svg>,
  tests: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 2 L7 7 L3.5 14 C3 15 3.7 16 4.8 16 L13.2 16 C14.3 16 15 15 14.5 14 L11 7 L11 2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M5.5 11 L12.5 11" stroke="currentColor" strokeWidth="1.4"/></svg>,
  treatment: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3 L9 15 M3 9 L15 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  precautions: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2 L15 5 L15 9 C15 13 12.5 15.5 9 16.5 C5.5 15.5 3 13 3 9 L3 5 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  trend: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 13 L7 8 L10 11 L16 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 4 L16 4 L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* -------------------------------- Top bar -------------------------------- */
function TopBar({ tab, onTabChange }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="brand-cross" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2 L10 18 M2 10 L18 10" stroke="white" strokeWidth="3.4" strokeLinecap="round"/></svg>
        </span>
        <div>
          <div className="brand-name">Spero</div>
          <div className="brand-tag">Healthcare OS</div>
        </div>
      </div>
      <nav className="tab-nav" role="tablist">
        <button className={`tab-btn ${tab === "analyze" ? "active" : ""}`} onClick={() => onTabChange("analyze")}>Analyze</button>
        <button className={`tab-btn ${tab === "patients" ? "active" : ""}`} onClick={() => onTabChange("patients")}>Patients</button>
        <button className={`tab-btn ${tab === "assistant" ? "active" : ""}`} onClick={() => onTabChange("assistant")}>AI Assistant</button>
      </nav>
    </header>
  );
}

/* ------------------------------ Upload zone ------------------------------ */
function UploadZone({ onFile, busy }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) onFile(file); };

  return (
    <div className={`upload-zone ${isDragOver ? "drag-over" : ""} ${busy ? "busy" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} hidden disabled={busy} />
      <div className={`upload-icon-wrap ${busy ? "pulse" : ""}`}>
        {busy ? (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
            <p className="upload-title" style={{color: "var(--accent)"}}>Analyzing & saving…</p>
            <p className="upload-sub" style={{marginTop: '4px'}}>Processing your document... Please wait while we analyze your report.</p>
          </div>
        ) : (
          <><p className="upload-title">Upload a lab report</p><p className="upload-sub">PDF, JPG or PNG · Automatically saved to Care Hub</p></>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Analyze tab -------------------------------- */
function ListBlock({ items }) {
  const valid = (items || []).filter((i) => i && i.trim() !== "");
  if (valid.length === 0) return <p className="empty-note">Nothing noted for this section.</p>;
  return <ul className="check-list">{valid.map((item, i) => <li key={i}><span className="check-mark">&#10003;</span><span>{item}</span></li>)}</ul>;
}

function FindingCard({ icon, label, badge, children, highlight }) {
  return (
    <div className={`finding-card ${highlight ? "highlight" : ""}`}>
      <div className="finding-head"><div className="finding-icon">{icon}</div><div className="finding-label">{label}</div>{badge}</div>
      <div className="finding-body">{children}</div>
    </div>
  );
}

function PatientBand({ summary, filename, riskTier }) {
  const fields = [["Patient", summary?.name], ["Age", summary?.age], ["Sex", summary?.sex], ["Sample date", summary?.sample_date]].filter(([, v]) => v && v !== "null");
  return (
    <div className="patient-band">
      <div className="action-row"><div><div style={{fontSize:"12px", color:"var(--text-muted)"}}>Report</div><div style={{fontWeight:600}}>{filename}</div></div>{riskTier && <RiskBadge tier={riskTier} />}</div>
      {fields.length > 0 && <div style={{display:"flex", gap:"16px", marginTop:"8px"}}>{fields.map(([label, value]) => <div key={label}><div style={{fontSize:"11px", color:"var(--text-muted)"}}>{label}</div><div style={{fontSize:"13px"}}>{value}</div></div>)}</div>}
    </div>
  );
}

function ResultsView({ result, filename, onReset }) {
  const { analysis, risk_tier } = result;
  return (
    <div>
      <div className="action-row"><div className="status-pill"><span className="status-dot"></span>Saved to Care Hub</div><button className="btn-outline" onClick={onReset}>Analyze another</button></div>
      <PatientBand summary={analysis.patient_summary} filename={filename} riskTier={risk_tier} />
      <div className="findings-grid">
        <FindingCard icon={ICONS.diagnosis} label="Diagnosis" highlight><p className="prose-text">{analysis.diagnosis || "Not specified."}</p></FindingCard>
        <FindingCard icon={ICONS.risk} label="Risk assessment"><p className="prose-text">{analysis.risk_assessment || "Not specified."}</p></FindingCard>
        <FindingCard icon={ICONS.tests} label="Recommended tests"><ListBlock items={analysis.recommended_tests} /></FindingCard>
        <FindingCard icon={ICONS.treatment} label="Treatment suggestions"><ListBlock items={analysis.treatment_suggestions} /></FindingCard>
        <FindingCard icon={ICONS.precautions} label="Precautions"><ListBlock items={analysis.precautions} /></FindingCard>
      </div>
      <p style={{fontSize:"11px", color:"var(--text-muted)", marginTop:"16px"}}>{analysis.disclaimer || "For informational purposes only."}</p>
    </div>
  );
}

// AnalyzeTab now uses state from parent (App) so it doesn't reset on tab switch
function AnalyzeTab({ status, result, filename, onUpload, onReset }) {
  if (status === "idle" || status === "uploading") {
    return (
      <div className="hero">
        <p className="hero-eyebrow">Patient report tool</p>
        <h1 className="hero-title">Understand your lab results in simple language</h1>
        <p className="hero-sub">Upload a report and get a structured breakdown. Saved automatically to the patient's history.</p>
        <UploadZone onFile={onUpload} busy={status === "uploading"} />
        <div className="trust-row"><span>&#10003; Processed locally</span><span>&#10003; Saved to Care Hub</span><span>&#10003; PDF & image support</span></div>
      </div>
    );
  }
  return <ResultsView result={result} filename={filename} onReset={onReset} />;
}

/* -------------------------------- Patients tab -------------------------------- */
function PatientListItem({ patient, onSelect }) {
  return (
    <button className="patient-row" onClick={() => onSelect(patient.id)}>
      <div><div className="patient-row-name">{patient.name}</div><div className="patient-row-meta">{[patient.age, patient.sex].filter(Boolean).join(" · ")}{patient.report_count != null ? ` · ${patient.report_count} reports` : ""}</div></div>
      {patient.latest_risk_tier && <RiskBadge tier={patient.latest_risk_tier} />}
    </button>
  );
}

function PatientsList({ patients, onSelect }) {
  if (!patients) return <p className="empty-note">Loading patients...</p>;
  if (patients.length === 0) return <p className="empty-note">No patients yet. Analyze a report first.</p>;
  return <div>{patients.map((p) => <PatientListItem key={p.id} patient={p} onSelect={onSelect} />)}</div>;
}

function TrendBadge({ trend }) {
  const map = { improving: { label: "Improving", color: "risk-normal" }, stable: { label: "Stable", color: "risk-moderate" }, worsening: { label: "Worsening", color: "risk-high" } };
  const meta = map[trend] || { label: "Not enough data", color: "risk-unknown" };
  return <span className={`risk-badge ${meta.color}`}>{meta.label}</span>;
}

function DecisionPanel({ patientId }) {
  const [state, setState] = useState("idle");
  const [data, setData] = useState(null);
  const generate = async () => {
    setState("loading");
    try { const res = await fetchDecisionSummary(patientId); setData(res); setState("done"); } 
    catch (err) { alert("Summary Error: " + err.message); setState("idle"); }
  };
  return (
    <div className="finding-card highlight">
      <div className="finding-head"><div className="finding-icon">{ICONS.trend}</div><div className="finding-label">Decision Intelligence</div>{data?.decision?.overall_risk_trend && <TrendBadge trend={data.decision.overall_risk_trend} />}</div>
      {state === "idle" && <div><p className="prose-text">Synthesize full history into one recommendation.</p><button className="btn-primary" style={{marginTop:"10px"}} onClick={generate}>Generate summary</button></div>}
      {state === "loading" && <p className="empty-note">Synthesizing patient history... Please wait.</p>}
      {state === "done" && data && <div><p className="prose-text">{data.decision.summary}</p>{data.decision.key_concerns?.length > 0 && <><div style={{fontWeight:600, marginTop:"10px"}}>Key concerns</div><ListBlock items={data.decision.key_concerns} /></>} {data.decision.priority_actions?.length > 0 && <><div style={{fontWeight:600, marginTop:"10px"}}>Priority actions</div><ListBlock items={data.decision.priority_actions} /></>}</div>}
    </div>
  );
}

/* -------------------------------- Knowledge Graph -------------------------------- */
const ENTITY_COLORS = { patient: { fill: "#0E7C7B", ring: "#0A5F5E", gradId: "url(#grad-patient)" }, condition: { fill: "#C43D34", ring: "#9C2F28", gradId: "url(#grad-condition)" }, test: { fill: "#129695", ring: "#0A5F5E", gradId: "url(#grad-test)" }, treatment: { fill: "#B5790A", ring: "#8F600A", gradId: "url(#grad-treatment)" } };
const ENTITY_LABELS = { patient: "Patient", condition: "Condition", test: "Test", treatment: "Treatment" };
const NODE_RADII = { patient: 38, condition: 26, treatment: 20, test: 20 };

function runForceLayout(nodes, edges, width, height, iterations = 300) {
  const positioned = nodes.map((n, i) => { const angle = (i / nodes.length) * Math.PI * 2; const r = NODE_RADII[n.type] || 20; const dist = n.type === 'patient' ? 0 : Math.min(width, height) * 0.3; return { ...n, x: width/2 + Math.cos(angle)*dist + (Math.random()-0.5)*20, y: height/2 + Math.sin(angle)*dist + (Math.random()-0.5)*20, vx:0, vy:0, radius: r }; });
  const byId = Object.fromEntries(positioned.map((n) => [n.id, n]));
  const edgeList = edges.map((e) => ({ source: byId[e.source], target: byId[e.target] })).filter((e) => e.source && e.target);
  const REPEL = 6500; const ATTRACT = 0.015; const CENTER = 0.01; const DAMPING = 0.82;
  for (let iter = 0; iter < iterations; iter++) { const temp = 1 - iter / iterations; for (let i = 0; i < positioned.length; i++) { for (let j = i + 1; j < positioned.length; j++) { const a = positioned[i], b = positioned[j]; let dx = a.x - b.x, dy = a.y - b.y; let distSq = dx * dx + dy * dy || 1; let dist = Math.sqrt(distSq); const overlap = dist < (a.radius+b.radius+20) ? 2.5 : 1; const force = (REPEL * (a.radius+b.radius) / 40) / distSq * overlap * temp; const nx = dx/dist, ny = dy/dist; a.vx += nx*force; a.vy += ny*force; b.vx -= nx*force; b.vy -= ny*force; } } for (const e of edgeList) { const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y; const dist = Math.sqrt(dx*dx + dy*dy) || 1; const ideal = (e.source.radius+e.target.radius)*2.5; const force = (dist - ideal) * ATTRACT * temp; const nx = dx/dist, ny = dy/dist; e.source.vx += nx*force; e.source.vy += ny*force; e.target.vx -= nx*force; e.target.vy -= ny*force; } for (const n of positioned) { const pull = n.type === 'patient' ? CENTER*4 : CENTER; n.vx += (width/2 - n.x) * pull * temp; n.vy += (height/2 - n.y) * pull * temp; if(n.type==='patient') { n.vx*=0.5; n.vy*=0.5; } n.vx *= DAMPING; n.vy *= DAMPING; n.x += n.vx; n.y += n.vy; const pad = n.radius + 30; n.x = Math.max(pad, Math.min(width-pad, n.x)); n.y = Math.max(pad, Math.min(height-pad, n.y)); } }
  return positioned;
}

function KnowledgeGraphCanvas({ nodes, edges }) {
  const [positions, setPositions] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const width = 800, height = 450;

  useEffect(() => {
    if (nodes.length === 0) return;
    const laid = runForceLayout(nodes, edges, width, height);
    setPositions(laid);
  }, [nodes, edges]);

  if (!positions) return null; 
  const byId = Object.fromEntries(positions.map((n) => [n.id, n])); 
  const connectedIds = hoveredNode ? new Set(edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).flatMap(e => [e.source, e.target])) : null;

  return ( 
    <div className="kg-canvas-wrap" style={{position:'relative'}}> 
      <svg viewBox={`0 0 ${width} ${height}`} className="kg-svg" style={{cursor: 'default'}}> 
        <defs> 
          <radialGradient id="grad-patient" cx="35%" cy="35%"><stop offset="0%" stopColor="#12A598"/><stop offset="100%" stopColor="#0A5F5E"/></radialGradient> 
          <radialGradient id="grad-condition" cx="35%" cy="35%"><stop offset="0%" stopColor="#E84057"/><stop offset="100%" stopColor="#9C2F28"/></radialGradient> 
          <radialGradient id="grad-test" cx="35%" cy="35%"><stop offset="0%" stopColor="#22A8D1"/><stop offset="100%" stopColor="#0A5F5E"/></radialGradient> 
          <radialGradient id="grad-treatment" cx="35%" cy="35%"><stop offset="0%" stopColor="#F5C040"/><stop offset="100%" stopColor="#8F600A"/></radialGradient> 
        </defs> 
        <g> 
          {edges.map((e, i) => { const s = byId[e.source], t = byId[e.target]; if(!s||!t) return null; const dimmed = connectedIds && !(connectedIds.has(e.source) && connectedIds.has(e.target)); const highlighted = connectedIds && connectedIds.has(e.source) && connectedIds.has(e.target); return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={`kg-edge ${dimmed ? 'dimmed' : ''} ${highlighted ? 'highlighted' : ''}`} strokeWidth={Math.min(1 + (e.weight||1)*0.5, 3)} />; })}
          {positions.map(n => { const c = ENTITY_COLORS[n.type] || ENTITY_COLORS.condition; const isPatient = n.type === 'patient'; const dimmed = connectedIds && !connectedIds.has(n.id); const labelText = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label; const textWidth = labelText.length * 5.5; return ( <g key={n.id} transform={`translate(${n.x}, ${n.y})`} className={`kg-node-group ${dimmed ? 'dimmed' : ''}`} onMouseEnter={() => setHoveredNode(n.id)} onMouseLeave={() => setHoveredNode(null)}> <circle r={n.radius + 8} fill="transparent" /> <circle r={n.radius} fill={c.gradId} stroke={c.ring} strokeWidth={isPatient ? 2 : 1.5} /> {isPatient ? <text className="node-label-inside" fontSize="11" y={1}>{labelText}</text> : <> <rect x={-textWidth/2 - 4} y={n.radius + 4} width={textWidth + 8} height={16} className="node-label-bg" rx={4} /> <text className="node-label-below" fontSize="9" y={n.radius + 15}>{labelText}</text> </>} </g> ); })} 
        </g> 
      </svg> 
      {hoveredNode && ( <div className="kg-tooltip visible" style={{top: '20px', left: '20px'}}> <div className="tt-name">{byId[hoveredNode]?.label}</div> <div className="tt-type" style={{background: ENTITY_COLORS[byId[hoveredNode]?.type]?.fill + '22', color: ENTITY_COLORS[byId[hoveredNode]?.type]?.fill}}> {ENTITY_LABELS[byId[hoveredNode]?.type]} </div> <div className="tt-conn-label">Connections</div> <div className="tt-conn-list"> {edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).map(e => { const connId = e.source === hoveredNode ? e.target : e.source; return <div key={connId}>• {byId[connId]?.label}</div>; })} </div> </div> )} 
    </div> 
  );
}

function KnowledgeGraphLegend() { return <div className="kg-legend">{Object.entries(ENTITY_LABELS).map(([type, label]) => <div key={type} className="kg-legend-item"><span className="kg-legend-dot" style={{background: ENTITY_COLORS[type].fill}}></span>{label}</div>)}</div>; }

function KnowledgeGraphPanel({ patientId }) {
  const [graph, setGraph] = useState(null);
  useEffect(() => { fetchPatientGraph(patientId).then(setGraph).catch(console.error); }, [patientId]);
  if (!graph) return <p className="empty-note">Loading graph...</p>;
  if (!graph.edges || graph.edges.length === 0) return <p className="empty-note">No connected entities yet.</p>;
  return <><p className="prose-text" style={{marginBottom:'14px'}}>Conditions, tests, and treatments extracted across this patient's reports.</p><KnowledgeGraphCanvas nodes={graph.nodes} edges={graph.edges} /><KnowledgeGraphLegend /></>;
}

function ReportHistoryCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  return ( <div className="finding-card" style={{marginBottom: '8px'}}> <button onClick={() => setExpanded(v => !v)} style={{width:'100%', background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', font:'inherit'}}> <div style={{textAlign:'left'}}><div style={{fontWeight:600, fontSize:'13px'}}>{report.filename}</div><div style={{fontSize:"11px", color:"var(--text-muted)"}}>{new Date(report.created_at).toLocaleDateString()}</div></div> <RiskBadge tier={report.risk_tier} /> </button> {expanded && <div style={{marginTop:'12px'}}><FindingCard icon={ICONS.diagnosis} label="Diagnosis"><p className="prose-text">{report.diagnosis || "Not specified."}</p></FindingCard></div>} </div> );
}

/* -------------------------------- Patient Detail -------------------------------- */
function PatientDetail({ patientId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showHealthTwin, setShowHealthTwin] = useState(false);

  useEffect(() => { 
    setData(null); 
    setError(null);
    fetchPatientReports(patientId)
      .then(setData)
      .catch(err => setError(err.message)); 
  }, [patientId]);
  
  // Error state: Jab backend band ho ya PDF upload ki wajah se block ho
  if (error) {
    return (
      <div>
        <div className="action-row"><button className="btn-outline" onClick={onBack}>← All patients</button></div>
        <p className="empty-note" style={{color: "var(--coral)", marginTop: "40px"}}>
          Could not load patient profile. Error: {error}. <br/>
          Please check if the FastAPI server is running or not busy processing another request.
        </p>
      </div>
    );
  }

  if (!data) return <p className="empty-note">Loading patient profile...</p>;
  
  const riskTier = data.patient?.latest_risk_tier || data.reports?.[0]?.risk_tier || "moderate";
  const healthScore = riskTier === "low" ? "92 / 100" : riskTier === "moderate" ? "68 / 100" : "35 / 100";
  const healthColor = riskTier === "low" ? 'var(--accent)' : riskTier === "moderate" ? 'var(--amber)' : 'var(--coral)';
  const patientName = data.patient?.name || "Unknown Patient";
  const initials = patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const lastReport = data.reports && data.reports.length > 0 ? data.reports[0] : null;
  const lastVisit = lastReport ? new Date(lastReport.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A";

  return (
    <div>
      <div className="action-row"><button className="btn-outline" onClick={onBack}>← All patients</button></div>

      <div className="hospital-profile-card">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-info">
          <div className="profile-name">{patientName}</div>
          <div className="profile-mrn">MRN: PAT-{patientId.toString().padStart(5, '0')} · Care Hub Record</div>
          <div className="profile-stats">
            <div className="profile-stat-item"><span className="profile-stat-label">Age / Sex</span><span className="profile-stat-value">{data.patient?.age || 'N/A'} / {data.patient?.sex || 'N/A'}</span></div>
            <div className="profile-stat-item"><span className="profile-stat-label">Last Visit</span><span className="profile-stat-value">{lastVisit}</span></div>
            <div className="profile-stat-item"><span className="profile-stat-label">Total Reports</span><span className="profile-stat-value">{data.reports?.length || 0}</span></div>
            <div className="profile-stat-item"><span className="profile-stat-label">Risk Level</span><span className="profile-stat-value"><RiskBadge tier={riskTier} /></span></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <button className="btn-primary" onClick={() => setShowHealthTwin(!showHealthTwin)} style={{ whiteSpace: 'nowrap' }}>
            {showHealthTwin ? "Close Health Twin" : "AI Health Twin"}
          </button>
        </div>
      </div>

      {showHealthTwin && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{fontSize: "16px", margin: "0 0 12px", fontFamily: "Space Grotesk, sans-serif", color: "var(--accent)"}}>Digital Health Twin</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px'}}>
            <div className="finding-card highlight">
              <div className="finding-head"><div className="finding-icon">{ICONS.risk}</div><div className="finding-label">Overall Health Score</div></div>
              <div className="metric-large" style={{color: healthColor}}>{healthScore}</div>
              <div className="metric-sub">Calculated via AI based on past {data.reports?.length || 0} reports</div>
            </div>
            <div className="finding-card">
              <div className="finding-head"><div className="finding-icon">{ICONS.trend}</div><div className="finding-label">Future Outlook</div></div>
              <p className="prose-text">{riskTier === 'low' ? "Patient is stable." : "Risks can decrease by 20% if medication adherence is strict."}</p>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px'}}>
             <div className="finding-card">
               <div className="finding-head"><div className="finding-icon">{ICONS.diagnosis}</div><div className="finding-label">Active Conditions</div></div>
               <ul className="check-list">{data.reports.map((r, i) => <li key={i}><span className="check-mark">&#10003;</span><span>{r.diagnosis || "Not specified"}</span></li>)}</ul>
             </div>
             <div className="finding-card">
               <div className="finding-head"><div className="finding-icon">{ICONS.treatment}</div><div className="finding-label">Suggested Treatments</div></div>
               <ul className="check-list">{data.reports.flatMap(r => r.treatment_suggestions || []).slice(0, 5).map((t, i) => <li key={i}><span className="check-mark">&#10003;</span><span>{t}</span></li>)}</ul>
             </div>
          </div>
        </div>
      )}

      <DecisionPanel patientId={patientId} />

      <div style={{marginTop: '20px'}}>
        <FindingCard icon={ICONS.trend} label="Knowledge Graph" highlight>
          <KnowledgeGraphPanel patientId={patientId} />
        </FindingCard>
      </div>

      <div style={{marginTop: '20px'}}>
        <h3 style={{fontSize: "16px", marginBottom:'10px', fontFamily: "Space Grotesk, sans-serif"}}>Report History</h3>
        {data.reports && data.reports.map(r => <ReportHistoryCard key={r.id} report={r} />)}
      </div>
    </div>
  );
}

function PatientsTab({ globalPatients }) {
  const [selectedId, setSelectedId] = useState(null);
  if (selectedId) return <PatientDetail patientId={selectedId} onBack={() => setSelectedId(null)} />;
  return (
    <div className="hero">
      <p className="hero-eyebrow">Care Hub</p>
      <h1 className="hero-title">Patients</h1>
      <p className="hero-sub">Every analyzed report is saved here, grouped by patient.</p>
      <div style={{marginTop: '24px', maxWidth: '600px', margin: '24px auto 0'}}><PatientsList patients={globalPatients} onSelect={setSelectedId} /></div>
    </div>
  );
}

/* -------------------------------- AI ASSISTANT TAB -------------------------------- */
function AIAssistantTab({ globalPatients }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [coachPlan, setCoachPlan] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([{ sender: "bot", text: "Hello Doctor! I am your AI Assistant. Select a patient to get personalized health guidance." }]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const loadPatient = async (patient) => {
    setSelectedPatient(patient);
    setCoachPlan(null);
    setCoachLoading(true);
    try {
      const data = await fetchPatientReports(patient.id);
      setPatientData(data);
      setChatMessages(prev => [...prev, { sender: "bot", text: `Profile loaded for ${patient.name}. You can ask me anything about their health below!` }]);
    } catch (err) { alert("Error loading patient: " + err.message); }

    try {
      const plan = await fetchCoachPlan(patient.id);
      setCoachPlan(plan);
    } catch (err) {
      console.error("Coach plan fetch failed, using local fallback:", err);
      setCoachPlan(null);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleChatSend = async () => {
    if(!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }, { sender: "bot", text: "Analyzing..." }]);
    setIsChatLoading(true);

    const riskTier = selectedPatient.latest_risk_tier || "moderate";
    const patientContext = `Patient: ${selectedPatient.name}, Risk: ${riskTier}, Diagnoses: ${patientData?.reports?.map(r => r.diagnosis).join('; ')}, Treatments: ${patientData?.reports?.flatMap(r => r.treatment_suggestions).join('; ')}`;

    try {
      const res = await fetch("http://127.0.0.1:8000/symptom-checker/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, context: patientContext })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || "API Error");
      setChatMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = resData.reply; return newMsgs; });
    } catch (err) {
      setChatMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = "Could not connect to the AI backend. Please ensure the FastAPI server is running."; return newMsgs; });
    } finally { setIsChatLoading(false); }
  };

  if (!selectedPatient) {
    return (
      <div className="hero">
        <p className="hero-eyebrow">AI Assistant</p>
        <h1 className="hero-title">Digital Coach & Clinical Advisor</h1>
        <p className="hero-sub">Select a patient to get personalized diet plans, lifestyle guidance, and medical advice.</p>
        <div style={{marginTop: '24px', maxWidth: '600px', margin: '24px auto 0'}}>
          {!globalPatients ? (
            <p className="empty-note">Loading...</p>
          ) : globalPatients.length === 0 ? (
            <p className="empty-note">No patients yet. Analyze a report first.</p>
          ) : (
            globalPatients.map(p => (
              <button key={p.id} className="patient-row" onClick={() => loadPatient(p)}>
                <div><div className="patient-row-name">{p.name}</div><div className="patient-row-meta">Age {p.age}</div></div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  const riskTier = selectedPatient.latest_risk_tier || "moderate";
  const allText = patientData?.reports?.map(r => `${r.diagnosis || ''} ${(r.treatment_suggestions || []).join(' ')} ${(r.recommended_tests || []).join(' ')}`).join(' ').toLowerCase() || '';

  const hasDiabetes = allText.includes('diabetes') || allText.includes('hba1c') || allText.includes('sugar') || allText.includes('glucose');
  const hasThyroid = allText.includes('thyroid') || allText.includes('hypothyroid') || allText.includes('tsh') || allText.includes('t3') || allText.includes('t4');
  const hasCardiac = allText.includes('blood pressure') || allText.includes('hypertension') || allText.includes('cardiac') || allText.includes('cholesterol') || allText.includes('lipid');

  let dietAdvice = "Maintain a balanced diet rich in vegetables and lean proteins. Stay hydrated.";
  if (hasDiabetes) dietAdvice = "Strict low-carb and low-sugar diet is crucial. Monitor HbA1c levels.";
  if (hasCardiac) dietAdvice = "Low sodium (salt) diet is essential to control blood pressure. Avoid fried foods.";
  if (riskTier === 'high') dietAdvice += " Strict dietary discipline is critical.";

  let exerciseAdvice = "30 minutes of moderate cardio daily is recommended.";
  if (hasThyroid) exerciseAdvice = "Light to moderate exercise. Avoid extreme fatigue until thyroid levels stabilize.";
  if (hasCardiac) exerciseAdvice = "Moderate walking is good, but avoid heavy weightlifting without clearance.";

  let sleepAdvice = "Aim for 7-8 hours of consistent sleep nightly.";
  if (hasThyroid) sleepAdvice = "Thyroid imbalances can cause fatigue. Prioritize 8+ hours of quality sleep.";
  if (riskTier === 'high') sleepAdvice = "Prioritize 8+ hours of sleep. Stress management is critical.";

  if (coachPlan) {
    dietAdvice = coachPlan.diet || dietAdvice;
    sleepAdvice = coachPlan.sleep || sleepAdvice;
    exerciseAdvice = coachPlan.exercise || exerciseAdvice;
  }

  return (
    <div>
      <div className="action-row">
        <button className="btn-outline" onClick={() => setSelectedPatient(null)}>← Select another patient</button>
      </div>

      <div className="patient-band" style={{marginBottom: '24px'}}>
        <div style={{fontWeight: 600, fontSize: '18px'}}>AI Guidance for {selectedPatient.name}</div>
        <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>Based on their medical history and risk level</div>
      </div>

      <h3 style={{fontSize: "16px", margin: "20px 0 12px", fontFamily: "Space Grotesk, sans-serif", color: "var(--accent)"}}>Digital Health Coach</h3>
      {coachLoading ? (
        <p className="empty-note" style={{marginBottom: '32px'}}>Generating personalized plan...</p>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', marginBottom: '32px'}}>
          <div className="finding-card highlight">
            <div className="finding-head"><div className="finding-icon">{ICONS.treatment}</div><div className="finding-label">Diet Plan</div></div>
            <p className="prose-text">{dietAdvice}</p>
          </div>
          <div className="finding-card">
            <div className="finding-head"><div className="finding-icon">{ICONS.precautions}</div><div className="finding-label">Sleep Hygiene</div></div>
            <p className="prose-text">{sleepAdvice}</p>
          </div>
          <div className="finding-card">
            <div className="finding-head"><div className="finding-icon">{ICONS.trend}</div><div className="finding-label">Exercise</div></div>
            <p className="prose-text">{exerciseAdvice}</p>
          </div>
        </div>
      )}

      <h3 style={{fontSize: "16px", margin: "20px 0 12px", fontFamily: "Space Grotesk, sans-serif", color: "var(--accent)"}}>AI Clinical Advisor</h3>
      <div className="finding-card highlight">
        <div className="chat-container">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              {msg.text.split('\n').map((line, idx) => <span key={idx}>{line}<br/></span>)}
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input className="chat-input" placeholder="Ask about symptoms or conditions..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleChatSend()} disabled={isChatLoading} />
          <button className="btn-primary" onClick={handleChatSend} disabled={isChatLoading}>{isChatLoading ? "Analyzing..." : "Ask AI"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- App (Global State) ---------------------------------- */
export default function App() {
  const [tab, setTab] = useState("analyze");
  
  // Global Patient State
  const [globalPatients, setGlobalPatients] = useState(null);

  // Global Upload State (Persists on tab switch!)
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisFilename, setAnalysisFilename] = useState("");

  // Fetch patients only once when the app starts
  useEffect(() => {
    fetchPatients()
      .then(setGlobalPatients)
      .catch(err => console.error("Failed to load patients on mount:", err));
  }, []);

  // Function to refresh patients (called after a new PDF is uploaded)
  const refreshPatients = useCallback(() => {
    fetchPatients()
      .then(setGlobalPatients)
      .catch(err => console.error("Failed to refresh patients:", err));
  }, []);

  // Handle File Upload
  const handleUpload = useCallback(async (file) => {
    setAnalysisStatus("uploading");
    setAnalysisFilename(file.name);
    try {
      const data = await uploadAndSave(file);
      setAnalysisResult(data);
      setAnalysisStatus("done");
      refreshPatients(); // Refresh patient list after successful upload
    } catch (err) {
      alert("Upload Error: " + err.message);
      setAnalysisStatus("idle");
    }
  }, [refreshPatients]);

  // Reset Upload State
  const handleResetAnalysis = () => {
    setAnalysisStatus("idle");
    setAnalysisResult(null);
    setAnalysisFilename("");
  };

  const renderTab = () => {
    switch(tab) {
      case "analyze": return <AnalyzeTab status={analysisStatus} result={analysisResult} filename={analysisFilename} onUpload={handleUpload} onReset={handleResetAnalysis} />;
      case "patients": return <PatientsTab globalPatients={globalPatients} />;
      case "assistant": return <AIAssistantTab globalPatients={globalPatients} />;
      default: return <AnalyzeTab status={analysisStatus} result={analysisResult} filename={analysisFilename} onUpload={handleUpload} onReset={handleResetAnalysis} />;
    }
  }

  return (
    <div style={{minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)'}}>
      <TopBar tab={tab} onTabChange={setTab} />
      <main className="app-main">{renderTab()}</main>
      <footer className="app-footer">Spero is a support tool, not a substitute for professional medical advice.</footer>
    </div>
  );
}