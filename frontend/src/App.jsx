import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE = "http://127.0.0.1:8000";

/* ---------------------------------- API ---------------------------------- */
async function uploadAndSave(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/care-hub/save`, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Analysis failed");
  data.uploadedFilename = file.name; 
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

async function updatePatientNameApi(patientId, newName) {
  const res = await fetch(`${API_BASE}/care-hub/patients/${patientId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName })
  });
  if (!res.ok) throw new Error("Failed to update name");
  return res.json();
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

/* -------------------------------- Login Screen -------------------------------- */
function LoginScreen({ onLogin, darkMode, setDarkMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === "doctor@spero.com" && password === "spero123") {
      localStorage.setItem("spero_doc_auth", "true");
      onLogin();
    } else {
      setError("Invalid credentials. Please try again.");
    }
  };

  // 🟢 Aapka background image yahan jaisa hai waisa hi rakha gaya hai
  const BG_IMG_URL = "/background.png"; 
  const LOGO_ICON = "/spero-bg.jpg";

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: 'white',
    outline: 'none',
    transition: 'all 0.3s'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '40px 60px',
      position: 'relative',
      backgroundImage: `url(${BG_IMG_URL})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      fontFamily: 'Space Grotesk, sans-serif'
    }}>
      
      <div style={{ 
        position: 'absolute', 
        top: 0, left: 0, right: 0, bottom: 0, 
        background: 'linear-gradient(105deg, rgba(0,0,0,0.8) 0%, rgba(10,20,40,0.6) 60%, rgba(0,0,0,0.3) 100%)',
        zIndex: 1
      }}></div>

      <div style={{
        position: 'relative',
        zIndex: 2,
        display: window.innerWidth > 768 ? 'flex' : 'none',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '400px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src={LOGO_ICON} 
            alt="Spero Logo" 
            style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              objectFit: 'cover', 
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}
          />
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'white', lineHeight: 1 }}>Spero</div>
            <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginTop: '2px' }}>Healthcare OS</div>
          </div>
        </div>
        
        <h1 style={{ 
          margin: '20px 0 0 0', 
          fontSize: '36px', 
          fontWeight: '700', 
          color: 'white',
          lineHeight: '1.3',
          textShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          Clinical Decision Support System for modern healthcare.
        </h1>
        <p style={{ 
          margin: '0', 
          fontSize: '15px', 
          lineHeight: '1.6', 
          color: 'rgba(255,255,255,0.7)'
        }}>
          Secure, intelligent, and patient-centric.
        </p>
      </div>

      <div style={{ 
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: 'rgba(15, 23, 42, 0.65)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        color: 'white'
      }}>
        
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: 'white' }}>
          Welcome back, Doctor
        </h2>
        <p style={{ margin: '0 0 28px 0', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
          Secure access to Spero Healthcare OS
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="Doctor ID (Email)" 
            required 
            style={inputStyle}
            onFocus={(e) => { e.target.style.border = '1px solid var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(14, 124, 123, 0.2)'; }}
            onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
          
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="Password" 
            required 
            style={inputStyle}
            onFocus={(e) => { e.target.style.border = '1px solid var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(14, 124, 123, 0.2)'; }}
            onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />

          {error && (
            <p style={{ 
              color: '#ffcccc', 
              fontSize: '13px', 
              textAlign: 'center', 
              background: 'rgba(239, 68, 68, 0.15)', 
              padding: '12px', 
              borderRadius: '10px', 
              border: '1px solid rgba(239,68,68,0.3)',
              margin: 0
            }}>
              {error}
            </p>
          )}

          <button 
            type="submit" 
            style={{ 
              marginTop: '8px',
              padding: '15px', 
              fontSize: '15px', 
              fontWeight: '700', 
              background: 'linear-gradient(90deg, var(--accent) 0%, #16a3a2 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '12px', 
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 8px 20px rgba(14, 124, 123, 0.3)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(14, 124, 123, 0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(14, 124, 123, 0.3)'; }}
          >
            Secure Login
          </button>
        </form>
        
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'rgba(255,255,255,0.6)', 
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>🔒 Authorized only</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Top bar -------------------------------- */
function TopBar({ tab, onTabChange, darkMode, setDarkMode, onLogout }) {
  const LOGO_URL = "/spero-bg.jpg";

  return (
    <header className="topbar" style={{ flexDirection: 'column', gap: '12px', paddingBottom: '12px' }}>
      <div style={{ width: '100%', textAlign: 'center', fontSize: '20px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'Space Grotesk, sans-serif', paddingTop: '5px', letterSpacing: '1px' }}>
        Clinical Decision Support System (CDSS)
      </div>

      <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '2px',
            background: 'linear-gradient(135deg, rgba(14, 124, 123, 0.2), rgba(255,255,255,0.1))',
            borderRadius: '12px',
            border: '1px solid var(--border-light)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <img
              src={LOGO_URL}
              alt="Spero Logo"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'cover',
                borderRadius: '10px',
                display: 'block'
              }}
            />
          </div>
          <div>
            <div className="brand-name" style={{ fontSize: '18px', fontWeight: '700', lineHeight: 1.1 }}>Spero</div>
            <div className="brand-tag" style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Healthcare OS</div>
          </div>
        </div>
        
        <nav className="tab-nav" role="tablist">
          <button className={`tab-btn ${tab === "analyze" ? "active" : ""}`} onClick={() => onTabChange("analyze")}>Analyze</button>
          <button className={`tab-btn ${tab === "patients" ? "active" : ""}`} onClick={() => onTabChange("patients")}>Patients</button>
          <button className={`tab-btn ${tab === "assistant" ? "active" : ""}`} onClick={() => onTabChange("assistant")}>AI Assistant</button>
          <button className={`tab-btn ${tab === "wellness" ? "active" : ""}`} onClick={() => onTabChange("wellness")}>Mental Wellness</button>
        </nav>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-outline" onClick={() => setDarkMode(!darkMode)} style={{ padding: '8px 12px' }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="btn-outline" onClick={onLogout} style={{ borderColor: 'var(--coral)', color: 'var(--coral)', padding: '8px 16px', fontWeight: '600' }}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ Upload zone ------------------------------ */
function UploadZone({ onFile, busy, disabled }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); if(disabled) return; const files = e.dataTransfer.files; if (files.length > 0) onFile(files); };

  return (
    <div className={`upload-zone ${isDragOver ? "drag-over" : ""} ${busy ? "busy" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !busy && !disabled && inputRef.current?.click()}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(e) => { const files = e.target.files; if (files.length > 0) onFile(files); }} hidden disabled={busy || disabled} />
      <div className={`upload-icon-wrap ${busy ? "pulse" : ""}`}>
        {busy ? (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
            <p className="upload-title" style={{color: "var(--accent)"}}>Analyzing & saving…</p>
            <p className="upload-sub" style={{marginTop: '4px'}}>Processing your documents... Please wait while we analyze your reports.</p>
          </div>
        ) : (
          <><p className="upload-title">Upload lab report(s)</p><p className="upload-sub">PDF, JPG or PNG · Select multiple files at once · Automatically saved to Care Hub</p></>
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

function ResultsView({ result }) {
  if (result.status === "critical_condition_detected") {
    return <CriticalAlertView result={result} />;
  }
  
  const { analysis, risk_tier } = result;

  return (
    <div>
      <PatientBand summary={analysis.patient_summary} filename={result.uploadedFilename || "Report"} riskTier={risk_tier} />
      <div className="findings-grid">
        <FindingCard icon={ICONS.diagnosis} label="Report Findings Summary" highlight><p className="prose-text">{analysis.diagnosis || "Not specified."}</p></FindingCard>
        <FindingCard icon={ICONS.risk} label="Risk assessment"><p className="prose-text">{analysis.risk_assessment || "Not specified."}</p></FindingCard>
        <FindingCard icon={ICONS.tests} label="Recommended tests"><ListBlock items={analysis.recommended_tests} /></FindingCard>
        <FindingCard icon={ICONS.treatment} label="Possible Management Considerations"><ListBlock items={analysis.treatment_suggestions} /></FindingCard>
        <FindingCard icon={ICONS.precautions} label="Precautions"><ListBlock items={analysis.precautions} /></FindingCard>
      </div>

      <p style={{fontSize:"11px", color:"var(--text-muted)", marginTop:"16px"}}>{analysis.disclaimer || "For informational purposes only."}</p>
    </div>
  );
}

function AnalyzeTab({ status, results, onUpload, onReset }) {
  const [consentGiven, setConsentGiven] = useState(false);

  if (status === "idle" || status === "uploading") {
    return (
      <div className="hero">
        <p className="hero-eyebrow">Patient report tool</p>
        <h1 className="hero-title">Understand your lab results in simple language</h1>
        <p className="hero-sub">Upload a report and get a structured breakdown.</p>
        
        <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            id="consent" 
            checked={consentGiven} 
            onChange={(e) => setConsentGiven(e.target.checked)} 
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <label htmlFor="consent" style={{ fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
            I confirm explicit patient consent has been obtained for AI analysis. (Required)
          </label>
        </div>

        <UploadZone onFile={onUpload} busy={status === "uploading"} disabled={!consentGiven} />
        
        {!consentGiven && <p style={{textAlign: 'center', fontSize: '12px', color: 'var(--coral)', marginTop: '10px'}}>Please obtain patient consent to proceed.</p>}
        
        <div className="trust-row"><span>&#10003; Processed locally</span><span>&#10003; Saved to Care Hub</span><span>&#10003; PDF & image support</span></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="action-row" style={{marginBottom: '24px'}}>
        <div className="status-pill"><span className="status-dot"></span>{results.length} Report(s) Saved to Care Hub</div>
        <button className="btn-outline" onClick={onReset}>Analyze another</button>
      </div>
      
      {results.map((res, i) => (
        <div key={i} style={{marginBottom: '20px'}}>
           <ResultsView result={res} />
           {results.length > 1 && i < results.length - 1 && (
             <hr style={{border: '0', borderTop: '1px solid var(--border-light)', margin: '32px 0'}} />
           )}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Critical Alert View -------------------------------- */
function CriticalAlertView({ result }) {
  return (
    <div style={{
      margin: '24px 0',
      padding: '32px 24px',
      background: 'linear-gradient(135deg, rgba(14, 124, 123, 0.05), rgba(14, 124, 123, 0.02))',
      border: '1px solid var(--accent)',
      borderRadius: '16px',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>🩺</div>
      
      <h2 style={{
        color: 'var(--accent)',
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '22px',
        fontWeight: '600',
        margin: '0 0 10px',
        lineHeight: '1.3'
      }}>
        Please consult your doctor
      </h2>

      <p style={{
        fontSize: '15px',
        color: 'var(--text-primary)',
        lineHeight: '1.6',
        maxWidth: '400px',
        margin: '0 auto 20px'
      }}>
        This report requires a doctor's expert review.
      </p>

      <div style={{
        display: 'inline-block',
        padding: '6px 14px',
        background: 'rgba(14, 124, 123, 0.1)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--accent)',
        fontWeight: '600',
        marginBottom: '20px'
      }}>
        📄 Report: {result.filename}
      </div>

      <p style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginTop: '16px'
      }}>
        AI analysis is limited for this report.
      </p>
    </div>
  );
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
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.edges.length === 0) return <p className="empty-note">No connected entities yet.</p>;
  return <><p className="prose-text" style={{marginBottom:'14px'}}>Conditions, tests, and treatments extracted across this patient's reports.</p><KnowledgeGraphCanvas nodes={graph.nodes} edges={graph.edges} /><KnowledgeGraphLegend /></>;
}

function ReportHistoryCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  return ( 
    <div className="finding-card" style={{marginBottom: '8px'}}> 
      <button onClick={() => setExpanded(v => !v)} style={{width:'100%', background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', font:'inherit'}}> 
        <div style={{textAlign:'left'}}>
          <div style={{fontWeight:600, fontSize:'13px'}}>{report?.filename || "Unknown file"}</div>
          <div style={{fontSize:"11px", color:"var(--text-muted)"}}>{report?.created_at ? new Date(report.created_at).toLocaleDateString() : "N/A"}</div>
        </div> 
        <RiskBadge tier={report?.risk_tier} /> 
      </button> 
      {expanded && (
        <div className="findings-grid" style={{marginTop:'12px'}}>
          <FindingCard icon={ICONS.diagnosis} label="Report Findings Summary" highlight><p className="prose-text">{report?.diagnosis || "Not specified."}</p></FindingCard>
          <FindingCard icon={ICONS.risk} label="Risk assessment"><p className="prose-text">{report?.risk_assessment || "Not specified."}</p></FindingCard>
          <FindingCard icon={ICONS.tests} label="Recommended tests"><ListBlock items={report?.recommended_tests} /></FindingCard>
          <FindingCard icon={ICONS.treatment} label="Possible Management Considerations"><ListBlock items={report?.treatment_suggestions} /></FindingCard>
          <FindingCard icon={ICONS.precautions} label="Precautions"><ListBlock items={report?.precautions} /></FindingCard>
        </div>
      )} 
    </div> 
  );
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
  
  const reports = Array.isArray(data.reports) ? data.reports : [];
  const patientInfo = data.patient || {};

  const riskTier = patientInfo.latest_risk_tier || reports?.[0]?.risk_tier || "moderate";
  const healthScore = riskTier === "low" ? "92 / 100" : riskTier === "moderate" ? "68 / 100" : "35 / 100";
  const healthColor = riskTier === "low" ? 'var(--accent)' : riskTier === "moderate" ? 'var(--amber)' : 'var(--coral)';
  const patientName = patientInfo.name || "Unknown Patient";
  const initials = patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const lastReport = reports.length > 0 ? reports[0] : null;
  const lastVisit = lastReport?.created_at ? new Date(lastReport.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A";

  const chartData = reports.slice().reverse().map(r => ({
    date: r?.created_at ? new Date(r.created_at).toLocaleDateString() : "N/A",
    Risk: r?.risk_tier === 'high' ? 30 : r?.risk_tier === 'moderate' ? 60 : 90
  }));

  return (
    <div>
      <div className="action-row"><button className="btn-outline" onClick={onBack}>← All patients</button></div>

      <div className="hospital-profile-card">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-info">
          <div className="profile-name">{patientName}</div>
          <div className="profile-mrn">MRN: PAT-{patientId.toString().padStart(5, '0')} · Care Hub Record</div>
          <div className="profile-stats">
            <div className="profile-stat-item"><span className="profile-stat-label">Age / Sex</span><span className="profile-stat-value">{patientInfo.age || 'N/A'} / {patientInfo.sex || 'N/A'}</span></div>
            <div className="profile-stat-item"><span className="profile-stat-label">Last Visit</span><span className="profile-stat-value">{lastVisit}</span></div>
            <div className="profile-stat-item"><span className="profile-stat-label">Total Reports</span><span className="profile-stat-value">{reports.length}</span></div>
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
              <div className="metric-sub">Calculated via AI based on past {reports.length} reports</div>
            </div>
            <div className="finding-card">
              <div className="finding-head"><div className="finding-icon">{ICONS.trend}</div><div className="finding-label">Future Outlook</div></div>
              <p className="prose-text">{riskTier === 'low' ? "Patient is stable." : "Risks can decrease by 20% if medication adherence is strict."}</p>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px'}}>
             <div className="finding-card">
               <div className="finding-head"><div className="finding-icon">{ICONS.diagnosis}</div><div className="finding-label">Active Conditions</div></div>
               <ul className="check-list">{reports.map((r, i) => <li key={i}><span className="check-mark">&#10003;</span><span>{r?.diagnosis || "Not specified"}</span></li>)}</ul>
             </div>
             <div className="finding-card">
               <div className="finding-head"><div className="finding-icon">{ICONS.treatment}</div><div className="finding-label">Suggested Treatments</div></div>
               <ul className="check-list">{reports.flatMap(r => r?.treatment_suggestions || []).slice(0, 5).map((t, i) => <li key={i}><span className="check-mark">&#10003;</span><span>{t}</span></li>)}</ul>
             </div>
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <div style={{marginTop: '20px'}}>
          <FindingCard icon={ICONS.trend} label="Vitals Trend" highlight>
            <div style={{ width: '100%', height: 250, marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12}/>
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="Risk" stroke="var(--accent)" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </FindingCard>
        </div>
      )}

      <div style={{marginTop: '20px'}}>
        <DecisionPanel patientId={patientId} />
      </div>

      <div style={{marginTop: '20px'}}>
        <FindingCard icon={ICONS.trend} label="Knowledge Graph" highlight>
          <KnowledgeGraphPanel patientId={patientId} />
        </FindingCard>
      </div>

      <div style={{marginTop: '20px'}}>
        <h3 style={{fontSize: "16px", marginBottom:'10px', fontFamily: "Space Grotesk, sans-serif"}}>Report History</h3>
        {reports.length > 0 ? reports.map(r => <ReportHistoryCard key={r?.id || Math.random()} report={r} />) : <p className="empty-note">No reports found for this patient.</p>}
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
function AIAssistantTab({ globalPatients, onPatientsUpdate }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [coachPlan, setCoachPlan] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([{ sender: "bot", text: "Hello Doctor! I am your AI Assistant. Select a patient to get personalized health guidance." }]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  
  const [showDietDetails, setShowDietDetails] = useState(false);
  const [showExDetails, setShowExDetails] = useState(false);
  const [showSleepDetails, setShowSleepDetails] = useState(false);
  
  const chatContainerRef = useRef(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const defaultQuestions = [
    "What are the current active conditions?",
    "Summarize this patient's health profile.",
    "What are the key risk factors?",
    "Explain the suggested treatments."
  ];

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

  const handleChatSend = async (customMsg = null) => {
    const msgToSend = customMsg || chatInput; 
    if(!msgToSend.trim() || isChatLoading) return;
    
    const userMsg = msgToSend;
    setChatInput(""); 
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }, { sender: "bot", text: "Analyzing..." }]);
    setIsChatLoading(true);

    const riskTier = selectedPatient.latest_risk_tier || "moderate";
    const patientContext = `Patient: ${selectedPatient.name}, Risk: ${riskTier}, Diagnoses: ${patientData?.reports?.map(r => r.diagnosis).join('; ')}, Treatments: ${patientData?.reports?.flatMap(r => r.treatment_suggestions).join('; ')}`;

    try {
      const res = await fetch(`${API_BASE}/symptom-checker/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, context: patientContext })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || "API Error");
      
      setChatMessages(prev => { 
        const newMsgs = [...prev]; 
        newMsgs[newMsgs.length - 1] = {
          sender: "bot",
          text: resData.reply || "No reply.",
          followUp: resData.follow_up,
          labTable: resData.lab_table
        }; 
        return newMsgs; 
      });

    } catch (err) {
      setChatMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = "Could not connect to the AI backend."; return newMsgs; });
    } finally { setIsChatLoading(false); }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      setChatInput(finalTranscript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onend = () => { setIsListening(false); };
    recognition.start();
    setIsListening(true);
    recognitionRef.current = recognition;
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    try {
      await updatePatientNameApi(selectedPatient.id, tempName);
      const updatedPatient = { ...selectedPatient, name: tempName };
      setSelectedPatient(updatedPatient);
      onPatientsUpdate(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setIsEditingName(false);
    } catch (err) {
      alert("Failed to update name.");
    }
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
  let dietDetails = `**🌅 Morning Routine**\n- Warm water with lemon\n- Oatmeal with fresh fruits\n\n**☀️ Afternoon Routine**\n- Balanced meal with lean protein (chicken/fish/tofu)\n- Fresh green salad\n\n**🌙 Night Routine**\n- Light dinner (soup or steamed veggies)\n- Avoid heavy carbs before sleep\n\n**💧 Hydration**\n- Drink 2-3 liters of water daily`;

  let exerciseAdvice = "30 minutes of moderate cardio daily is recommended.";
  let exerciseDetails = `**🏃 Recommended Exercises**\n- Brisk Walking\n- Light Jogging\n\n**📺 Video Guides**\n- [Watch: Brisk Walking Guide](https://www.youtube.com/watch?v=3Ka7B3hCg08)\n- [Watch: Beginner Cardio Workout](https://www.youtube.com/watch?v=ml6cT4AZdqI)`;

  let sleepAdvice = "Aim for 7-8 hours of consistent sleep nightly.";
  let sleepDetails = `**🌙 Pre-Sleep Routine (1 Hour Before Bed)**\n- Dim the room lights\n- Avoid screens (Mobile/TV) to reduce blue light\n- Drink a cup of chamomile tea\n\n**🛏️ Sleep Environment**\n- Keep room temperature cool (around 20-22°C)\n- Ensure complete darkness (use blackout curtains)\n\n**☀️ Morning Wake-Up**\n- Get 10 mins of morning sunlight\n- Stick to a consistent wake-up time daily`;

  if (hasDiabetes) {
    dietAdvice = "Strict low-carb and low-sugar diet is crucial. Monitor HbA1c levels.";
    dietDetails = `**🌅 Morning Routine**\n- Warm water with soaked fenugreek seeds\n- Oatmeal or dalia (no sugar)\n\n**☀️ Afternoon Routine**\n- 1-2 Multigrain roti\n- Green leafy vegetables\n- Grilled chicken or paneer\n\n**🌙 Night Routine**\n- Light dinner before 8 PM\n- Salad or clear soup\n\n**🚫 Strictly Avoid**\n- Refined sugar, sugary drinks, white bread, pastries`;
    exerciseDetails = `**🏃 Recommended Exercises**\n- Post-meal brisk walking (most important)\n- Cycling\n\n**📺 Video Guides**\n- [Watch: Walking Exercise for Diabetes](https://www.youtube.com/results?search_query=walking+exercise+for+diabetes)\n- [Watch: Yoga for Diabetes](https://www.youtube.com/results?search_query=yoga+for+diabetes)`;
  }
  if (hasCardiac) {
    dietAdvice = "Low sodium (DASH-style diet) is essential. Avoid fried foods.";
    dietDetails = `**🌅 Morning Routine**\n- Fresh fruits (Banana, Apple)\n- A handful of walnuts\n\n**☀️ Afternoon Routine**\n- Grilled fish or chicken\n- Boiled vegetables (Spinach, Carrots)\n- Very low salt intake\n\n**🌙 Night Routine**\n- Steamed vegetables\n- Light soup\n\n**🚫 Strictly Avoid**\n- Pickles, papads, processed meats, deep-fried foods`;
    exerciseDetails = `**🏃 Recommended Exercises**\n- Moderate walking\n- Light swimming\n\n**📺 Video Guides**\n- [Watch: Safe Exercises for Heart Patients](https://www.youtube.com/results?search_query=safe+exercises+for+heart+patients)\n- [Watch: Breathing Exercises for Heart](https://www.youtube.com/results?search_query=breathing+exercises+for+heart)`;
  }
  if (hasThyroid) {
    exerciseAdvice = "Light to moderate exercise. Avoid extreme fatigue.";
    exerciseDetails = `**🏃 Recommended Exercises**\n- Light Yoga\n- Stretching\n\n**📺 Video Guides**\n- [Watch: Yoga for Thyroid Relief](https://www.youtube.com/results?search_query=yoga+for+thyroid+relief)\n- [Watch: Thyroid Workout Routine](https://www.youtube.com/results?search_query=thyroid+exercise+routine)`;
    sleepAdvice = "Thyroid imbalances can cause fatigue. Prioritize 8+ hours of quality sleep.";
    sleepDetails = `**🌙 Pre-Sleep Routine**\n- Take a warm shower before bed\n- Read a relaxing book\n\n**🛏️ Sleep Environment**\n- Use a humidifier if feeling dry\n- Keep room cool and quiet\n\n**☀️ Morning Wake-Up**\n- Light stretching in bed\n- Do not snooze the alarm`;
  }
  if (riskTier === 'high') {
    dietAdvice += " Strict dietary discipline is critical.";
    sleepAdvice = "Prioritize 8+ hours of sleep. Stress management is critical.";
    sleepDetails = `**🌙 Pre-Sleep Routine**\n- Practice deep breathing (4-7-8 method)\n- Listen to calming music\n\n**🛏️ Sleep Environment**\n- Use a white noise machine\n- Aromatherapy (Lavender oil)\n\n**☀️ Morning Wake-Up**\n- 5 mins of meditation\n- Avoid checking phone immediately`;
  }

  const handlePrintPlan = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Health Plan - ${selectedPatient.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { color: #0E7C7B; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            h3 { color: #555; margin-top: 30px; }
            p { line-height: 1.6; font-size: 16px; }
            .footer { margin-top: 50px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Personalized Health Plan</h1>
          <p><strong>Patient:</strong> ${selectedPatient.name} <br/> <strong>Risk Level:</strong> ${riskTier}</p>
          <h3>Diet Plan</h3><p>${dietAdvice}</p>
          <h3>Sleep Hygiene</h3><p>${sleepAdvice}</p>
          <h3>Exercise</h3><p>${exerciseAdvice}</p>
          <div class="footer">Generated via Spero Healthcare OS on ${new Date().toLocaleDateString()}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*Health Plan for ${selectedPatient.name}*\n\n*Diet:* ${dietAdvice}\n\n*Sleep:* ${sleepAdvice}\n\n*Exercise:* ${exerciseAdvice}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div>
      <div className="action-row">
        <button className="btn-outline" onClick={() => setSelectedPatient(null)}>← Select another patient</button>
      </div>

      <div className="patient-band" style={{marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <div style={{fontWeight: 600, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            {isEditingName ? (
              <>
                <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} autoFocus style={{fontSize: '16px', padding: '4px', borderRadius: '4px', border: '1px solid var(--accent)'}}/>
                <button className="btn-primary" style={{padding: '4px 10px'}} onClick={handleSaveName}>Save</button>
                <button className="btn-outline" style={{padding: '4px 10px'}} onClick={() => setIsEditingName(false)}>Cancel</button>
              </>
            ) : (
              <>
                AI Guidance for {selectedPatient.name}
                <button onClick={() => { setTempName(selectedPatient.name); setIsEditingName(true); }} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0'}} title="Edit patient name">✏️</button>
              </>
            )}
          </div>
          <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>Based on their medical history and risk level</div>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <button className="btn-outline" onClick={handleWhatsAppShare}>💬 WhatsApp</button>
          <button className="btn-outline" onClick={handlePrintPlan}>🖨️ Print</button>
        </div>
      </div>

      <h3 style={{fontSize: "16px", margin: "20px 0 12px", fontFamily: "Space Grotesk, sans-serif", color: "var(--accent)"}}>Digital Health Coach</h3>
      {coachLoading ? (
        <p className="empty-note" style={{marginBottom: '32px'}}>Generating personalized plan...</p>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', marginBottom: '32px'}}>
          
          <div className="finding-card highlight" style={{cursor: 'pointer'}} onClick={() => setShowDietDetails(!showDietDetails)}>
            <div className="finding-head">
              <div className="finding-icon">{ICONS.treatment}</div>
              <div className="finding-label">Diet Plan</div>
              <span style={{marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)'}}>{showDietDetails ? 'Hide ↑' : 'Details ↓'}</span>
            </div>
            <div className="finding-body">
              <p className="prose-text">{dietAdvice}</p>
              {showDietDetails && (
                <div style={{marginTop: '12px', padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-light)'}}>
                  <ReactMarkdown>{dietDetails}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>

          <div className="finding-card" style={{cursor: 'pointer'}} onClick={() => setShowSleepDetails(!showSleepDetails)}>
            <div className="finding-head">
              <div className="finding-icon">{ICONS.precautions}</div>
              <div className="finding-label">Sleep Hygiene</div>
              <span style={{marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)'}}>{showSleepDetails ? 'Hide ↑' : 'Details ↓'}</span>
            </div>
            <div className="finding-body">
              <p className="prose-text">{sleepAdvice}</p>
              {showSleepDetails && (
                <div style={{marginTop: '12px', padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-light)'}}>
                  <ReactMarkdown>{sleepDetails}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>

          <div className="finding-card" style={{cursor: 'pointer'}} onClick={() => setShowExDetails(!showExDetails)}>
            <div className="finding-head">
              <div className="finding-icon">{ICONS.trend}</div>
              <div className="finding-label">Exercise</div>
              <span style={{marginLeft: 'auto', fontSize: '12px', color: 'var(--accent)'}}>{showExDetails ? 'Hide ↑' : 'Details ↓'}</span>
            </div>
            <div className="finding-body">
              <p className="prose-text">{exerciseAdvice}</p>
              {showExDetails && (
                <div style={{marginTop: '12px', padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-light)'}}>
                  <ReactMarkdown>{exerciseDetails}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      <h3 style={{fontSize: "16px", margin: "20px 0 12px", fontFamily: "Space Grotesk, sans-serif", color: "var(--accent)"}}>AI Clinical Advisor</h3>
      <div className="finding-card highlight">
        <div className="chat-container" ref={chatContainerRef} style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender}`}>
              {msg.sender === 'bot' ? (
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              ) : (
                msg.text.split('\n').map((line, idx) => <span key={idx}>{line}<br/></span>)
              )}

              {msg.followUp && (
                <div style={{ 
                  marginTop: '12px', 
                  display: 'inline-block', 
                  background: 'rgba(14, 124, 123, 0.1)', 
                  color: 'var(--accent)', 
                  padding: '8px 14px', 
                  borderRadius: '20px', 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  border: '1px solid var(--accent)'
                }}>
                  📅 Suggested Follow-up: {msg.followUp}
                </div>
              )}

              {msg.labTable && msg.labTable.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Test</th>
                      <th style={{ padding: '8px' }}>Value</th>
                      <th style={{ padding: '8px' }}>Normal Range</th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msg.labTable.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{row.test}</td>
                        <td style={{ padding: '8px' }}>{row.value}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{row.range}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                            background: row.status === 'high' ? 'rgba(239, 68, 68, 0.1)' : row.status === 'low' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: row.status === 'high' ? 'var(--coral)' : row.status === 'low' ? '#3b82f6' : 'var(--accent)'
                          }}>
                            {row.status === 'high' ? '🚨 High' : row.status === 'low' ? '🔻 Low' : '✅ Normal'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {defaultQuestions.map((q, i) => (
            <button key={i} className="btn-outline" style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }} onClick={() => handleChatSend(q)} disabled={isChatLoading}>
              {q}
            </button>
          ))}
        </div>

        <div className="chat-input-row" style={{ display: 'flex', gap: '8px' }}>
          <input className="chat-input" placeholder="Ask about symptoms or conditions..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleChatSend()} disabled={isChatLoading} style={{flex: 1}}/>
          
          <button 
            className={`btn-outline ${isListening ? 'mic-active' : ''}`} 
            onClick={handleVoiceInput} 
            disabled={isChatLoading} 
            title="Speak" 
            style={{ minWidth: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isListening ? '🔴' : '🎤'}
          </button>
          
          <button className="btn-primary" onClick={() => handleChatSend()} disabled={isChatLoading}>
            {isChatLoading ? "Analyzing..." : "Ask AI"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Mental Wellness Tab -------------------------------- */
function WellnessTab() {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { sender: "assistant", text: "Doctor, I am ready. Select a prompt below to begin the assessment." }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
 
  const initialDoctorPrompts = [
    "Patient reports feeling constantly stressed.",
    "Patient has trouble sleeping due to anxiety.",
    "Patient expresses feelings of hopelessness.",
    "Patient appears agitated and restless."
  ];
 
  const chatContainerRef = useRef(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
 
  const handleChatSend = async (customMsg = null) => {
    const msgToSend = customMsg || chatInput;
    if(!msgToSend.trim() || isChatLoading) return;
   
    const userMsg = msgToSend;
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "doctor", text: userMsg }, { sender: "assistant", text: "Analyzing..." }]);
    setIsChatLoading(true);
 
    const recentMessages = chatMessages.slice(-8);
    const contextHistory = recentMessages.map(m => `${m.sender === 'doctor' ? 'Doctor' : 'Assistant'}: ${m.text}`).join('\n');
 
    try {
      const res = await fetch(`${API_BASE}/api/wellness/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, context: contextHistory })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || "API Error");
     
      setChatMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          sender: "assistant",
          text: resData.recommendation || "No reply.",
          mood: resData.detected_mood,
          stress: resData.stress_level,
          suggestions: resData.suggested_replies || [],
          isSummary: userMsg === "Generate Final Summary"
        };
        return newMsgs;
      });
 
    } catch (err) {
      setChatMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = "Could not connect to the AI backend."; return newMsgs; });
    } finally { setIsChatLoading(false); }
  };
 
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      setChatInput(finalTranscript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
    recognitionRef.current = recognition;
  };
 
  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Mental Wellness Assessment</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            h1 { color: #0E7C7B; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .msg { margin-bottom: 15px; padding: 10px; border-radius: 8px; }
            .doctor { background: #f0f0f0; }
            .assistant { background: #e6f7f6; border-left: 4px solid #0E7C7B; }
            .label { font-weight: bold; font-size: 12px; text-transform: uppercase; color: #666; }
          </style>
        </head>
        <body>
          <h1>Mental Wellness Assessment Report</h1>
          ${chatMessages.map(m => `
            <div class="msg ${m.sender === 'doctor' ? 'doctor' : 'assistant'}">
              <div class="label">${m.sender === 'doctor' ? 'Doctor' : 'AI Assistant'}</div>
              ${m.text}
            </div>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };
 
  const lastAssistantMsg = [...chatMessages].reverse().find(m => m.sender === 'assistant');
  const dynamicButtons = lastAssistantMsg?.suggestions || [];
  const hasStarted = chatMessages.length > 1;
  const hasSummary = lastAssistantMsg?.isSummary;
 
  return (
    <div className="hero">
      <p className="hero-eyebrow">Doctor's Clinical Tool</p>
      <h1 className="hero-title">Patient Mental Wellness Check</h1>
      <p className="hero-sub">Continuous chat assessment. Click the suggested replies to quickly answer the AI's questions.</p>
     
      <div className="finding-card highlight" style={{ maxWidth: "700px", margin: "24px auto 0" }}>
       
<div className="chat-container" ref={chatContainerRef} style={{ minHeight: '300px', maxHeight: '400px', overflowY: 'auto', marginBottom: '15px' }}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.sender === 'doctor' ? 'user' : 'bot'}`}>
              {msg.sender === 'assistant' && msg.isSummary && msg.mood && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(14, 124, 123, 0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                    Mood: {msg.mood}
                  </span>
                  <span style={{ fontSize: '11px', background: msg.stress === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 192, 64, 0.1)', color: msg.stress === 'High' ? 'var(--coral)' : 'var(--amber)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                    Stress: {msg.stress}
                  </span>
                </div>
              )}
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          ))}
        </div>
 
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
          {!hasStarted && initialDoctorPrompts.map((q, i) => (
            <button
              key={i}
              className="btn-outline"
              style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => handleChatSend(q)}
              disabled={isChatLoading}
            >
              {q}
            </button>
          ))}
         
          {hasStarted && dynamicButtons.length > 0 && dynamicButtons.map((q, i) => (
            <button
              key={i}
              className="btn-outline"
              style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: 'rgba(14, 124, 123, 0.05)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => handleChatSend(q)}
              disabled={isChatLoading}
            >
              {q}
            </button>
          ))}
        </div>
 
        <div className="chat-input-row" style={{ display: "flex", gap: "8px" }}>
          <input
            className="chat-input"
            placeholder="Ask a follow-up question or type patient response..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
            disabled={isChatLoading}
            style={{ flex: 1 }}
          />
          <button
            className={`btn-outline ${isListening ? "mic-active" : ""}`}
            onClick={handleVoiceInput}
            disabled={isChatLoading}
            style={{ minWidth: "45px", display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Speak"
          >
            {isListening ? "🔴" : "🎤"}
          </button>
         
          {hasStarted && !hasSummary && (
            <button
              className="btn-outline"
              onClick={() => handleChatSend("Generate Final Summary")}
              disabled={isChatLoading}
              style={{ whiteSpace: 'nowrap', borderColor: 'var(--amber)', color: 'var(--amber)' }}
              title="Get Final Summary"
            >
              📝 Summary
            </button>
          )}
 
          {hasSummary && (
            <button
              className="btn-primary"
              onClick={handlePrintSummary}
              style={{ whiteSpace: 'nowrap' }}
              title="Print Assessment"
            >
              🖨️ Print
            </button>
          )}
 
          {!hasSummary && (
            <button className="btn-primary" onClick={() => handleChatSend()} disabled={isChatLoading}>
              {isChatLoading ? "Analyzing..." : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- App (Global State) ---------------------------------- */
export default function App() {
  // 🟢 Page refresh hone par localStorage check hoga
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("spero_doc_auth") === "true";
  }); 
  
  const [tab, setTab] = useState("analyze");
  const [darkMode, setDarkMode] = useState(false);
  
  const [globalPatients, setGlobalPatients] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [analysisResults, setAnalysisResults] = useState([]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchPatients()
        .then(setGlobalPatients)
        .catch(err => {
          console.error("Failed to load patients on mount:", err);
          setGlobalPatients([]);
        });
    }
  }, [isLoggedIn]);

  const refreshPatients = useCallback(() => {
    fetchPatients()
      .then(setGlobalPatients)
      .catch(err => {
        console.error("Failed to refresh patients:", err);
        setGlobalPatients([]);
      });
  }, []);

  const handleUpload = useCallback(async (files) => {
    setAnalysisStatus("uploading");
    const uploadPromises = Array.from(files).map(file => uploadAndSave(file));
    try {
      const results = await Promise.all(uploadPromises);
      setAnalysisResults(results);
      setAnalysisStatus("done");
      if (results.some(r => r.status === "duplicate_skipped")) {
        alert("ℹ️ Duplicate Report: Some selected reports were already saved in the database. AI analysis is shown, but duplicates were not saved again.");
      }
      refreshPatients(); 
    } catch (err) {
      alert("Upload Error: " + err.message);
      setAnalysisStatus("idle");
    }
  }, [refreshPatients]);

  const handleResetAnalysis = () => {
    setAnalysisStatus("idle");
    setAnalysisResults([]);
  };

  // If not logged in, show ONLY the Login Screen
  if (!isLoggedIn) {
    return (
      <div className={darkMode ? "dark-mode" : ""} style={{minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)'}}>
        <LoginScreen onLogin={() => setIsLoggedIn(true)} darkMode={darkMode} setDarkMode={setDarkMode} />
        <footer className="app-footer">Spero is a support tool, not a substitute for professional medical advice.</footer>
      </div>
    );
  }

  // If logged in, show the main app
  return (
    <div className={darkMode ? "dark-mode" : ""} style={{minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)'}}>
      <TopBar 
        tab={tab} 
        onTabChange={setTab} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        onLogout={() => {
          // 🟢 Logout pe localStorage clear hoga
          localStorage.removeItem("spero_doc_auth");
          setIsLoggedIn(false);
        }} 
      />
      
      <main className="app-main" style={{flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '24px 16px', paddingBottom: '40px'}}>
        {/* 🟢 NAYA LOGIC: renderTab() hata kar display: none use kiya, taaki Mental Wellness aur AI Assistant ka chat history tab change karne par delete na ho */}
        <div style={{ display: tab === "analyze" ? "block" : "none" }}>
          <AnalyzeTab status={analysisStatus} results={analysisResults} onUpload={handleUpload} onReset={handleResetAnalysis} />
        </div>

        <div style={{ display: tab === "patients" ? "block" : "none" }}>
          <PatientsTab globalPatients={globalPatients} />
        </div>

        <div style={{ display: tab === "assistant" ? "block" : "none" }}>
          <AIAssistantTab globalPatients={globalPatients} onPatientsUpdate={setGlobalPatients} />
        </div>

        <div style={{ display: tab === "wellness" ? "block" : "none" }}>
          <WellnessTab />
        </div>
      </main>
      
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 16px 20px 16px', boxSizing: 'border-box' }}>
        <div style={{ 
          padding: "15px", 
          background: "rgba(245, 192, 64, 0.1)", 
          border: "1px solid var(--amber)", 
          borderRadius: "8px", 
          color: "var(--amber)", 
          fontSize: "13px", 
          fontWeight: "600", 
          textAlign: "center",
          lineHeight: "1.5",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
        }}>
          The following are potential treatment considerations based on the reported findings and should be reviewed by the appropriate treating clinician or specialist. Final diagnosis, treatment recommendations, and clinical decisions remain the responsibility of the healthcare provider.
        </div>
      </div>

      <footer className="app-footer">Spero is a support tool, not a substitute for professional medical advice.</footer>
    </div>
  );
}