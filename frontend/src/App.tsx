import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  Droplets,
  FlaskConical,
  Gauge,
  History,
  Layers3,
  Leaf,
  Menu,
  Mountain,
  Plus,
  Search,
  Sprout,
  Trash2,
  Eye,
  Thermometer,
  Wheat,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import axios from 'axios';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { deleteHistoryItem, fetchDashboardData, fetchHistoryItem, predictCrop } from './api';
import type { DashboardData, FeatureKey, HistoryItem, ModelInfo, PredictionResponse } from './types';

const CropLandscape = lazy(() => import('./CropLandscape'));
const SoilAnalytics = lazy(() => import('./SoilAnalytics'));

const navItems = [
  { label: 'Dashboard', path: '/', icon: BarChart3 },
  { label: 'Crop Recommendation', path: '/predict', icon: Wheat },
  { label: 'Soil & Weather Analytics', path: '/analytics', icon: Droplets },
  { label: 'Prediction History', path: '/history', icon: History },
];

const inputSchema: Array<{ key: FeatureKey; label: string; unit: string; description: string; placeholder: string; sample: number; icon: LucideIcon }> = [
  { key: 'N', label: 'Nitrogen (N)', unit: 'kg/ha', description: 'Available nitrogen in the soil sample.', placeholder: 'Enter nitrogen level', sample: 90, icon: Leaf },
  { key: 'P', label: 'Phosphorus (P)', unit: 'kg/ha', description: 'Available phosphorus in the soil sample.', placeholder: 'Enter phosphorus level', sample: 42, icon: Layers3 },
  { key: 'K', label: 'Potassium (K)', unit: 'kg/ha', description: 'Available potassium in the soil sample.', placeholder: 'Enter potassium level', sample: 43, icon: Mountain },
  { key: 'temperature', label: 'Temperature', unit: '°C', description: 'Temperature value used by the training dataset.', placeholder: 'Enter temperature', sample: 20.8, icon: Thermometer },
  { key: 'humidity', label: 'Humidity', unit: '%', description: 'Relative humidity value used by the training dataset.', placeholder: 'Enter humidity', sample: 82, icon: Droplets },
  { key: 'ph', label: 'Soil pH', unit: 'pH', description: 'Measured pH of the soil sample.', placeholder: 'Enter soil pH', sample: 6.5, icon: Gauge },
  { key: 'rainfall', label: 'Rainfall', unit: 'mm', description: 'Rainfall value used by the training dataset.', placeholder: 'Enter rainfall', sample: 202.9, icon: CloudRain },
];

type PredictionFormValues = Record<FeatureKey, string>;
type PredictionResult = { data: PredictionResponse; submittedValues: Record<FeatureKey, number> };

const emptyValues: PredictionFormValues = {
  N: '',
  P: '',
  K: '',
  temperature: '',
  humidity: '',
  ph: '',
  rainfall: '',
};

