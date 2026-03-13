import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAPI } from '../lib/api';

const CATEGORIES = ['math', 'array', 'string', 'tree', 'graph', 'dp', 'linked-list', 'sql'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const LANGUAGES = ['javascript', 'python', 'typescript', 'java', 'cpp', 'csharp', 'go', 'rust'];

const LANG_LABELS = {
  javascript: 'JavaScript', python: 'Python', typescript: 'TypeScript',
  java: 'Java', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust',
};

const emptyForm = () => ({
  slug: '', title: '', category: 'math', difficulty: 'Easy',
  timeLimitSeconds: 1800, description: '', prompt: '',
  languages: Object.fromEntries(LANGUAGES.map(l => [l, { starterCode: '', wrapperFn: 'solve' }])),
  testCases: [{ input: [], expected: '', visible: true }],
  topics: [],
  isActive: true,
});

const generateSlug = (title) => {
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list view, 'new' = create, id = edit, 'import' = json bulk
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState({ category: '', difficulty: '' });

  // Import State
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // UI state for form
  const [activeTab, setActiveTab] = useState('javascript');
  const [tcOpen, setTcOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(true);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAPI('/admin/questions');
      setQuestions(data.questions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const handleEdit = async (id) => {
    try {
      const data = await fetchAPI(`/admin/questions/${id}`);
      const q = data.question;
      const langs = {};
      for (const l of LANGUAGES) {
        langs[l] = q.languages?.[l] || { starterCode: '', wrapperFn: 'solve' };
      }
      setForm({
        ...q,
        languages: langs,
        testCases: Array.isArray(q.testCases) ? q.testCases : [],
        topics: Array.isArray(q.topics) ? q.topics : [],
      });
      setEditing(id);
      setError('');
      setSuccess('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNew = () => {
    setForm(emptyForm());
    setEditing('new');
    setError('');
    setSuccess('');
  };

  const handleOpenImport = () => {
    setEditing('import');
    setImportData(null);
    setImportResults(null);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('🗑️ Delete this question permanently?')) return;
    try {
      await fetchAPI(`/admin/questions/${id}`, { method: 'DELETE' });
      setSuccess('Question deleted! 💥');
      loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const cleanLangs = {};
      for (const [lang, data] of Object.entries(form.languages)) {
        if (data.starterCode.trim()) cleanLangs[lang] = data;
      }

      const body = { ...form, languages: cleanLangs };

      if (editing === 'new') {
        await fetchAPI('/admin/questions', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setSuccess('New question deployed! 🚀');
      } else {
        await fetchAPI(`/admin/questions/${editing}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        setSuccess('Question updated! ✅');
      }
      setEditing(null);
      loadQuestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setSuccess('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!Array.isArray(json)) throw new Error("JSON must be an array of questions.");
        
        const mappedQuestions = json.map(q => {
          // Map solutions to boilerplate format
          const languages = {};
          for (const lang of LANGUAGES) {
             languages[lang] = { starterCode: '', wrapperFn: 'solve' };
          }
          
          let codesArray = [];
          if (q.solutions && Array.isArray(q.solutions)) codesArray = q.solutions;
          else if (q.starterCodes && Array.isArray(q.starterCodes)) codesArray = q.starterCodes;

          codesArray.forEach(sol => {
             const l = sol.language?.toLowerCase();
             if (LANGUAGES.includes(l)) {
                languages[l] = { starterCode: sol.code || '', wrapperFn: 'solve' };
             }
          });
          
          // Map sampleCases
          const testCases = (q.sampleCases || []).map(tc => {
             let expectedVal = tc.output || "";
             if (typeof expectedVal === 'string' && expectedVal.trim().includes('\n')) {
                 expectedVal = expectedVal.split('\n')[0].trim();
             }
             return {
                input: tc.input || "",
                expected: expectedVal,
                visible: true
             };
          });

          const cat = (q.topics && q.topics.length > 0) ? q.topics[0].toLowerCase() : 'math';
          const validCat = CATEGORIES.includes(cat) ? cat : 'math';

          return {
             slug: generateSlug(q.title || `q-${q.problemId}`),
             title: q.title || `Question ${q.problemId}`,
             category: validCat,
             difficulty: q.difficulty || 'Medium',
             timeLimitSeconds: 1800,
             description: q.description || '',
             prompt: `Write a function to solve: ${q.title || 'the problem'}`,
             languages: languages,
             testCases: testCases,
             topics: q.topics || [],
             isActive: true
          };
        });
        
        setImportData(mappedQuestions);
      } catch (err) {
        setError(`Failed to parse JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeBulkImport = async () => {
    setImporting(true);
    setError('');
    setSuccess('');
    setImportResults(null);
    try {
      const res = await fetchAPI('/admin/questions/bulk-import', {
        method: 'POST',
        body: JSON.stringify(importData)
      });
      setImportResults(res);
      if (res.successCount > 0) {
        setSuccess(`✅ ${res.successCount} questions imported successfully!`);
        loadQuestions();
      }
      if (res.errors && res.errors.length > 0) {
        setError(`⚠️ ${res.errors.length} questions failed to import.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const addTestCase = () => {
    setForm(f => ({ ...f, testCases: [...f.testCases, { input: [], expected: '', visible: true }] }));
  };

  const removeTestCase = (idx) => {
    setForm(f => ({ ...f, testCases: f.testCases.filter((_, i) => i !== idx) }));
  };

  const updateTestCase = (idx, field, value) => {
    setForm(f => ({
      ...f, testCases: f.testCases.map((tc, i) => i === idx ? { ...tc, [field]: value } : tc)
    }));
  };

  const filtered = questions.filter(q => {
    if (filter.category && q.category !== filter.category) return false;
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
    return true;
  });

  const getDifficultyBadge = (d) => `badge badge--${(d && d.toLowerCase()) || 'medium'}`;

  // ─── IMPORT VIEW ───
  if (editing === 'import') {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', marginBottom: '2rem' }}>
          <div>
            <h1>📤 BULK JSON IMPORT</h1>
            <p>Upload a massive payload of levels at once</p>
          </div>
          <button className="retro-btn retro-btn--ghost" onClick={() => setEditing(null)}>
            ← BACK TO HUB
          </button>
        </div>

        {error && <div className="toast toast--error" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1.5rem', maxWidth: '100%' }}>{error}</div>}
        {success && <div className="toast toast--success" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1.5rem', maxWidth: '100%' }}>{success}</div>}

        <div className="retro-card" style={{ textAlign: 'center', padding: '3rem', borderStyle: 'dashed', borderWidth: '4px', borderColor: 'var(--orange-400)', background: 'var(--cream-dark)' }}>
          <h2 style={{ color: 'var(--ink)', marginBottom: '1rem' }}>DRAG & DROP JSON DATA LOG</h2>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--ink-muted)', marginBottom: '2rem' }}>
            Must be an array of objects containing title, difficulty, description, sampleCases, starterCodes, etc.
          </p>
          <input type="file" ref={fileInputRef} accept=".json" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="retro-btn retro-btn--primary retro-btn--large" onClick={() => fileInputRef.current?.click()}>
            📁 SELECT .JSON FILE
          </button>
        </div>

        {importData && !importResults && (
           <div className="retro-card" style={{ marginTop: '2rem', animation: 'slide-up 0.3s ease' }}>
             <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--orange-600)', fontSize: '2rem', marginBottom: '1rem' }}>
               📡 UPLOAD PREVIEW
             </h3>
             <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '1.5rem' }}>
               Ready to inject <strong>{importData.length}</strong> questions into the database.
             </p>
             <button className="retro-btn retro-btn--success retro-btn--large retro-btn--glow" style={{ width: '100%' }} onClick={executeBulkImport} disabled={importing}>
               {importing ? '🔄 INJECTING DATA...' : '⚡ INITIALIZE BULK IMPORT ⚡'}
             </button>
           </div>
        )}

        {importResults && (
          <div className="retro-card" style={{ marginTop: '2rem' }}>
             <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '1rem', color: importResults.errors?.length > 0 ? 'var(--neon-pink)' : 'var(--neon-green)' }}>
               📊 AFTER ACTION REPORT
             </h3>
             <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                <div className="stats-grid__item">
                   <div className="stats-grid__value" style={{ color: 'var(--ink)' }}>{importResults.total}</div>
                   <div className="stats-grid__label">TOTAL DETECTED</div>
                </div>
                <div className="stats-grid__item" style={{ borderColor: 'var(--neon-green)', background: '#eeffee' }}>
                   <div className="stats-grid__value" style={{ color: 'var(--neon-green-dim)' }}>{importResults.successCount}</div>
                   <div className="stats-grid__label">SUCCESSFULLY IMPORTED</div>
                </div>
                <div className="stats-grid__item" style={{ borderColor: 'var(--neon-pink)', background: '#ffeeee' }}>
                   <div className="stats-grid__value" style={{ color: 'var(--neon-pink-dim)' }}>{importResults.errors?.length || 0}</div>
                   <div className="stats-grid__label">FAILED / REJECTED</div>
                </div>
             </div>

             {importResults.errors?.length > 0 && (
               <div style={{ background: '#2d2d2d', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                 <h4 style={{ color: 'var(--neon-pink)', marginBottom: '1rem', borderBottom: '2px solid #555', paddingBottom: '0.5rem' }}>FAILED INJECTIONS (DUPLICATES OR ERRORS)</h4>
                 {importResults.errors.map((e, i) => (
                   <div key={i} style={{ padding: '0.5rem', borderBottom: '1px solid #444', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                     <strong style={{ color: 'var(--orange-400)' }}>{e.title}</strong>: <span style={{ color: '#ccc' }}>{e.error}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </div>
    );
  }

  // ─── FORM VIEW ───
  if (editing !== null) {
    return (
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', marginBottom: '2rem' }}>
          <div>
            <h1>{editing === 'new' ? '➕ CREATE LEVEL' : '✏️ EDIT LEVEL'}</h1>
            <p>Configure the challenge parameters</p>
          </div>
          <button className="retro-btn retro-btn--ghost" onClick={() => setEditing(null)}>
            ← BACK TO HUB
          </button>
        </div>

        {error && <div className="toast toast--error" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1.5rem', maxWidth: '100%' }}>🚨 {error}</div>}
        {success && <div className="toast toast--success" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1.5rem', maxWidth: '100%' }}>✅ {success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
          
          {/* LEFT COL: BASIC INFO */}
          <div className="retro-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--orange-600)', fontSize: '1.8rem', borderBottom: 'var(--border-thick)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              📋 CORE SPECS
            </h3>

            <div className="form-group">
              <label>TITLE <span style={{ color: 'var(--neon-pink)', fontSize: '1.5rem', lineHeight: 0.5 }}>*</span></label>
              <input className="retro-input" value={form.title} placeholder="e.g. Defeat the Dragon" 
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>SLUG / ID <span style={{ color: 'var(--neon-pink)', fontSize: '1.5rem', lineHeight: 0.5 }}>*</span></label>
              <input className="retro-input" value={form.slug} placeholder="defeat-dragon" 
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>CATEGORY</label>
                <select className="retro-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>DIFFICULTY</label>
                <select className="retro-select" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>TIME (SEC)</label>
                <input type="number" className="retro-input" value={form.timeLimitSeconds} 
                  onChange={e => setForm(f => ({ ...f, timeLimitSeconds: parseInt(e.target.value) || 120 }))} />
              </div>
            </div>

            <div className="form-group">
              <label>FULL DESCRIPTION <span style={{ color: 'var(--neon-pink)', fontSize: '1.5rem', lineHeight: 0.5 }}>*</span></label>
              <textarea className="retro-input" style={{ minHeight: '120px', resize: 'vertical' }} value={form.description} 
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Explain the problem here... Markdown is supported if implemented." />
            </div>

            <div className="form-group">
              <label>IN-GAME PROMPT <span style={{ color: 'var(--neon-pink)', fontSize: '1.5rem', lineHeight: 0.5 }}>*</span></label>
              <textarea className="retro-input" style={{ minHeight: '80px', resize: 'vertical' }} value={form.prompt} 
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} placeholder="Short objective summary: Write function solve(a, b)..." />
            </div>

            <div className="form-group">
              <label>TOPICS <span style={{ color: 'var(--ink-muted)' }}>(comma-separated)</span></label>
              <input className="retro-input" value={Array.isArray(form.topics) ? form.topics.join(', ') : ''} 
                onChange={e => setForm(f => ({ ...f, topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} placeholder="math, linked-list, tricky" />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <input type="checkbox" id="isActive" checked={form.isActive} style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--orange-600)' }} 
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="isActive" style={{ cursor: 'pointer', fontWeight: 'bold' }}>ACTIVE PLAYABLE LEVEL</label>
            </div>
          </div>

          {/* RIGHT COL: TEST CASES */}
          <div className="retro-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--cream-dark)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-thick)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
               <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-pink)', fontSize: '1.8rem', margin: 0 }}>
                 🧪 TEST CHAMBER
               </h3>
               <button className="retro-btn" style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem' }} onClick={addTestCase}>
                 + ADD TEST
               </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '600px', paddingRight: '0.5rem' }}>
              {form.testCases.map((tc, idx) => (
                <div key={idx} style={{ background: 'white', border: '3px solid #000', borderRadius: '8px', padding: '1rem', position: 'relative', boxShadow: '3px 3px 0 #000' }}>
                  <div style={{ position: 'absolute', top: '-10px', left: '10px', background: 'var(--neon-yellow)', padding: '0 8px', border: '2px solid #000', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                    TEST #{idx + 1}
                  </div>
                  <button onClick={() => removeTestCase(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--neon-pink)', color: 'white', border: '2px solid #000', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem' }}>INPUT (JSON ARRAY)</label>
                    <input className="retro-input" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} value={typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)}
                      onChange={e => { try { updateTestCase(idx, 'input', JSON.parse(e.target.value)); } catch { updateTestCase(idx, 'input', e.target.value); } }}
                      placeholder='[1, 2]' />
                  </div>
                  
                  <div className="form-group">
                    <label style={{ fontSize: '0.9rem' }}>EXPECTED (JSON VALUE)</label>
                    <input className="retro-input" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} value={typeof tc.expected === 'string' ? tc.expected : JSON.stringify(tc.expected)}
                      onChange={e => { try { updateTestCase(idx, 'expected', JSON.parse(e.target.value)); } catch { updateTestCase(idx, 'expected', e.target.value); } }}
                      placeholder='3' />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="checkbox" checked={tc.visible} id={`visible-${idx}`} style={{ accentColor: 'var(--neon-pink)' }} onChange={() => updateTestCase(idx, 'visible', !tc.visible)} />
                    <label htmlFor={`visible-${idx}`} style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Visible to Player</label>
                  </div>
                </div>
              ))}
              {form.testCases.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                  No test cases defined. Players will always pass!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM FULL WIDTH: BOILERPLATE CONFIG */}
        <div className="admin-collapsible" style={{ marginTop: '2rem' }}>
          <div className="admin-collapsible-header" onClick={() => setCodeOpen(!codeOpen)}>
            <span>💻 STARTER CODE & LOADOUTS</span>
            <span>{codeOpen ? '▼' : '▶'}</span>
          </div>
          {codeOpen && (
            <div className="admin-collapsible-content">
              <div className="admin-tabs">
                {LANGUAGES.map(lang => (
                  <button key={lang} 
                    className={`admin-tab ${activeTab === lang ? 'admin-tab--active' : ''}`}
                    onClick={() => setActiveTab(lang)}>
                    {LANG_LABELS[lang]}
                  </button>
                ))}
              </div>
              
              <div style={{ background: '#1e1e1e', padding: '1.5rem', borderRadius: '8px', border: 'var(--border-thick)', boxShadow: '4px 4px 0 var(--ink)' }}>
                 <div className="form-group">
                    <label style={{ color: 'var(--cream)' }}>Starter Code snippet for {LANG_LABELS[activeTab]}</label>
                    <textarea className="retro-input" style={{ minHeight: '200px', fontFamily: 'var(--font-mono)', background: '#2d2d2d', color: '#e0e0e0', border: '2px solid #555' }}
                      value={form.languages[activeTab]?.starterCode || ''}
                      onChange={e => setForm(f => ({
                        ...f, languages: { ...f.languages, [activeTab]: { ...f.languages[activeTab], starterCode: e.target.value } }
                      }))}
                      placeholder={`// Starter code for ${LANG_LABELS[activeTab]}...\nfunction solve(a, b) {\n\n}`}
                    />
                 </div>
                 <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--cream)' }}>Function Entrypoint (Wrapper Name)</label>
                    <input className="retro-input" style={{ background: '#2d2d2d', color: '#e0e0e0', border: '2px solid #555', fontFamily: 'var(--font-mono)' }}
                      value={form.languages[activeTab]?.wrapperFn || 'solve'}
                      onChange={e => setForm(f => ({
                        ...f, languages: { ...f.languages, [activeTab]: { ...f.languages[activeTab], wrapperFn: e.target.value } }
                      }))}
                      placeholder="solve" />
                 </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center' }}>
          <button className="retro-btn retro-btn--primary retro-btn--large retro-btn--glow" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ SAVING...' : editing === 'new' ? '✅ DEPLOY QUESTION' : '💾 SAVE CHANGES'}
          </button>
          <button className="retro-btn" onClick={() => setEditing(null)}>
            X CANCEL
          </button>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>👑 ADMIN TERMINAL</h1>
          <p>Manage the arcade question repository</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge--streak" style={{ fontSize: '1rem', padding: '0.4rem 0.8rem' }}>
             TOTAL: {questions.length}
          </span>
          <button className="retro-btn retro-btn--primary" onClick={handleOpenImport} style={{ background: 'var(--orange-500)' }}>
            📤 IMPORT JSON
          </button>
          <button className="retro-btn retro-btn--primary" onClick={handleNew}>
            + NEW LEVEL
          </button>
        </div>
      </div>

      {error && <div className="toast toast--error" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1.5rem', maxWidth: '100%' }}>🚨 {error}</div>}
      {success && <div className="toast toast--success" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1.5rem', maxWidth: '100%' }}>✅ {success}</div>}

      <div className="retro-card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink)' }}>
          <span style={{ fontSize: '1.5rem' }}>🔍</span> FILTERS
        </h3>
        <select className="retro-select" style={{ maxWidth: '200px' }} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="retro-select" style={{ maxWidth: '200px' }} value={filter.difficulty} onChange={e => setFilter(f => ({ ...f, difficulty: e.target.value }))}>
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <h2 style={{ marginLeft: '1rem', color: 'var(--orange-500)' }}>LOADING DATA...</h2>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="leaderboard-table" style={{ width: '100%', minWidth: '800px', borderSpacing: 0, borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--cream-dark)', borderBottom: 'var(--border-thick)' }}>
              <tr>
                <th style={{ padding: '1rem', borderRight: '2px solid var(--ink)', borderBottom: 'var(--border-thick)' }}>TITLE</th>
                <th style={{ padding: '1rem', borderRight: '2px solid var(--ink)', borderBottom: 'var(--border-thick)', textAlign: 'center' }}>CATEGORY</th>
                <th style={{ padding: '1rem', borderRight: '2px solid var(--ink)', borderBottom: 'var(--border-thick)', textAlign: 'center' }}>DIFFICULTY</th>
                <th style={{ padding: '1rem', borderRight: '2px solid var(--ink)', borderBottom: 'var(--border-thick)', textAlign: 'center' }}>TIME</th>
                <th style={{ padding: '1rem', borderRight: '2px solid var(--ink)', borderBottom: 'var(--border-thick)', textAlign: 'center' }}>STATUS</th>
                <th style={{ padding: '1rem', borderBottom: 'var(--border-thick)', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--ink-muted)' }}>
                     No challenges found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map(q => (
                  <tr key={q.id} style={{ transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--cream-dark)'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '1rem', borderRight: '2px dashed var(--ink-muted)', borderBottom: '2px solid var(--ink)' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{q.title}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-light)', fontFamily: 'var(--font-mono)' }}>{q.slug}</div>
                    </td>
                    <td style={{ padding: '1rem', borderRight: '2px dashed var(--ink-muted)', borderBottom: '2px solid var(--ink)', textAlign: 'center' }}>
                      <span className="badge badge--lang">{q.category}</span>
                    </td>
                    <td style={{ padding: '1rem', borderRight: '2px dashed var(--ink-muted)', borderBottom: '2px solid var(--ink)', textAlign: 'center' }}>
                      <span className={getDifficultyBadge(q.difficulty)}>{q.difficulty}</span>
                    </td>
                    <td style={{ padding: '1rem', borderRight: '2px dashed var(--ink-muted)', borderBottom: '2px solid var(--ink)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {Math.floor(q.timeLimitSeconds / 60)}m
                    </td>
                    <td style={{ padding: '1rem', borderRight: '2px dashed var(--ink-muted)', borderBottom: '2px solid var(--ink)', textAlign: 'center' }}>
                      <span className={`badge ${q.isActive ? 'badge--easy' : 'badge--hard'}`}>
                        {q.isActive ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '2px solid var(--ink)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button className="retro-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: 'var(--orange-300)' }} onClick={() => handleEdit(q.id)}>✏️</button>
                        <button className="retro-btn retro-btn--danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={() => handleDelete(q.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
