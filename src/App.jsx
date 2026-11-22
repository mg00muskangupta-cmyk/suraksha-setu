import React, { useEffect, useMemo, useState } from "react";
import { extractPdfText, analyzeVisualCreative, makeLogoReference } from "./advancedChecks.js";
import {
  ShieldCheck, LayoutDashboard, ClipboardCheck, BookOpen, History, Image as ImageIcon,
  Search, Bell, Plus, Upload, FileText, Check, X, AlertTriangle,
  ChevronRight, ArrowUpRight, Sparkles, Settings2, Trash2, Save,
  RotateCcw, Leaf, Menu, CheckCircle2, Clock3, CircleAlert, Pencil,
  ExternalLink, Info, Users, LogIn, LogOut
} from "lucide-react";

const starterBrand = {
  id: "ecoglow",
  name: "EcoGlow",
  description: "Eco-conscious home and personal-care products.",
  tone: "Friendly, trustworthy, simple and environmentally responsible.",
  rules: [
    { id: "r1", category: "Claims & evidence", rule: "Do not claim 'India's number one eco-friendly brand' unless current, verifiable evidence is provided.", severity: "High" },
    { id: "r2", category: "Terminology", rule: "Never use the phrase '100% pollution-free'.", severity: "High" },
    { id: "r3", category: "Claims & evidence", rule: "Environmental claims must be specific and supported by evidence. Avoid absolute claims such as 'completely saves the planet'.", severity: "High" },
    { id: "r4", category: "Approved facts", rule: "The approved packaging fact is: products are made using 70% recycled packaging material.", severity: "Medium" },
    { id: "r5", category: "Tone & personality", rule: "Use a friendly, trustworthy and simple tone. Avoid exaggerated or fear-based language.", severity: "Medium" },
    { id: "r6", category: "Preferred terminology", rule: "Prefer the phrase 'eco-conscious products' when describing the product range.", severity: "Low" }
  ],
  facts: [
    "Products are made using 70% recycled packaging material.",
    "The brand offers eco-conscious home and personal-care products."
  ],
  prohibited: ["100% pollution-free"],
  preferred: [{ from: "eco-friendly brand", to: "eco-conscious products" }],
  visual: { colors: ["#20cfa0", "#0b1828"], logoSignature: null }
};

const sampleText = "EcoGlow is India's number one eco-friendly brand! Our products are 100% pollution-free and completely save the planet. Buy now!";
const STORAGE = "suraksha-setu-v1";

function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE));
    if (raw) return raw;
  } catch {}
  return { brand: starterBrand, reviews: [] };
}
function saveStore(data) { localStorage.setItem(STORAGE, JSON.stringify(data)); }
function id() { return Math.random().toString(36).slice(2, 9); }

