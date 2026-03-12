import { useState, useEffect, useCallback } from 'react';
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

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list view, 'new' = create, id = edit
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState({ category: '', difficulty: '' });

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
      // Normalize languages: ensure every lang key has an entry
      const langs = {};
      for (const l of LANGUAGES) {
        langs[l] = q.languages?.[l] || { starterCode: '', wrapperFn: 'solve' };
      }
      setForm({
        slug: q.slug, title: q.title, category: q.category, difficulty: q.difficulty,
        timeLimitSeconds: q.timeLimitSeconds, description: q.description, prompt: q.prompt,
        languages: langs,
        testCases: Array.isArray(q.testCases) ? q.testCases : [],
        topics: Array.isArray(q.topics) ? q.topics : [],
        isActive: q.isActive,
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await fetchAPI(`/admin/questions/${id}`, { method: 'DELETE' });
      setSuccess('Question deleted');
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
      // Clean empty languages
      const cleanLangs = {};
      for (const [lang, data] of Object.entries(form.languages)) {
        if (data.starterCode.trim()) {
          cleanLangs[lang] = data;
        }
      }

      const body = { ...form, languages: cleanLangs };

      if (editing === 'new') {
        await fetchAPI('/admin/questions', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setSuccess('Question created!');
      } else {
        await fetchAPI(`/admin/questions/${editing}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        setSuccess('Question updated!');
      }
      setEditing(null);
      loadQuestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Test case helpers ───
  const addTestCase = () => {
    setForm(f => ({
      ...f,
      testCases: [...f.testCases, { input: [], expected: '', visible: true }],
    }));
  };

  const removeTestCase = (idx) => {
    setForm(f => ({
      ...f,
      testCases: f.testCases.filter((_, i) => i !== idx),
    }));
  };

  const updateTestCase = (idx, field, value) => {
    setForm(f => ({
      ...f,
      testCases: f.testCases.map((tc, i) =>
        i === idx ? { ...tc, [field]: value } : tc
      ),
    }));
  };

  // ─── Filtered list ───
  const filtered = questions.filter(q => {
    if (filter.category && q.category !== filter.category) return false;
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
    return true;
  });

  const diffColor = (d) => d === 'Easy' ? '#00ff87' : d === 'Medium' ? '#ffd700' : '#ff006e';

  // ─── FORM VIEW ───
  if (editing !== null) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            {editing === 'new' ? '➕ New Question' : '✏️ Edit Question'}
          </h1>
          <button style={styles.backBtn} onClick={() => { setEditing(null); setError(''); setSuccess(''); }}>
            ← Back to List
          </button>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <div style={styles.formGrid}>
          {/* Left column: Basic info */}
          <div style={styles.formCol}>
            <h3 style={styles.sectionTitle}>📋 Basic Info</h3>
            <label style={styles.label}>Title *</label>
            <input style={styles.input} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Add Two Numbers" />

            <label style={styles.label}>Slug * <span style={styles.hint}>(unique URL-safe ID)</span></label>
            <input style={styles.input} value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="e.g. add-two-numbers" />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Category *</label>
                <select style={styles.select} value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Difficulty *</label>
                <select style={styles.select} value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Time (sec)</label>
                <input style={styles.input} type="number" value={form.timeLimitSeconds}
                  onChange={e => setForm(f => ({ ...f, timeLimitSeconds: parseInt(e.target.value) || 120 }))} />
              </div>
            </div>

            <label style={styles.label}>Description *</label>
            <textarea style={{ ...styles.input, minHeight: '80px' }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Full problem description..." />

            <label style={styles.label}>Prompt * <span style={styles.hint}>(short instruction)</span></label>
            <textarea style={{ ...styles.input, minHeight: '50px' }} value={form.prompt}
              onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
              placeholder="e.g. Implement solve(a, b) that returns the sum" />

            <label style={styles.label}>Topics <span style={styles.hint}>(comma-separated)</span></label>
            <input style={styles.input}
              value={Array.isArray(form.topics) ? form.topics.join(', ') : ''}
              onChange={e => setForm(f => ({ ...f, topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
              placeholder="e.g. math, basic" />

            <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Active (appears in matchmaking)
            </label>
          </div>

          {/* Right column: Test cases */}
          <div style={styles.formCol}>
            <h3 style={styles.sectionTitle}>🧪 Test Cases</h3>
            {form.testCases.map((tc, idx) => (
              <div key={idx} style={styles.testCaseRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#aaa', fontSize: '0.8rem' }}>Test #{idx + 1}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input type="checkbox" checked={tc.visible}
                        onChange={() => updateTestCase(idx, 'visible', !tc.visible)} />
                      Visible
                    </label>
                    <button style={styles.removeBtn} onClick={() => removeTestCase(idx)}>✕</button>
                  </div>
                </div>
                <label style={{ ...styles.label, fontSize: '0.8rem' }}>Input (JSON array)</label>
                <input style={styles.input}
                  value={typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)}
                  onChange={e => {
                    try { updateTestCase(idx, 'input', JSON.parse(e.target.value)); }
                    catch { updateTestCase(idx, 'input', e.target.value); }
                  }}
                  placeholder='[1, 2]' />
                <label style={{ ...styles.label, fontSize: '0.8rem' }}>Expected (JSON value)</label>
                <input style={styles.input}
                  value={typeof tc.expected === 'string' ? tc.expected : JSON.stringify(tc.expected)}
                  onChange={e => {
                    try { updateTestCase(idx, 'expected', JSON.parse(e.target.value)); }
                    catch { updateTestCase(idx, 'expected', e.target.value); }
                  }}
                  placeholder='3' />
              </div>
            ))}
            <button style={styles.addTestBtn} onClick={addTestCase}>+ Add Test Case</button>
          </div>
        </div>

        {/* Language boilerplate */}
        <h3 style={{ ...styles.sectionTitle, marginTop: '2rem' }}>💻 Boilerplate Code</h3>
        <div style={styles.langGrid}>
          {LANGUAGES.map(lang => (
            <div key={lang} style={styles.langCard}>
              <label style={styles.label}>{LANG_LABELS[lang]}</label>
              <textarea
                style={{ ...styles.input, minHeight: '100px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={form.languages[lang]?.starterCode || ''}
                onChange={e => setForm(f => ({
                  ...f,
                  languages: { ...f.languages, [lang]: { ...f.languages[lang], starterCode: e.target.value } },
                }))}
                placeholder={`Starter code for ${LANG_LABELS[lang]}...`}
              />
              <input style={{ ...styles.input, marginTop: '0.3rem' }}
                value={form.languages[lang]?.wrapperFn || 'solve'}
                onChange={e => setForm(f => ({
                  ...f,
                  languages: { ...f.languages, [lang]: { ...f.languages[lang], wrapperFn: e.target.value } },
                }))}
                placeholder="Wrapper function name (e.g. solve)" />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving...' : editing === 'new' ? '✅ Create Question' : '💾 Update Question'}
          </button>
          <button style={styles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📝 Question Manager</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: '#888' }}>{questions.length} questions</span>
          <button style={styles.newBtn} onClick={handleNew}>+ New Question</button>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {success && <div style={styles.successBanner}>{success}</div>}

      {/* Filters */}
      <div style={styles.filterRow}>
        <select style={styles.filterSelect} value={filter.category}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={styles.filterSelect} value={filter.difficulty}
          onChange={e => setFilter(f => ({ ...f, difficulty: e.target.value }))}>
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Loading questions...</div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ flex: 3 }}>Title</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Category</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Difficulty</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Time</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Status</span>
            <span style={{ flex: 1.5, textAlign: 'center' }}>Actions</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No questions found</div>
          ) : (
            filtered.map(q => (
              <div key={q.id} style={styles.tableRow}>
                <span style={{ flex: 3, fontWeight: 600 }}>{q.title}</span>
                <span style={{ flex: 1, textAlign: 'center' }}>
                  <span style={styles.catBadge}>{q.category}</span>
                </span>
                <span style={{ flex: 1, textAlign: 'center', color: diffColor(q.difficulty), fontWeight: 700 }}>
                  {q.difficulty}
                </span>
                <span style={{ flex: 1, textAlign: 'center', color: '#aaa' }}>
                  {Math.floor(q.timeLimitSeconds / 60)}m
                </span>
                <span style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ ...styles.statusBadge, background: q.isActive ? '#00ff8720' : '#ff006e20', color: q.isActive ? '#00ff87' : '#ff006e' }}>
                    {q.isActive ? 'Active' : 'Inactive'}
                  </span>
                </span>
                <span style={{ flex: 1.5, textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button style={styles.editBtn} onClick={() => handleEdit(q.id)}>Edit</button>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(q.id)}>Delete</button>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline styles ───────────────────────────────────────
const styles = {
  container: {
    maxWidth: '1200px', margin: '0 auto', padding: '2rem',
    fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#e0e0e0',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem',
  },
  title: { margin: 0, fontSize: '1.8rem', color: '#fff' },
  newBtn: {
    padding: '0.6rem 1.2rem', background: 'linear-gradient(135deg, #00ff87, #00c9ff)',
    border: 'none', borderRadius: '8px', color: '#000', fontWeight: 700,
    cursor: 'pointer', fontSize: '0.95rem',
  },
  backBtn: {
    padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #555',
    borderRadius: '6px', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem',
  },
  errorBanner: {
    padding: '0.8rem 1rem', background: '#ff006e20', border: '1px solid #ff006e',
    borderRadius: '8px', color: '#ff006e', marginBottom: '1rem',
  },
  successBanner: {
    padding: '0.8rem 1rem', background: '#00ff8720', border: '1px solid #00ff87',
    borderRadius: '8px', color: '#00ff87', marginBottom: '1rem',
  },
  filterRow: {
    display: 'flex', gap: '1rem', marginBottom: '1rem',
  },
  filterSelect: {
    padding: '0.5rem 0.8rem', background: '#1a1a2e', border: '1px solid #333',
    borderRadius: '6px', color: '#e0e0e0', fontSize: '0.9rem',
  },
  table: {
    background: '#0d0d1a', borderRadius: '12px', overflow: 'hidden',
    border: '1px solid #1a1a2e',
  },
  tableHeader: {
    display: 'flex', padding: '0.8rem 1.2rem', background: '#1a1a2e',
    fontWeight: 700, color: '#888', fontSize: '0.85rem', textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    display: 'flex', padding: '0.8rem 1.2rem', borderBottom: '1px solid #1a1a2e',
    alignItems: 'center', transition: 'background 0.2s',
  },
  catBadge: {
    padding: '0.2rem 0.6rem', background: '#ffffff10', borderRadius: '4px',
    fontSize: '0.8rem', color: '#aaa',
  },
  statusBadge: {
    padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
  },
  editBtn: {
    padding: '0.3rem 0.8rem', background: '#ffd70020', border: '1px solid #ffd700',
    borderRadius: '6px', color: '#ffd700', cursor: 'pointer', fontSize: '0.8rem',
  },
  deleteBtn: {
    padding: '0.3rem 0.8rem', background: '#ff006e20', border: '1px solid #ff006e',
    borderRadius: '6px', color: '#ff006e', cursor: 'pointer', fontSize: '0.8rem',
  },
  // ─── Form styles ───
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem',
  },
  formCol: {
    background: '#0d0d1a', borderRadius: '12px', padding: '1.5rem',
    border: '1px solid #1a1a2e',
  },
  sectionTitle: {
    color: '#fff', marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem',
  },
  label: {
    display: 'block', color: '#aaa', fontSize: '0.85rem', marginBottom: '0.3rem',
    marginTop: '0.8rem',
  },
  hint: { color: '#555', fontSize: '0.75rem' },
  input: {
    width: '100%', padding: '0.6rem 0.8rem', background: '#111122',
    border: '1px solid #333', borderRadius: '6px', color: '#e0e0e0',
    fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical',
  },
  select: {
    width: '100%', padding: '0.6rem 0.8rem', background: '#111122',
    border: '1px solid #333', borderRadius: '6px', color: '#e0e0e0',
    fontSize: '0.9rem',
  },
  testCaseRow: {
    background: '#111122', borderRadius: '8px', padding: '0.8rem',
    marginBottom: '0.8rem', border: '1px solid #222',
  },
  removeBtn: {
    background: '#ff006e30', border: 'none', color: '#ff006e',
    borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.8rem',
  },
  addTestBtn: {
    padding: '0.5rem 1rem', background: '#ffffff10', border: '1px dashed #555',
    borderRadius: '6px', color: '#aaa', cursor: 'pointer', fontSize: '0.85rem',
    width: '100%', marginTop: '0.5rem',
  },
  langGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  langCard: {
    background: '#0d0d1a', borderRadius: '8px', padding: '1rem',
    border: '1px solid #1a1a2e',
  },
  saveBtn: {
    padding: '0.8rem 2rem', background: 'linear-gradient(135deg, #00ff87, #00c9ff)',
    border: 'none', borderRadius: '8px', color: '#000', fontWeight: 700,
    cursor: 'pointer', fontSize: '1rem',
  },
  cancelBtn: {
    padding: '0.8rem 2rem', background: 'transparent', border: '1px solid #555',
    borderRadius: '8px', color: '#aaa', cursor: 'pointer', fontSize: '1rem',
  },
};