const formatRangeBound = (value: number, direction: 'min' | 'max') => {
  const scale = 10_000;
  const rounded = direction === 'min' ? Math.ceil(value * scale) / scale : Math.floor(value * scale) / scale;
  return String(rounded);
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<DashboardData['health']>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [newPredictionKey, setNewPredictionKey] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchDashboardData();
        if (!active) return;
        setHealth(data.health);
        setModelInfo(data.modelInfo);
        setHistory(data.history ?? []);
        setHistoryAvailable(data.history !== null);

        if (!data.health || data.health.status !== 'ok') {
          setError('Cannot connect to the backend. Start it with "python backend\\app.py" from the project folder, then retry.');
        } else if (!data.modelInfo) {
          setError('The backend is reachable, but the crop model is unavailable.');
        } else if (!data.history) {
          setError('Prediction history could not be loaded. Dashboard totals are unavailable until the history service responds.');
        }
      } catch (err) {
        if (!active) return;
        setError(axios.isAxiosError(err) && !err.response
          ? 'Cannot connect to the backend. Start it with "python backend\\app.py" from the project folder, then retry.'
          : err instanceof Error ? err.message : 'Unable to load AgriClass AI data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [reloadKey, location.pathname]);

  const currentPage = navItems.find(({ path }) => path === location.pathname);
  const backendOnline = health?.status === 'ok';
  const modelOnline = backendOnline && modelInfo !== null;

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-shell theme-light">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-wrap">
          <div className="brand-icon"><Sprout size={20} /></div>
          <div>
            <div className="wordmark">AgriClass AI</div>
            <div className="brand-subtitle">Intelligent Agriculture</div>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} end={path === '/'} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            <div>
              <strong>{backendOnline ? 'Backend connected' : 'Backend offline'}</strong>
              <small>{modelOnline ? 'Model loaded' : backendOnline ? 'Model unavailable' : 'Waiting for service'}</small>
            </div>
          </div>
          <div className="version-label">AGRICLASS AI <span>v0.0.0</span></div>
        </div>
      </aside>

      <div className="content-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="page-context">
              <div className="breadcrumb"><NavLink to="/">Home</NavLink><ChevronRight size={13} /><span>{currentPage?.label ?? 'Dashboard'}</span></div>
              <h1>{currentPage?.label ?? 'Dashboard'}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div className={`service-pill ${backendOnline && modelOnline ? 'is-online' : 'is-offline'}`}>
              <span className="status-dot" />
              <span>{backendOnline && modelOnline ? 'System operational' : 'Service unavailable'}</span>
            </div>
            <NavLink to="/predict" className="primary-button" onClick={() => {
              setSidebarOpen(false);
              if (location.pathname === '/predict') setNewPredictionKey((key) => key + 1);
            }}>
              <Plus size={16} />
              <span>New Prediction</span>
            </NavLink>
          </div>
        </header>

        <main className="main-panel">
          <AnimatePresence mode="wait">
            <motion.div key={window.location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
              <Routes>
                <Route path="/" element={<OverviewPage modelInfo={modelInfo} history={history} historyAvailable={historyAvailable} backendOnline={backendOnline} modelOnline={modelOnline} loading={loading} error={error} onRetry={() => setReloadKey((key) => key + 1)} />} />
                <Route path="/predict" element={<PredictPage key={newPredictionKey} modelInfo={modelInfo} onPredictionSaved={() => setReloadKey((key) => key + 1)} />} />
                <Route path="/analytics" element={<Suspense fallback={<div className="dashboard-loading"><div /><div /><div /></div>}><SoilAnalytics history={history} historyAvailable={historyAvailable} loading={loading} error={error} modelInfo={modelInfo} onRetry={() => setReloadKey((key) => key + 1)} /></Suspense>} />
                <Route path="/history" element={<HistoryPage history={history} loading={loading} historyAvailable={historyAvailable} onRefresh={() => setReloadKey((key) => key + 1)} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
    </MotionConfig>
  );
}

function OverviewPage({
  modelInfo,
  history,
  historyAvailable,
  backendOnline,
  modelOnline,
  loading,
  error,
  onRetry,
}: {
  modelInfo: ModelInfo | null;
  history: HistoryItem[];
  historyAvailable: boolean;
  backendOnline: boolean;
  modelOnline: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) {
    return <div className="dashboard-loading"><div /><div /><div /></div>;
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const sortedHistory = [...history].sort((a, b) => {
    const timeA = Date.parse(a.created_at);
    const timeB = Date.parse(b.created_at);
    return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
  });
  const cropCounts = history.reduce<Record<string, number>>((counts, item) => {
    counts[item.prediction] = (counts[item.prediction] ?? 0) + 1;
    return counts;
  }, {});
  const mostRecommended = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])[0];
  const recentCount = history.filter((item) => {
    const timestamp = Date.parse(item.created_at);
    return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo && timestamp <= now;
  }).length;
  const chartData = Object.entries(cropCounts)
    .map(([crop, count]) => ({ crop, count }))
    .sort((a, b) => b.count - a.count || a.crop.localeCompare(b.crop));
  const recentPredictions = sortedHistory.slice(0, 5);

  return (
    <div className="dashboard-page">
      {error && (
        <div className="dashboard-alert" role="status">
          <div><span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} /><p>{error}</p></div>
          <button className="text-action" onClick={onRetry}>Retry connection <ArrowRight size={15} /></button>
        </div>
      )}

      <motion.section className="welcome-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span /> Agricultural intelligence platform</p>
          <h2>Grow Smarter<br />with <em>Data.</em></h2>
          <p className="hero-description">Turn soil conditions into informed crop recommendations with machine learning.</p>
          <div className="hero-actions">
            <NavLink to="/predict" className="primary-button hero-primary"><Plus size={17} /> Make a Prediction <ArrowUpRight size={15} /></NavLink>
            <NavLink to="/analytics" className="hero-secondary">Explore Analytics <ArrowRight size={15} /></NavLink>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-sun" />
          <div className="hero-plant"><Sprout size={118} strokeWidth={1.05} /></div>
          <div className="hero-leaf leaf-one"><Leaf size={43} strokeWidth={1.1} /></div>
          <div className="hero-leaf leaf-two"><Leaf size={35} strokeWidth={1.1} /></div>
          <div className="hero-art-label"><span /> GROWTH, GROUNDED IN DATA</div>
        </div>

      </motion.section>

      <section className="metric-grid" aria-label="Prediction summary">
        <MetricCard icon={History} label="Total predictions" value={historyAvailable ? String(history.length) : '—'} detail={historyAvailable ? 'All-time predictions' : 'History unavailable'} tone="citron" />
        <MetricCard icon={Wheat} label="Most recommended crop" value={historyAvailable ? mostRecommended?.[0] ?? '—' : '—'} detail={historyAvailable ? mostRecommended ? `${mostRecommended[1]} saved recommendations` : 'Awaiting your first prediction' : 'History unavailable'} tone="mint" />
        <MetricCard icon={Activity} label="Recent activity" value={historyAvailable ? String(recentCount) : '—'} detail="Predictions in the last 7 days" tone="sage" />
        <MetricCard icon={CheckCircle2} label="Model status" value={modelOnline ? 'Online' : 'Offline'} detail={modelOnline ? modelInfo?.model_name ?? 'Model loaded' : 'Model unavailable'} tone={modelOnline ? 'citron' : 'sienna'} />
      </section>

      <section className="dashboard-main-grid">
        <motion.article className="surface-card chart-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">Your recommendations</span>
              <h3>Your Crop Landscape</h3>
              <p>Distribution of crops recommended by AgriClass AI.</p>
            </div>
            {historyAvailable && chartData.length > 0 && <span className="chart-total">{history.length} total</span>}
          </div>
          {!historyAvailable ? (
            <EmptyState title="Prediction data unavailable" description="Reconnect to the backend to load your saved recommendations." />
          ) : chartData.length ? (
            <Suspense fallback={<div className="chart-loading" aria-label="Loading crop chart" />}>
              <CropLandscape data={chartData} />
            </Suspense>
          ) : (
            <EmptyState title="Your landscape starts here" description="Your saved crop recommendations will appear here after your first prediction." />
          )}
          <div className="chart-footer"><span><span className="legend-dot" /> Saved crop recommendations</span><NavLink to="/history" className="text-action">View History <ArrowRight size={14} /></NavLink></div>
        </motion.article>

        <motion.article className="surface-card model-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.14 }}>
          <div className="model-card-top"><div className="model-icon"><Sprout size={19} /></div><span className={`model-state ${modelOnline ? 'online' : 'offline'}`}><i /> {modelOnline ? 'ONLINE' : 'OFFLINE'}</span></div>
          <span className="section-kicker">Intelligence engine</span>
          <h3>{modelOnline ? modelInfo?.model_name : 'Model unavailable'}</h3>
          <p>{modelOnline ? 'The trained crop recommendation model is loaded and ready to evaluate field conditions.' : 'The backend has not confirmed that a prediction model is available.'}</p>
          <div className="model-divider" />
          <div className="model-detail"><span>Backend</span><strong>{backendOnline ? 'Connected' : 'Not connected'}</strong></div>
          <div className="model-detail"><span>Inference</span><strong>{modelOnline ? 'Ready' : 'Unavailable'}</strong></div>
        </motion.article>
      </section>

      <section className="surface-card recent-card">
        <div className="section-heading recent-heading">
          <div>
            <span className="section-kicker">Field activity</span>
            <h3>Recent Predictions</h3>
            <p>Your five most recent saved recommendations.</p>
          </div>
          <NavLink to="/history" className="text-action history-link">View All History <ArrowRight size={15} /></NavLink>
        </div>
        {historyAvailable && recentPredictions.length > 0 ? (
          <div className="table-wrap recent-table-wrap">
            <table className="recent-table">
              <thead><tr><th>Crop</th><th>Date &amp; time</th><th>Nitrogen (N)</th><th>Phosphorus (P)</th><th>Potassium (K)</th><th>Action</th></tr></thead>
              <tbody>
                {recentPredictions.map((item) => {
                  const inputs = item.input_payload ?? {};
                  const formattedDate = Number.isFinite(Date.parse(item.created_at)) ? new Date(item.created_at).toLocaleString() : 'Date unavailable';
                  return (
                    <tr key={item.id}>
                      <td><span className="crop-badge"><Leaf size={13} />{item.prediction}</span></td>
                      <td className="date-cell">{formattedDate}</td>
                      <td>{inputs.N ?? '—'}</td>
                      <td>{inputs.P ?? '—'}</td>
                      <td>{inputs.K ?? '—'}</td>
                      <td><NavLink to="/history" className="row-action" aria-label={`View ${item.prediction} prediction in history`}><ArrowUpRight size={16} /></NavLink></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="prediction-empty">
            <div className="empty-illustration"><Sprout size={27} /></div>
            <div><strong>{historyAvailable ? 'No predictions yet.' : 'Prediction history unavailable.'}</strong><p>{historyAvailable ? 'Start by entering your soil and weather conditions.' : 'Reconnect to the backend to review saved predictions.'}</p></div>
            {historyAvailable && <NavLink to="/predict" className="primary-button empty-cta">Make Your First Prediction <ArrowRight size={15} /></NavLink>}
          </div>
        )}
      </section>

      <section className="quick-actions">
        <div className="quick-actions-heading"><span className="section-kicker">Continue exploring</span><h3>Tools for the field</h3></div>
        <div className="quick-action-grid">
          <QuickAction icon={Wheat} title="Recommend a Crop" description="Enter soil and weather conditions for a tailored recommendation." to="/predict" action="Start prediction" />
          <QuickAction icon={FlaskConical} title="Explore Soil Analytics" description="Review environmental ranges and crop patterns in the dataset." to="/analytics" action="Open analytics" />
          <QuickAction icon={CalendarClock} title="Review Prediction History" description="Revisit crop recommendations saved from previous sessions." to="/history" action="View history" />
        </div>
      </section>
    </div>
  );
}

function PredictPage({ modelInfo, onPredictionSaved }: { modelInfo: ModelInfo | null; onPredictionSaved: () => void }) {
  const [values, setValues] = useState<PredictionFormValues>({ ...emptyValues });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FeatureKey, boolean>>>({});
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => () => requestController.current?.abort(), []);

  const getFieldError = (key: FeatureKey, value: string) => {
    if (!value.trim()) return 'This field is required.';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'Enter a valid finite number.';
    const bounds = modelInfo?.feature_bounds[key];
    if (bounds && (numeric < bounds.min || numeric > bounds.max)) {
      return `Enter a value from ${bounds.min} to ${bounds.max}.`;
    }
    return '';
  };

  const formIsValid = inputSchema.every(({ key }) => !getFieldError(key, values[key]));
  const setValue = (key: FeatureKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
    setResult(null);
  };

  const loadSample = () => {
    setValues(Object.fromEntries(inputSchema.map(({ key, sample }) => [key, String(sample)])) as PredictionFormValues);
    setTouched({});
    setError('');
    setResult(null);
  };

  const resetAll = () => {
    requestController.current?.abort();
    requestController.current = null;
    setValues({ ...emptyValues });
    setTouched({});
    setError('');
    setResult(null);
    setLoading(false);
  };

  const submitPrediction = async () => {
    setError('');
    setTouched(Object.fromEntries(inputSchema.map(({ key }) => [key, true])));
    if (!formIsValid) {
      setError('Complete all seven fields using values within the displayed dataset ranges.');
      return;
    }

    const payload = Object.fromEntries(inputSchema.map(({ key }) => [key, Number(values[key])])) as Record<FeatureKey, number>;
    const controller = new AbortController();
    requestController.current?.abort();
    requestController.current = controller;
    setLoading(true);
    try {
      const response = await predictCrop(payload, controller.signal);
      if (controller.signal.aborted) return;
      if (!response
        || typeof response.recommended_crop !== 'string'
        || !response.recommended_crop.trim()
        || !Number.isInteger(response.id)
        || typeof response.created_at !== 'string'
        || !Number.isFinite(Date.parse(response.created_at))) {
        throw new Error('The prediction service returned an invalid result. Please try again.');
      }
      if (modelInfo?.supports_probability && (!Number.isFinite(response.confidence) || !Array.isArray(response.top_five))) {
        throw new Error('The prediction service returned an invalid probability response. Please try again.');
      }
      setResult({ data: response, submittedValues: payload });
      onPredictionSaved();
    } catch (err) {
      if (axios.isCancel(err)) return;
      const message = axios.isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error ?? (err.code === 'ECONNABORTED' ? 'The prediction request timed out. Please try again.' : 'Unable to connect to the prediction service.')
        : err instanceof Error
          ? err.message
          : 'Unable to generate prediction.';
      setError(message);
    } finally {
      if (!controller.signal.aborted) {
        requestController.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <motion.div className="recommendation-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
      <header className="recommendation-heading">
        <div className="recommendation-title-copy">
          <p className="recommendation-eyebrow"><span /> AI-powered crop intelligence</p>
          <h2>Find the Right Crop.</h2>
          <p>Explore crop recommendations based on your soil nutrients and environmental conditions.</p>
        </div>
        <div className="recommendation-heading-mark" aria-hidden="true"><Sprout size={38} strokeWidth={1.2} /><span>FIELD INPUT<br />→ MODEL INSIGHT</span></div>
      </header>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.section key="prediction-result" className="recommendation-result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
            <div className="result-topline"><span className="recommendation-eyebrow"><span /> Model inference complete · Saved as #{result.data.id}</span><span className="result-timestamp">{new Date(result.data.created_at).toLocaleString()}</span></div>
            <div className="result-main">
              <div className="result-crop-icon"><Wheat size={32} strokeWidth={1.4} /></div>
              <div className="result-crop-copy"><span className="result-kicker">Your Recommended Crop</span><h3>{result.data.recommended_crop}</h3><p>Generated by the saved {modelInfo?.model_name ?? 'trained'} model.</p></div>
              {modelInfo?.supports_probability && Number.isFinite(result.data.confidence) && <div className="result-confidence"><span>Model-estimated confidence</span><strong>{(result.data.confidence * 100).toFixed(1)}%</strong><small>Not a real-world success probability.</small></div>}
            </div>

            {modelInfo?.supports_probability && result.data.top_five.length > 0 && (
              <div className="result-scores">
                <div className="result-section-title"><div><span className="section-kicker">Model output</span><h4>Other likely classes</h4></div><span>Model-estimated probabilities</span></div>
                {result.data.top_five.slice().sort((a, b) => b.confidence - a.confidence).map((item) => (
                  <div className="score-row" key={item.crop}>
                    <span>{item.crop}</span><div className="score-track"><motion.div className="score-fill" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, item.confidence)) * 100}%` }} transition={{ duration: 0.65, ease: 'easeOut' }} /></div><strong>{(item.confidence * 100).toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="result-inputs">
              <div className="result-section-title"><div><span className="section-kicker">Submitted values</span><h4>Your soil &amp; climate profile</h4></div><span>Exact inputs sent for inference</span></div>
              <div className="result-input-grid">
                {inputSchema.map(({ key, label, unit }) => <div className="result-input-cell" key={key}><span>{label}</span><strong>{result.submittedValues[key]} <small>{unit}</small></strong></div>)}
              </div>
            </div>

            {modelInfo && <div className="verified-accuracy"><CheckCircle2 size={15} /><span>Model test accuracy</span><strong>{(modelInfo.test_accuracy * 100).toFixed(2)}%</strong><small>Verified held-out test evaluation; separate from this prediction's confidence.</small></div>}
            <p className="prediction-disclaimer">This model provides data-driven guidance based on its training data. Its estimated probabilities may not be calibrated to real-world outcomes and do not guarantee crop suitability or yield.</p>
            <div className="result-actions"><button className="primary-button" type="button" onClick={resetAll}><Plus size={16} /> New Prediction <ArrowRight size={15} /></button><NavLink className="result-history-link" to="/history">View Prediction History <ArrowUpRight size={15} /></NavLink></div>
          </motion.section>
        ) : (
          <motion.div key="prediction-form" className="recommendation-form-layout" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <section className="recommendation-form-card">
              <div className="recommendation-form-intro"><div><span className="section-kicker">Field conditions</span><h3>Enter your measurements</h3><p>All seven values are required. Inputs outside the observed training-data range are rejected.</p></div><div className="required-mark"><span>*</span> Required fields</div></div>
              <div className="form-grid recommendation-form-grid">
                <motion.div className="form-section recommendation-section" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                  <div className="form-section-heading"><span className="form-section-icon"><Sprout size={17} /></span><div><h3>Soil Nutrients</h3><p>Measured nutrient content</p></div></div>
                  {inputSchema.slice(0, 3).map(({ key, label, unit, description, placeholder, icon: Icon }) => (
                    <div key={key} className="field-group recommendation-field">
                      <label htmlFor={`field-${key}`}>{label}<span>*</span></label>
                      <div className={`recommendation-input-row ${touched[key] && getFieldError(key, values[key]) ? 'has-error' : ''}`}>
                        <Icon className="field-icon" size={16} aria-hidden="true" />
                        <input id={`field-${key}`} type="number" inputMode="decimal" step="any" min={modelInfo?.feature_bounds[key]?.min} max={modelInfo?.feature_bounds[key]?.max} placeholder={placeholder} value={values[key]} disabled={loading} aria-invalid={Boolean(touched[key] && getFieldError(key, values[key]))} aria-describedby={`help-${key}${touched[key] && getFieldError(key, values[key]) ? ` error-${key}` : ''}`} onChange={(event) => setValue(key, event.target.value)} onBlur={() => setTouched((current) => ({ ...current, [key]: true }))} />
                        <span className="input-unit">{unit}</span>
                      </div>
                      <small id={`help-${key}`} className="field-description">{description}{modelInfo?.feature_bounds[key] && <span className="field-range" title={`Exact observed range: ${modelInfo.feature_bounds[key].min} to ${modelInfo.feature_bounds[key].max}`}>Range {formatRangeBound(modelInfo.feature_bounds[key].min, 'min')}–{formatRangeBound(modelInfo.feature_bounds[key].max, 'max')}</span>}</small>
                      {touched[key] && getFieldError(key, values[key]) && <motion.small id={`error-${key}`} className="field-validation" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}>{getFieldError(key, values[key])}</motion.small>}
                    </div>
                  ))}
                </motion.div>

                <motion.div className="form-section recommendation-section" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <div className="form-section-heading"><span className="form-section-icon"><CloudRain size={17} /></span><div><h3>Environmental Conditions</h3><p>Local climate measurements</p></div></div>
                  {inputSchema.slice(3).map(({ key, label, unit, description, placeholder, icon: Icon }) => (
                    <div key={key} className="field-group recommendation-field">
                      <label htmlFor={`field-${key}`}>{label}<span>*</span></label>
                      <div className={`recommendation-input-row ${touched[key] && getFieldError(key, values[key]) ? 'has-error' : ''}`}>
                        <Icon className="field-icon" size={16} aria-hidden="true" />
                        <input id={`field-${key}`} type="number" inputMode="decimal" step="any" min={modelInfo?.feature_bounds[key]?.min} max={modelInfo?.feature_bounds[key]?.max} placeholder={placeholder} value={values[key]} disabled={loading} aria-invalid={Boolean(touched[key] && getFieldError(key, values[key]))} aria-describedby={`help-${key}${touched[key] && getFieldError(key, values[key]) ? ` error-${key}` : ''}`} onChange={(event) => setValue(key, event.target.value)} onBlur={() => setTouched((current) => ({ ...current, [key]: true }))} />
                        <span className="input-unit">{unit}</span>
                      </div>
                      <small id={`help-${key}`} className="field-description">{description}{modelInfo?.feature_bounds[key] && <span className="field-range" title={`Exact observed range: ${modelInfo.feature_bounds[key].min} to ${modelInfo.feature_bounds[key].max}`}>Range {formatRangeBound(modelInfo.feature_bounds[key].min, 'min')}–{formatRangeBound(modelInfo.feature_bounds[key].max, 'max')}</span>}</small>
                      {touched[key] && getFieldError(key, values[key]) && <motion.small id={`error-${key}`} className="field-validation" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}>{getFieldError(key, values[key])}</motion.small>}
                    </div>
                  ))}
                </motion.div>
              </div>

              {error && <motion.div className="inline-error recommendation-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}
              {loading && <div className="prediction-loading" role="status"><span className="loading-spinner" /> Analyzing your soil and climate inputs…</div>}
              <div className="recommendation-actions">
                <button className="text-action sample-action" type="button" onClick={loadSample} disabled={loading} title="Load illustrative values only when explicitly selected">Load Sample Values</button>
                <div className="recommendation-action-right">
                  <button className="reset-action" type="button" onClick={resetAll}>Reset</button>
                  <button className="primary-button predict-action" type="button" onClick={submitPrediction} disabled={loading || !modelInfo || !formIsValid}><Sprout size={17} /> {loading ? 'Analyzing…' : 'Predict Crop'} <ArrowRight size={16} /></button>
                </div>
              </div>
              <p className="form-footnote"><span>*</span> Bounds are measured from the supplied training data. The CSV does not document measurement units; displayed units follow the dataset's common interpretation. Model output is guidance, not a guarantee.</p>
            </section>
            <aside className="model-context-card">
              <div className="context-icon"><FlaskConical size={19} /></div>
              <span className="section-kicker">Inside the model</span>
              <h3>{modelInfo?.model_name ?? 'Model information unavailable'}</h3>
              <p>{modelInfo ? 'Predictions use the saved trained model and its exact ordered input features below.' : 'Model metadata is unavailable. Prediction is disabled until the backend confirms the saved model.'}</p>
              <div className="schema-list recommendation-schema">{modelInfo?.feature_names.map((feature, index) => <div className="schema-chip" key={feature}><span>{index + 1}</span><strong>{feature}</strong></div>)}</div>
              {modelInfo?.supports_probability && <div className="probability-note"><CheckCircle2 size={15} /><p>Class probability estimates are available. They are model scores, not guaranteed chances of real-world success.</p></div>}
              {modelInfo && <div className="context-accuracy"><span>Held-out test accuracy</span><strong>{(modelInfo.test_accuracy * 100).toFixed(2)}%</strong><small>Verified evaluation metric; not the confidence of an individual prediction.</small></div>}
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HistoryPage({
  history,
  loading,
  historyAvailable,
  onRefresh,
}: {
  history: HistoryItem[];
  loading: boolean;
  historyAvailable: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HistoryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const orderedHistory = [...history].sort((a, b) => {
    const timestampDiff = Date.parse(b.created_at) - Date.parse(a.created_at);
    return Number.isFinite(timestampDiff) && timestampDiff !== 0 ? timestampDiff : b.id - a.id;
  });
  const cropCounts = history.reduce<Record<string, number>>((counts, item) => {
    counts[item.prediction] = (counts[item.prediction] ?? 0) + 1;
    return counts;
  }, {});
  const mostRecommended = Object.entries(cropCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const latest = orderedHistory[0];
  const availableCrops = Object.keys(cropCounts).sort((a, b) => a.localeCompare(b));
  const normalizedSearch = search.trim().toLowerCase();
  const visibleHistory = orderedHistory.filter((item) => {
    const matchesSearch = !normalizedSearch
      || String(item.id).includes(normalizedSearch)
      || item.prediction.toLowerCase().includes(normalizedSearch);
    return matchesSearch && (!cropFilter || item.prediction === cropFilter);
  });

  useEffect(() => {
    if (selectedId !== null && !history.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setSelectedRecord(null);
    }
  }, [history, selectedId]);

  useEffect(() => {
    if (selectedId === null) {
      setSelectedRecord(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setError('');
    void fetchHistoryItem(selectedId)
      .then((record) => {
        if (active) setSelectedRecord(record);
      })
      .catch((err) => {
        if (!active) return;
        setError(axios.isAxiosError<{ error?: string }>(err)
          ? err.response?.data?.error ?? 'Unable to load this prediction record.'
          : err instanceof Error ? err.message : 'Unable to load this prediction record.');
        setSelectedRecord(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const removeRecord = async (record: HistoryItem) => {
    const confirmed = window.confirm(`Delete prediction #${record.id} (${record.prediction})? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(record.id);
    setError('');
    setNotice('');
    try {
      await deleteHistoryItem(record.id);
      setSelectedId(null);
      setSelectedRecord(null);
      setNotice(`Prediction #${record.id} was deleted.`);
      onRefresh();
    } catch (err) {
      setError(axios.isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error ?? 'Unable to delete this prediction. Please try again.'
        : err instanceof Error ? err.message : 'Unable to delete this prediction.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="dashboard-loading"><div /><div /><div /></div>;

  if (!historyAvailable) {
    return (
      <section className="history-page">
        <HistoryHeading count={null} />
        <div className="history-empty-state">
          <div className="history-empty-icon"><History size={24} /></div>
          <h2>History is temporarily unavailable.</h2>
          <p>Could not retrieve saved predictions from the backend. Verify the API is running, then retry.</p>
          <button className="primary-button" type="button" onClick={onRefresh}>Retry connection <ArrowRight size={15} /></button>
        </div>
      </section>
    );
  }

  return (
    <motion.div className="history-page" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
      <HistoryHeading count={history.length} />

      {error && <div className="history-message history-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}
      {notice && <div className="history-message history-success" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}

      <div className="history-summary-grid">
        <HistorySummary icon={History} label="Total predictions" value={String(history.length)} detail="Successfully saved records" />
        <HistorySummary icon={Wheat} label="Latest recommendation" value={latest?.prediction ?? '—'} detail={latest ? `Prediction #${latest.id}` : 'No saved predictions yet'} />
        <HistorySummary icon={Sprout} label="Most recommended crop" value={mostRecommended?.[0] ?? '—'} detail={mostRecommended ? `${mostRecommended[1]} saved recommendations` : 'No crop recorded'} />
        <HistorySummary icon={CalendarClock} label="Latest prediction" value={latest ? formatHistoryDate(latest.created_at, { dateStyle: 'medium' }) : '—'} detail={latest ? formatHistoryDate(latest.created_at, { timeStyle: 'short' }) : 'No timestamp available'} />
      </div>

      {history.length === 0 ? (
        <div className="history-empty-state">
          <div className="history-empty-icon"><Sprout size={24} /></div>
          <h2>No predictions yet.</h2>
          <p>Saved crop recommendations will appear here with their input values and model-estimated confidence.</p>
          <NavLink className="primary-button" to="/predict">Make Your First Prediction <ArrowRight size={15} /></NavLink>
        </div>
      ) : (
        <section className="history-table-card">
          <div className="history-table-heading">
            <div><span className="section-kicker">Persisted in prediction history</span><h3>Saved Predictions</h3><p>Records are shown newest first. Select a row to inspect its complete inputs.</p></div>
            <span className="history-count-pill">{visibleHistory.length} of {history.length}</span>
          </div>
          <div className="history-controls">
            <label className="history-search"><Search size={16} /><input type="search" placeholder="Search crop or prediction ID" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search by crop or prediction ID" /></label>
            <label className="history-filter">Crop
              <select value={cropFilter} onChange={(event) => setCropFilter(event.target.value)} aria-label="Filter by crop">
                <option value="">All crops</option>
                {availableCrops.map((crop) => <option value={crop} key={crop}>{crop}</option>)}
              </select>
            </label>
            <button type="button" className="history-clear-filters" onClick={() => { setSearch(''); setCropFilter(''); }} disabled={!search && !cropFilter}>Clear filters</button>
          </div>
          {visibleHistory.length ? (
            <div className="table-wrap history-table-wrap">
              <table className="history-table">
                <thead><tr><th>Prediction ID</th><th>Recommended crop</th><th>Date &amp; time</th><th>N</th><th>P</th><th>K</th><th>Confidence</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="history-id">#{item.id}</td>
                      <td><span className="crop-badge"><Leaf size={13} />{item.prediction}</span></td>
                      <td className="date-cell">{formatHistoryDate(item.created_at)}</td>
                      <td>{formatHistoryInput(item, 'N')}</td><td>{formatHistoryInput(item, 'P')}</td><td>{formatHistoryInput(item, 'K')}</td>
                      <td>{Number.isFinite(item.probability) ? `${(item.probability * 100).toFixed(1)}%` : '—'}</td>
                      <td><div className="history-row-actions"><button type="button" className="row-action" aria-label={`View details for prediction ${item.id}`} title="View details" onClick={() => setSelectedId(item.id)}><Eye size={15} /></button><button type="button" className="row-action delete-row-action" aria-label={`Delete prediction ${item.id}`} title="Delete record" disabled={deletingId === item.id} onClick={() => void removeRecord(item)}><Trash2 size={15} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="history-filter-empty"><Search size={18} /><strong>No matching predictions.</strong><span>Try another crop name or prediction ID.</span></div>
          )}
          <p className="history-confidence-note">Confidence is the saved model-estimated class probability, not an agricultural success guarantee. Units follow the prediction form; the source dataset does not document measurement units.</p>
        </section>
      )}

      <AnimatePresence>
        {selectedId !== null && (
          <motion.div className="history-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
            <motion.section className="history-detail-panel" role="dialog" aria-modal="true" aria-labelledby="history-detail-title" initial={{ opacity: 0, y: 12, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .2 }}>
              <div className="history-detail-heading"><div><span className="section-kicker">Saved model result</span><h2 id="history-detail-title">Prediction details</h2></div><button className="history-close-button" type="button" aria-label="Close prediction details" onClick={() => setSelectedId(null)}><X size={18} /></button></div>
              {detailLoading ? <div className="history-detail-loading"><span className="loading-spinner" /> Loading saved prediction…</div> : selectedRecord ? (
                <>
                  <div className="history-detail-crop"><span className="result-crop-icon"><Wheat size={25} /></span><div><span>Recommended crop</span><strong>{selectedRecord.prediction}</strong></div><span className="history-detail-id">#{selectedRecord.id}</span></div>
                  <div className="history-detail-meta"><span>Prediction date</span><strong>{formatHistoryDate(selectedRecord.created_at)}</strong><span>Model</span><strong>{selectedRecord.model_name || 'Unavailable'}</strong></div>
                  <div className="history-detail-values"><h3>Saved input values</h3><div className="result-input-grid">{inputSchema.map(({ key, label, unit }) => <div className="result-input-cell" key={key}><span>{label}</span><strong>{formatHistoryInput(selectedRecord, key)} <small>{unit}</small></strong></div>)}</div></div>
                  {Number.isFinite(selectedRecord.probability) && <div className="history-detail-confidence"><span>Model-estimated confidence</span><strong>{(selectedRecord.probability * 100).toFixed(1)}%</strong><small>This probability is a model score, not a guarantee of real-world crop success.</small></div>}
                  <p className="history-detail-disclaimer">Recommendations are data-driven guidance and do not guarantee crop suitability or yield.</p>
                  <div className="history-detail-actions"><NavLink className="primary-button" to={`/analytics?recordId=${selectedRecord.id}`}><FlaskConical size={15} /> Analyze this record</NavLink><NavLink className="history-new-prediction" to="/predict">New Prediction <ArrowRight size={14} /></NavLink></div>
                </>
              ) : <div className="history-detail-loading">This record could not be loaded.</div>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HistoryHeading({ count }: { count: number | null }) {
  return (
    <header className="history-page-heading">
      <div><p className="recommendation-eyebrow"><span /> Prediction archive</p><h2>Prediction History</h2><p>Review saved crop recommendations and the field conditions behind each result.</p></div>
      <div className="history-heading-actions">{count !== null && <span className="history-count-pill">{count} {count === 1 ? 'record' : 'records'}</span>}<NavLink className="primary-button" to="/predict"><Plus size={15} /> New Prediction</NavLink></div>
    </header>
  );
}

function HistorySummary({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return <motion.article className="history-summary-card" whileHover={{ y: -2 }} transition={{ duration: .16 }}><div className="history-summary-top"><span>{label}</span><i><Icon size={16} /></i></div><strong>{value}</strong><small>{detail}</small></motion.article>;
}

function formatHistoryDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, options) : 'Date unavailable';
}

function formatHistoryInput(record: HistoryItem, key: FeatureKey) {
  const value = record.input_payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—';
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: 'citron' | 'mint' | 'sage' | 'sienna' }) {
  return (
    <motion.article className={`metric-card metric-${tone}`} whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
      <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </motion.article>
  );
}

function QuickAction({ icon: Icon, title, description, to, action }: { icon: LucideIcon; title: string; description: string; to: string; action: string }) {
  return (
    <NavLink to={to} className="quick-action-card">
      <span className="quick-action-icon"><Icon size={18} /></span>
      <span className="quick-action-copy"><strong>{title}</strong><small>{description}</small><span className="quick-action-link">{action} <ArrowRight size={14} /></span></span>
      <ArrowUpRight className="quick-action-arrow" size={17} />
    </NavLink>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <Leaf size={20} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export default App;