function analyzeLocally(content, brand) {
  const rules = brand.rules || [];
  const issues = [];
  const add = (phrase, category, severity, rule, explanation, suggestion) => {
    if (!issues.some(x => x.phrase.toLowerCase() === phrase.toLowerCase() && x.category === category)) {
      issues.push({ id: id(), phrase, category, severity, rule, explanation, suggestion });
    }
  };
  const checks = [
    { re: /india'?s number one|number one|no\.? 1|best in india|best in the market/i, rule: rules.find(r => /number one/i.test(r.rule))?.rule || "Use ranking claims only when supported by current evidence.", cat: "Claims & evidence", sev: "High", why: "This is a comparative ranking claim, but no supporting evidence was supplied in the approved facts.", suggestion: "EcoGlow offers eco-conscious products for home and personal care." },
    { re: /100%\s*pollution[- ]free/i, rule: rules.find(r => /100% pollution-free/i.test(r.rule))?.rule || "Do not use absolute environmental claims without evidence.", cat: "Terminology", sev: "High", why: "This phrase is explicitly restricted by the brand guidelines.", suggestion: "Our products are made using 70% recycled packaging material." },
    { re: /completely save the planet|save the planet|zero impact|no impact on the environment/i, rule: rules.find(r => /absolute claims/i.test(r.rule))?.rule || "Environmental claims must be specific and supported by evidence.", cat: "Claims & evidence", sev: "High", why: "This is an absolute environmental promise that is not supported by the approved facts.", suggestion: "Our products are made using 70% recycled packaging material." },
    { re: /\b(guaranteed|miracle|perfect|risk[- ]free)\b/i, rule: rules.find(r => /exaggerated/i.test(r.rule))?.rule || "Avoid exaggerated or absolute language.", cat: "Tone & personality", sev: "Medium", why: "The wording may sound exaggerated rather than clear and trustworthy.", suggestion: "Explore our products and choose what works for your everyday routine." }
  ];
  checks.forEach(c => {
    const match = content.match(c.re);
    if (match) add(match[0], c.cat, c.sev, c.rule, c.why, c.suggestion);
  });
  (brand.prohibited || []).forEach(term => {
    if (term && content.toLowerCase().includes(term.toLowerCase()) && !issues.some(i => i.phrase.toLowerCase() === term.toLowerCase())) {
      add(term, "Terminology", "High", `Prohibited phrase: ${term}`, "This phrase appears in the brand's prohibited terminology list.", `Remove “${term}” and use an approved, accurate description.`);
    }
  });
  if (/eco[- ]friendly/i.test(content) && (brand.preferred || []).some(p => /eco-friendly/i.test(p.from))) {
    const p = brand.preferred.find(p => /eco-friendly/i.test(p.from));
    add(content.match(/eco[- ]friendly/i)[0], "Preferred terminology", "Low", `Preferred wording: use “${p.to}”.`, "The brand has specified a preferred phrase for consistent product descriptions.", `Consider replacing it with “${p.to}”.`);
  }
  if (!issues.length) {
    return { issues: [], summary: "No issues were detected by the configured checks. Review the content against the full brand context before publication.", score: 100 };
  }
  const penalty = issues.reduce((n, x) => n + (x.severity === "High" ? 22 : x.severity === "Medium" ? 12 : 5), 0);
  return { issues, summary: `${issues.length} potential issue${issues.length === 1 ? "" : "s"} found. Review each item and make a human decision before publishing.`, score: Math.max(0, 100 - penalty) };
}

function IconButton({ children, onClick, title }) {
  return <button className="icon-button" onClick={onClick} title={title}>{children}</button>;
}
function Stat({ icon: Icon, label, value, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18}/></div><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div></div>;
}
function Badge({ children, kind = "neutral" }) { return <span className={`badge ${kind}`}>{children}</span>; }

export default function App() {
  const [store, setStore] = useState(readStore);
  const [page, setPage] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [title, setTitle] = useState("EcoGlow launch advertisement");
  const [type, setType] = useState("Advertisement");
  const [content, setContent] = useState(sampleText);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activeReview, setActiveReview] = useState(null);
  const [comments, setComments] = useState("");
  const [notice, setNotice] = useState("");
  const [ruleDraft, setRuleDraft] = useState("");
  const [factDraft, setFactDraft] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("Messaging");
  const [showAddRule, setShowAddRule] = useState(false);
  const [visualFile, setVisualFile] = useState(null);
  const [visualResult, setVisualResult] = useState(null);
  const [visualBusy, setVisualBusy] = useState(false);
  const [paletteDraft, setPaletteDraft] = useState((store.brand.visual?.colors || []).join(", "));
  const [currentUser, setCurrentUser] = useState(null);
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authWorkspace, setAuthWorkspace] = useState("");
  const [authInvite, setAuthInvite] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState("creator");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => saveStore(store), [store]);
  useEffect(() => {
    let alive = true;
    fetch("/api/workspace").then(async response => {
      if (!response.ok) return null;
      return response.json();
    }).then(data => {
      if (!alive || !data?.authenticated) return;
      if (data.brand && Object.keys(data.brand).length) setStore({ brand: data.brand, reviews: data.reviews || [] });
      setCurrentUser(data.user); setWorkspaceInfo(data.workspace); setWorkspaceReady(true);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    const handle = window.setTimeout(() => {
      fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand: store.brand, reviews: store.reviews || [] }) })
        .then(response => { if (!response.ok) throw new Error("Sync unavailable"); })
        .catch(() => notify("Workspace sync failed. Check the D1 database connection."));
    }, 500);
    return () => window.clearTimeout(handle);
  }, [store, currentUser, workspaceReady]);
  const reviews = store.reviews || [];
  const approved = reviews.filter(r => r.status === "Approved").length;
  const pending = reviews.filter(r => r.status === "Pending").length;
  const flagged = reviews.filter(r => r.issues?.length > 0).length;
  const brand = store.brand;

  const notify = (msg) => { setNotice(msg); window.setTimeout(() => setNotice(""), 3000); };
  const go = (p) => { setPage(p); setMobileNav(false); setAnalysis(null); setActiveReview(null); };

  async function runAnalysis() {
    if (!content.trim()) return notify("Add content before running a check.");
    setBusy(true); setAnalysis(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, brand })
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.issues)) {
          setAnalysis({ ...data, mode: "AI-assisted" });
          setBusy(false);
          return;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 450));
    setAnalysis({ ...analyzeLocally(content, brand), mode: "Guideline-based demo checks" });
    setBusy(false);
  }

  function saveReview(status = "Pending") {
    if (!analysis) return;
    if (currentUser?.role === "reviewer") return notify("Reviewer accounts review existing submissions; they cannot create new ones.");
    const review = {
      id: id(), title: title || "Untitled content", type, original: content,
      finalContent: content, issues: analysis.issues, score: analysis.score,
      summary: analysis.summary, status, comments: "", createdAt: new Date().toISOString()
    };
    setStore(s => ({ ...s, reviews: [review, ...s.reviews] }));
    setActiveReview(review);
    notify(status === "Pending" ? "Analysis saved to review history." : `Content ${status.toLowerCase()}.`);
    setPage("review");
  }

  function applySuggestion(issue) {
    setContent(prev => prev.replace(issue.phrase, issue.suggestion));
    setAnalysis(prev => ({ ...prev, summary: "A suggested change was applied. Re-analyze the updated content before approval." }));
    notify("Suggested correction applied to the editor.");
  }

  function updateReview(status) {
    if (!activeReview) return;
    if (currentUser && !["admin", "reviewer"].includes(currentUser.role)) return notify("Only reviewers can approve or reject submitted content.");
    const updated = { ...activeReview, status, finalContent: activeReview.finalContent || activeReview.original, comments, reviewedAt: new Date().toISOString() };
    setStore(s => ({ ...s, reviews: s.reviews.map(r => r.id === activeReview.id ? updated : r) }));
    setActiveReview(updated);
    notify(`Review marked ${status.toLowerCase()}.`);
  }

  function updateBrand(next) {
    if (currentUser?.role === "reviewer") return notify("Reviewer accounts cannot edit brand guidelines.");
    setStore(s => ({ ...s, brand: next }));
  }
  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authMode === "login"
          ? { action: "login", email: authEmail, password: authPassword }
          : { action: "signup", name: authName, workspaceName: authWorkspace, inviteCode: authInvite, role: authRole, email: authEmail, password: authPassword, brand: store.brand })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      const loaded = await fetch("/api/workspace").then(r => r.json());
      setCurrentUser(loaded.user); setWorkspaceInfo(loaded.workspace);
      if (loaded.brand && Object.keys(loaded.brand).length) setStore({ brand: loaded.brand, reviews: loaded.reviews || [] });
      setWorkspaceReady(true); setAuthPassword(""); notify("Connected to shared workspace.");
    } catch (err) { notify(err.message || "Workspace service is unavailable."); }
    finally { setAuthBusy(false); }
  }
  async function signOut() {
    try { await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); } catch {}
    setCurrentUser(null); setWorkspaceInfo(null); setWorkspaceReady(false); notify("Signed out. Local demo data remains on this browser.");
  }
  function addRule() {
    if (!ruleDraft.trim()) return;
    updateBrand({ ...brand, rules: [...brand.rules, { id: id(), category: newRuleCategory, rule: ruleDraft.trim(), severity: "Medium" }] });
    setRuleDraft(""); setShowAddRule(false); notify("Brand rule saved.");
  }
  function addFact() {
    if (!factDraft.trim()) return;
    updateBrand({ ...brand, facts: [...brand.facts, factDraft.trim()] });
    setFactDraft(""); notify("Approved fact saved.");
  }
  function resetDemo() {
    if (!window.confirm("Reset the demo data and review history?")) return;
    setStore({ brand: starterBrand, reviews: [] }); setContent(sampleText); setTitle("EcoGlow launch advertisement"); setAnalysis(null); notify("Demo data reset.");
  }

  const nav = [
    ["overview", LayoutDashboard, "Overview"],
    ["check", ClipboardCheck, "Check content"],
    ["visual", ImageIcon, "Visual checks"],
    ["knowledge", BookOpen, "Brand knowledge"],
    ["account", Users, "Team workspace"],
    ["history", History, "Review history"]
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={22}/></div><div><strong>SURAKSHA</strong><span>SETU</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      <button className="brand-switch" onClick={() => go("knowledge")}><span className="eco-icon">E</span><span><b>{brand.name}</b><small>Brand profile</small></span><ChevronRight size={16}/></button>
      <nav>{nav.map(([key, I, label]) => <button key={key} onClick={() => go(key)} className={`nav-item ${page === key ? "active" : ""}`}><I size={18}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="live-dot"/> <span>Workspace ready</span><button onClick={resetDemo} title="Reset demo data"><RotateCcw size={14}/></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(v => !v)}><Menu size={20}/></button><div className="crumb">Workspace <ChevronRight size={14}/> <b>{nav.find(n => n[0] === page)?.[2] || (page === "review" ? "Human review" : "Check content")}</b></div><div className="top-actions"><span className="protection"><i/> {currentUser ? `Synced · ${currentUser.role}` : "Local demo mode"}</span><button className="secondary small" onClick={() => go("account")}>{currentUser ? <><Users size={14}/> {currentUser.name}</> : <><LogIn size={14}/> Team sign in</>}</button></div></header>

      {page === "overview" && <section className="page">
        <div className="eyebrow">BRAND GOVERNANCE / OVERVIEW</div>
        <div className="page-heading-row"><div><h1>Welcome to Suraksha Setu<span className="green-dot">.</span></h1><p>Keep every message aligned with what {brand.name} stands for.</p></div><button className="primary" onClick={() => go("check")}><Plus size={17}/> Start new brand check</button></div>
        <div className="stats-grid">
          <Stat icon={FileText} label="Content reviewed" value={reviews.length} tone="blue"/>
          <Stat icon={CheckCircle2} label="Approved" value={approved} tone="green"/>
          <Stat icon={AlertTriangle} label="Flagged content" value={flagged} tone="amber"/>
          <Stat icon={ClipboardCheck} label="Pending reviews" value={pending} tone="purple"/>
        </div>
        <div className="dashboard-grid">
          <div className="panel"><div className="panel-head"><div><div className="eyebrow">ACTIVITY</div><h2>Recent reviews</h2></div><button className="text-button" onClick={() => go("history")}>View history <ChevronRight size={15}/></button></div>
            {reviews.length === 0 ? <div className="empty-state"><div className="empty-icon"><FileText size={22}/></div><b>No reviews yet</b><p>Run your first brand check to see activity here.</p><button className="secondary" onClick={() => go("check")}>Check content</button></div> :
              <div className="review-list">{reviews.slice(0, 5).map(r => <button className="review-row" key={r.id} onClick={() => { setActiveReview(r); setComments(r.comments || ""); setPage("review"); }}><div className="file-icon"><FileText size={17}/></div><div className="review-meta"><b>{r.title}</b><small>{r.type} · {new Date(r.createdAt).toLocaleDateString()}</small></div><Badge kind={r.status === "Approved" ? "success" : r.status === "Rejected" ? "danger" : "warning"}>{r.status}</Badge><ChevronRight size={16}/></button>)}</div>}
          </div>
          <div className="panel"><div className="panel-head"><div><div className="eyebrow">BRAND PROFILE</div><h2>What we check</h2></div><button className="icon-button" onClick={() => go("knowledge")}><Settings2 size={17}/></button></div>
            <div className="check-categories">{[["Tone & personality","Does it sound like your brand?"],["Terminology","Are approved words being used?"],["Claims & evidence","Can the message be supported?"],["Messaging","Could it mislead your audience?"]].map((x,i)=><div className="category-row" key={x[0]}><span>0{i+1}</span><div><b>{x[0]}</b><small>{x[1]}</small></div></div>)}</div>
            <div className="notice-box"><Info size={16}/> AI suggestions support review. A human always makes the final call.</div>
          </div>
        </div>
      </section>}

      {page === "check" && <section className="page">
        <div className="eyebrow">ANALYSIS / NEW CHECK</div><div className="page-heading-row"><div><h1>Check your content</h1><p>Test a message against the exact rules in your brand knowledge base.</p></div><Badge kind="info"><ShieldCheck size={13}/> AI-assisted review</Badge></div>
        <div className="check-layout">
          <div className="panel input-panel"><div className="panel-head"><div><div className="eyebrow">CONTENT INPUT</div><h2>Bring your message</h2></div><label className="upload-link"><Upload size={15}/> Upload file<input type="file" accept=".txt,.md,.csv,.pdf" onChange={async e => { const f=e.target.files?.[0]; if(!f)return; if(f.type==="application/pdf" || f.name.toLowerCase().endsWith(".pdf")){try{const result=await extractPdfText(f);setContent(result.text);setTitle(f.name.replace(/\\.[^.]+$/,""));notify(`Extracted text from ${result.pages} PDF page(s).`);}catch(err){notify(err.message || "Could not read this PDF.");}return;} if(!/\\.(txt|md|csv)$/i.test(f.name)){notify("Supported files: PDF, TXT, MD and CSV.");return;} try{setContent(await f.text());setTitle(f.name.replace(/\\.[^.]+$/,""));notify("File loaded successfully.");}catch{notify("This file could not be read.");} }}/></label></div>
            <label className="field-label">Content title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Summer campaign email"/></label>
            <div className="two-fields"><label className="field-label">Content type<select value={type} onChange={e => setType(e.target.value)}>{["Social media post","Advertisement","Email","Marketing campaign","Document"].map(x=><option key={x}>{x}</option>)}</select></label><label className="field-label">Brand profile<select value={brand.id}><option value={brand.id}>{brand.name}</option></select></label></div>
            <label className="field-label">Content to review<textarea className="content-area" value={content} onChange={e => setContent(e.target.value)} placeholder="Paste your content here..."/></label>
            <div className="input-footer"><span>{content.trim().length} characters</span><button className="primary" disabled={busy || !content.trim()} onClick={runAnalysis}>{busy ? <><span className="spinner"/> Analyzing...</> : <><Sparkles size={16}/> Analyze content</>}</button></div>
            {analysis && <div className="results-block">
              <div className="result-summary"><div><div className="eyebrow">ANALYSIS COMPLETE · {analysis.mode}</div><h2>{analysis.issues.length ? `${analysis.issues.length} potential issue${analysis.issues.length===1?"":"s"} found` : "No configured issues detected"}</h2><p>{analysis.summary}</p></div><div className="score"><strong>{analysis.score}</strong><small>estimated score</small></div></div>
              {analysis.issues.length === 0 ? <div className="success-message"><CheckCircle2 size={18}/> No issues found by the configured checks. Human review is still recommended.</div> : analysis.issues.map(issue => <div className="issue-card" key={issue.id}><div className="issue-top"><div><span className="issue-bullet"/> <b>{issue.category}</b></div><Badge kind={issue.severity==="High"?"danger":issue.severity==="Medium"?"warning":"neutral"}>{issue.severity}</Badge></div><blockquote>“{issue.phrase}”</blockquote><div className="rule-box"><small>RELEVANT BRAND RULE</small><p>{issue.rule}</p></div><p className="issue-explanation">{issue.explanation}</p><div className="suggestion"><b><Check size={14}/> Suggested correction</b><p>{issue.suggestion}</p><button className="secondary small" onClick={() => applySuggestion(issue)}>Apply correction</button></div></div>)}
              <div className="analysis-actions"><button className="secondary" onClick={runAnalysis}><RotateCcw size={15}/> Re-analyze content</button><button className="primary" onClick={() => saveReview("Pending")}><ClipboardCheck size={15}/> Send for human review</button></div>
            </div>}
          </div>
          <aside className="panel side-info"><div className="eyebrow">BEFORE YOU SUBMIT</div><h2>What we look for</h2>{[["01","Tone & personality","Does it sound like your brand?"],["02","Terminology","Are approved words being used?"],["03","Claims & evidence","Can the message be supported?"],["04","Messaging","Could it mislead your audience?"]].map(x=><div className="look-row" key={x[0]}><span>{x[0]}</span><div><b>{x[1]}</b><small>{x[2]}</small></div></div>)}<div className="notice-box"><AlertTriangle size={15}/> AI suggestions support review. A human always makes the final call.</div></aside>
        </div>
      </section>}

      {page === "knowledge" && <section className="page">
        <div className="eyebrow">CONFIGURATION / BRAND KNOWLEDGE</div><div className="page-heading-row"><div><h1>Brand knowledge</h1><p>Manage the approved rules and facts used during content checks.</p></div><Badge kind="success"><Leaf size={13}/> Active profile</Badge></div>
        <div className="knowledge-grid"><div className="panel"><div className="panel-head"><div><div className="eyebrow">BRAND PROFILE</div><h2>{brand.name}</h2></div><span className="eco-icon large">E</span></div><label className="field-label">Brand name<input value={brand.name} onChange={e=>updateBrand({...brand,name:e.target.value})}/></label><label className="field-label">Brand description<input value={brand.description} onChange={e=>updateBrand({...brand,description:e.target.value})}/></label><label className="field-label">Approved tone of voice<textarea value={brand.tone} onChange={e=>updateBrand({...brand,tone:e.target.value})}/></label><div className="save-hint"><CheckCircle2 size={14}/> Changes save automatically in this browser.</div></div>
          <div className="panel"><div className="panel-head"><div><div className="eyebrow">APPROVED FACTS</div><h2>Facts the AI can rely on</h2></div><Badge>{brand.facts.length} facts</Badge></div><div className="fact-list">{brand.facts.map((f,i)=><div className="fact-row" key={i}><CheckCircle2 size={16}/><span>{f}</span><button className="icon-button" onClick={()=>updateBrand({...brand,facts:brand.facts.filter((_,j)=>j!==i)})}><Trash2 size={14}/></button></div>)}</div><div className="inline-add"><input value={factDraft} onChange={e=>setFactDraft(e.target.value)} placeholder="Add an approved company fact"/><button className="secondary" onClick={addFact}><Plus size={15}/> Add</button></div></div>
        </div>
        <div className="panel rules-panel"><div className="panel-head"><div><div className="eyebrow">GUIDELINE LIBRARY</div><h2>Brand rules</h2><p className="muted">Rules are checked against submitted content.</p></div><button className="primary" onClick={()=>setShowAddRule(v=>!v)}><Plus size={16}/> Add rule</button></div>
          {showAddRule && <div className="add-rule"><select value={newRuleCategory} onChange={e=>setNewRuleCategory(e.target.value)}>{["Tone & personality","Terminology","Claims & evidence","Messaging","Preferred terminology"].map(x=><option>{x}</option>)}</select><input value={ruleDraft} onChange={e=>setRuleDraft(e.target.value)} placeholder="Write a clear, testable brand rule"/><button className="primary" onClick={addRule}>Save rule</button></div>}
          <div className="rules-list">{brand.rules.map(r=><div className="rule-row" key={r.id}><div className="rule-type">{r.category}</div><div className="rule-copy">{r.rule}</div><Badge kind={r.severity==="High"?"danger":r.severity==="Medium"?"warning":"neutral"}>{r.severity}</Badge><button className="icon-button" onClick={()=>updateBrand({...brand,rules:brand.rules.filter(x=>x.id!==r.id)})} title="Delete rule"><Trash2 size={14}/></button></div>)}</div>
        </div>
        <div className="panel"><div className="panel-head"><div><div className="eyebrow">TERMINOLOGY</div><h2>Preferred and restricted wording</h2></div></div><div className="terminology-grid"><div><b className="term-heading bad">Restricted phrases</b>{brand.prohibited.map((p,i)=><div className="term-pill" key={i}><X size={13}/>{p}</div>)}</div><div><b className="term-heading good">Preferred wording</b>{brand.preferred.map((p,i)=><div className="term-pill good-pill" key={i}><Check size={13}/>{p.from} → {p.to}</div>)}</div></div></div>
      </section>}

      {page === "history" && <section className="page"><div className="eyebrow">WORKSPACE / AUDIT TRAIL</div><div className="page-heading-row"><div><h1>Review history</h1><p>Previously analyzed content and human decisions.</p></div><Badge>{reviews.length} records</Badge></div><div className="panel">{reviews.length===0?<div className="empty-state"><div className="empty-icon"><History size={22}/></div><b>No review history yet</b><p>Content checks saved for human review will appear here.</p><button className="primary" onClick={()=>go("check")}>Start a check</button></div>:<div className="history-table"><div className="table-head"><span>CONTENT</span><span>TYPE</span><span>ISSUES</span><span>DATE</span><span>STATUS</span><span/></div>{reviews.map(r=><button className="table-row" key={r.id} onClick={()=>{setActiveReview(r);setComments(r.comments||"");setPage("review");}}><b>{r.title}</b><span>{r.type}</span><span>{r.issues?.length||0}</span><span>{new Date(r.createdAt).toLocaleDateString()}</span><Badge kind={r.status==="Approved"?"success":r.status==="Rejected"?"danger":"warning"}>{r.status}</Badge><ChevronRight size={15}/></button>)}</div>}</div></section>}

      {page === "review" && <section className="page"><div className="eyebrow">HUMAN REVIEW / FINAL DECISION</div><div className="page-heading-row"><div><h1>Human review</h1><p>Review the findings and make the final decision before publication.</p></div><Badge kind="warning"><Clock3 size={13}/>{activeReview?.status || "Review"}</Badge></div>
        {!activeReview ? <div className="panel empty-state"><b>No review selected</b><p>Choose a review from the dashboard or history.</p><button className="secondary" onClick={()=>go("history")}>Open history</button></div> :
        <div className="review-detail-grid"><div className="panel"><div className="panel-head"><div><div className="eyebrow">SUBMITTED CONTENT</div><h2>{activeReview.title}</h2></div><Badge>{activeReview.type}</Badge></div><div className="content-preview">{activeReview.original}</div><div className="eyebrow issue-heading">DETECTED ISSUES · {activeReview.issues?.length||0}</div>{(activeReview.issues||[]).map(i=><div className="compact-issue" key={i.id}><div className="issue-top"><b>{i.category}</b><Badge kind={i.severity==="High"?"danger":"warning"}>{i.severity}</Badge></div><blockquote>“{i.phrase}”</blockquote><small>RULE</small><p>{i.rule}</p><small>SUGGESTION</small><p>{i.suggestion}</p></div>)}</div>
          <div className="panel"><div className="eyebrow">HUMAN DECISION</div><h2>Final review</h2><label className="field-label">Final content<textarea className="final-content" value={activeReview.finalContent ?? activeReview.original} onChange={e=>setActiveReview({...activeReview,finalContent:e.target.value})}/></label><label className="field-label">Reviewer comments<textarea value={comments} onChange={e=>setComments(e.target.value)} placeholder="Add context for your decision (optional)"/></label><div className="review-actions"><button className="danger-button" onClick={()=>updateReview("Rejected")}><X size={15}/> Reject</button><button className="primary" onClick={()=>updateReview("Approved")}><Check size={16}/> Approve content</button></div><button className="text-button full" onClick={()=>{setContent(activeReview.finalContent??activeReview.original);setTitle(activeReview.title);setPage("check");setAnalysis(null);}}>Re-check edited content <ArrowUpRight size={14}/></button><p className="muted tiny">Approval records your human decision. Review the final text carefully before approving.</p></div></div>}
      </section>}
      {page === "account" && <section className="page">
        <div className="eyebrow">WORKSPACE / TEAM ACCESS</div>
        <div className="page-heading-row"><div><h1>Team workspace</h1><p>Sign in to share brand guidelines and review history across your team.</p></div><Badge kind={currentUser ? "success" : "warning"}>{currentUser ? "Connected" : "Local demo mode"}</Badge></div>
        {currentUser ? <div className="panel">
          <div className="eyebrow">SIGNED-IN ACCOUNT</div><h2>{currentUser.name}</h2>
          <p className="muted">{currentUser.email} · {currentUser.role}</p>
          <div className="rule-box"><small>SHARED WORKSPACE</small><p>{workspaceInfo?.name || "Team workspace"}</p><small>INVITE CODE</small><p style={{fontSize:18,letterSpacing:2}}>{workspaceInfo?.invite_code || "Not available"}</p><p className="muted">Share this code only with trusted team members. They can join using the same invite code.</p></div>
          <button className="danger-button" onClick={signOut}><LogOut size={15}/> Sign out</button>
        </div> : <div className="panel" style={{maxWidth:650}}>
          <div className="segmented-control" style={{display:"flex",gap:8,marginBottom:18}}>
            <button className={authMode==="login"?"primary":"secondary"} onClick={()=>setAuthMode("login")}>Sign in</button>
            <button className={authMode==="signup"?"primary":"secondary"} onClick={()=>setAuthMode("signup")}>Create / join workspace</button>
          </div>
          <form onSubmit={submitAuth}>
            {authMode==="signup" && <>
              <label className="field-label">Your name<input required value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Name"/></label>
              <label className="field-label">Workspace name<input value={authWorkspace} onChange={e=>setAuthWorkspace(e.target.value)} placeholder="Required when creating a new workspace"/></label>
              <label className="field-label">Invite code (leave blank to create a new workspace)<input value={authInvite} onChange={e=>setAuthInvite(e.target.value)} placeholder="Team invite code"/></label>
              {authInvite && <label className="field-label">Team role<select value={authRole} onChange={e=>setAuthRole(e.target.value)}><option value="creator">Content creator</option><option value="reviewer">Reviewer</option></select></label>}
            </>}
            <label className="field-label">Email<input required type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com"/></label>
            <label className="field-label">Password<input required type="password" minLength={10} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="At least 10 characters"/></label>
            <button className="primary" type="submit" disabled={authBusy}>{authBusy?<><span className="spinner"/> Connecting...</>:authMode==="login"?"Sign in":"Create account / join team"}</button>
          </form>
          <p className="muted tiny">Local demo mode remains available without signing in. Shared team accounts require the Cloudflare D1 database to be configured.</p>
        </div>}
      </section>}
      {page === "visual" && <section className="page">
        <div className="eyebrow">BRAND GOVERNANCE / VISUAL REVIEW</div>
        <div className="page-heading-row"><div><h1>Visual brand checks</h1><p>Compare a creative against your configured brand palette and logo reference.</p></div><Badge kind="info"><ImageIcon size={13}/> Image analysis</Badge></div>
        <div className="knowledge-grid">
          <div className="panel">
            <div className="eyebrow">BRAND REFERENCES</div><h2>Set visual identity</h2>
            <label className="field-label">Approved brand colours (HEX, comma-separated)
              <input value={paletteDraft} onChange={e=>setPaletteDraft(e.target.value)} placeholder="#20cfa0, #0b1828"/>
            </label>
            <button className="secondary" onClick={()=>{
              const colors=paletteDraft.split(",").map(x=>x.trim()).filter(x=>/^#[0-9a-f]{6}$/i.test(x));
              if(!colors.length){notify("Enter at least one valid HEX colour, e.g. #20cfa0.");return;}
              updateBrand({...brand,visual:{...(brand.visual||{}),colors}});
              notify("Approved colour palette saved.");
            }}><Save size={14}/> Save palette</button>
            <label className="field-label">Logo reference image
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{
                const f=e.target.files?.[0]; if(!f)return;
                try{const logoSignature=await makeLogoReference(f);updateBrand({...brand,visual:{...(brand.visual||{}),logoSignature}});notify("Logo reference saved in this browser.");}
                catch(err){notify(err.message || "Could not read logo image.");}
              }}/>
            </label>
            <p className="muted tiny">Use a clean, square logo image on a plain background for the approximate visual comparison.</p>
          </div>
          <div className="panel">
            <div className="eyebrow">CREATIVE TO REVIEW</div><h2>Upload a marketing image</h2>
            <label className="field-label">Image file (PNG, JPG or WebP)
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setVisualFile(e.target.files?.[0]||null);setVisualResult(null);}}/>
            </label>
            {visualFile && <p className="muted">{visualFile.name} · {(visualFile.size/1024).toFixed(0)} KB</p>}
            <button className="primary" disabled={!visualFile||visualBusy} onClick={async()=>{
              setVisualBusy(true);setVisualResult(null);
              try{setVisualResult(await analyzeVisualCreative(visualFile,brand));}
              catch(err){notify(err.message||"Visual analysis failed.");}
              finally{setVisualBusy(false);}
            }}>{visualBusy?<><span className="spinner"/> Checking image...</>:<><Sparkles size={15}/> Analyze creative</>}</button>
          </div>
        </div>
        {visualResult && <div className="panel">
          <div className="panel-head"><div><div className="eyebrow">VISUAL ANALYSIS COMPLETE</div><h2>Creative review findings</h2></div><Badge kind="warning">Human confirmation required</Badge></div>
          <div className="two-fields"><div><b>Image dimensions</b><p className="muted">{visualResult.width} × {visualResult.height}px</p></div><div><b>Dominant sampled colours</b><div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>{visualResult.colors.map(c=><span key={c} title={c} style={{width:28,height:28,borderRadius:6,background:c,border:"1px solid #789"}} />)}</div></div></div>
          {visualResult.findings.map((f,i)=><div className="compact-issue" key={i}><div className="issue-top"><b>{f.title}</b><Badge kind={f.severity==="Medium"?"warning":"info"}>{f.severity}</Badge></div><p>{f.detail}</p></div>)}
          <p className="muted tiny">{visualResult.disclaimer}</p>
        </div>}
      </section>}
      <footer className="footer"><span>© 2026 Suraksha Setu</span><span>AI-assisted review · Human decision required</span></footer>
    </main>
    {notice && <div className="toast"><CheckCircle2 size={16}/>{notice}</div>}
  </div>;
}