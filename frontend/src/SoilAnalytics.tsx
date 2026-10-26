import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  CloudRain,
  Droplets,
  FlaskConical,
  Gauge,
  Leaf,
  Sprout,
  Thermometer,
  Wheat,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FeatureKey, HistoryItem, ModelInfo } from './types';

interface SoilAnalyticsProps {
  history: HistoryItem[];
  historyAvailable: boolean;
  loading: boolean;
  error: string;
  modelInfo: ModelInfo | null;
  onRetry: () => void;
}

type Measurement = {
  key: FeatureKey;
  label: string;
  unit: string;
  description: string;
  icon: typeof Leaf;
};

const nutrientMeasurements: Measurement[] = [
  { key: 'N', label: 'Nitrogen (N)', unit: 'kg/ha', description: 'Supports leafy growth and chlorophyll formation.', icon: Leaf },
  { key: 'P', label: 'Phosphorus (P)', unit: 'kg/ha', description: 'Contributes to root development and energy transfer.', icon: Sprout },
  { key: 'K', label: 'Potassium (K)', unit: 'kg/ha', description: 'Supports plant function and resilience to stress.', icon: Wheat },
];

const climateMeasurements: Measurement[] = [
  { key: 'temperature', label: 'Temperature', unit: '°C', description: 'Temperature conditions influence crop growth and development.', icon: Thermometer },
  { key: 'humidity', label: 'Humidity', unit: '%', description: 'Relative humidity describes moisture in the surrounding air.', icon: Droplets },
  { key: 'rainfall', label: 'Rainfall', unit: 'mm', description: 'Rainfall is one of the environmental factors used by the model.', icon: CloudRain },
];

const featureKeys: FeatureKey[] = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'];
const nutrientColors = ['#174C3C', '#618673', '#A2B9A4'];

function readMeasurement(record: HistoryItem | undefined, key: FeatureKey): number | null {
  if (!record?.input_payload) return null;
  const value = record.input_payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatMeasurement(value: number | null, unit: string) {
  if (value === null) return 'Unavailable';
  return `${value} ${unit}`;
}

function formatObservedBound(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Date unavailable';
}

function SoilAnalytics({ history, historyAvailable, loading, error, modelInfo, onRetry }: SoilAnalyticsProps) {
  const orderedHistory = useMemo(
    () => [...history].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)),
    [history],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRecordId = searchParams.get('recordId');
  const [selectedId, setSelectedId] = useState<string>(() => requestedRecordId ?? '');

  useEffect(() => {
    if (!orderedHistory.length) {
      setSelectedId('');
      return;
    }
    const selectedExists = orderedHistory.some((item) => String(item.id) === selectedId);
    if (!selectedExists) {
      const requestedExists = orderedHistory.some((item) => String(item.id) === requestedRecordId);
      setSelectedId(requestedExists && requestedRecordId ? requestedRecordId : String(orderedHistory[0].id));
      return;
    }
    if (selectedId !== requestedRecordId) {
      setSearchParams({ recordId: selectedId }, { replace: true });
    }
  }, [orderedHistory, selectedId, requestedRecordId, setSearchParams]);

  const selected = orderedHistory.find((item) => String(item.id) === selectedId);
  const measurements = featureKeys.map((key) => ({ key, value: readMeasurement(selected, key) }));
  const missingFields = measurements.filter(({ value }) => value === null).map(({ key }) => key);
  const nutrientChartData = nutrientMeasurements.flatMap((measurement) => {
    const value = readMeasurement(selected, measurement.key);
    return value === null ? [] : [{ nutrient: measurement.label, value, unit: measurement.unit }];
  });
  const pH = readMeasurement(selected, 'ph');
  const pHCategory = pH === null ? null : pH < 7 ? 'Acidic' : pH > 7 ? 'Alkaline' : 'Neutral';

  if (loading) {
    return <div className="dashboard-loading analytics-loading"><div /><div /><div /></div>;
  }

  if (!historyAvailable) {
    return (
      <motion.section className="analytics-empty-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="analytics-empty-icon"><FlaskConical size={22} /></div>
        <span className="section-kicker">Soil &amp; weather analytics</span>
        <h2>Your field data is temporarily unavailable.</h2>
        <p>{error || 'Could not load saved prediction history. Check the backend connection and try again.'}</p>
        <div className="analytics-empty-actions"><button className="primary-button" type="button" onClick={onRetry}>Retry history <ArrowRight size={15} /></button><NavLink className="analytics-secondary-action" to="/predict">Open Crop Recommendation</NavLink></div>
      </motion.section>
    );
  }

  if (orderedHistory.length === 0) {
    return (
      <motion.section className="analytics-empty-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="analytics-empty-icon"><Sprout size={24} /></div>
        <span className="section-kicker">Soil &amp; weather analytics</span>
        <h2>Start with a field reading.</h2>
        <p>Analytics are built from actual inputs saved with your crop predictions. Create a prediction to see your soil and climate measurements here.</p>
        <NavLink className="primary-button analytics-primary-action" to="/predict">Open Crop Recommendation <ArrowRight size={15} /></NavLink>
      </motion.section>
    );
  }

  return (
    <motion.div className="soil-analytics-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <header className="soil-analytics-heading">
        <div>
          <p className="recommendation-eyebrow"><span /> Field measurements</p>
          <h2>Soil &amp; Weather Analytics</h2>
          <p>Explore the soil and environmental inputs from your saved crop recommendations.</p>
        </div>
      </header>

      <section className="analytics-record-bar">
        <div className="record-label"><span className="record-icon"><CalendarClock size={16} /></span><div><strong>Analyzing saved prediction</strong><small>{orderedHistory.length} saved {orderedHistory.length === 1 ? 'record' : 'records'} · data from prediction history</small></div></div>
        <label className="record-select-label" htmlFor="analytics-record">Select record
          <span className="record-select-wrap"><select id="analytics-record" value={selectedId} onChange={(event) => {
            setSelectedId(event.target.value);
            setSearchParams({ recordId: event.target.value });
          }} aria-label="Select a saved prediction to analyze">
            {orderedHistory.map((record) => <option key={record.id} value={String(record.id)}>{record.prediction} · {formatDate(record.created_at)}</option>)}
          </select><ChevronDown size={15} /></span>
        </label>
      </section>

      {error && <div className="analytics-inline-notice" role="status">{error} <button type="button" onClick={onRetry}>Retry</button></div>}
      {selected && missingFields.length > 0 && <div className="analytics-inline-notice missing-data-notice" role="status">Some measurements are missing or invalid in this saved record: {missingFields.join(', ')}. Unavailable values are left blank in the analysis.</div>}

      {selected && (
        <>
          <div className="analytics-source-line"><span className="source-status-dot" /><span>Record #{selected.id}</span><span className="source-divider">·</span><span>{formatDate(selected.created_at)}</span><span className="source-divider">·</span><span>Recommended crop: <strong>{selected.prediction}</strong></span></div>

          <section className="nutrient-section">
            <div className="analytics-section-heading"><div><span className="section-kicker">Measured soil inputs</span><h3>Soil Nutrients</h3><p>Values recorded with this prediction; the indicator shows position within the model's observed input span only.</p></div><span className="unit-note">Units follow the existing prediction form</span></div>
            <div className="nutrient-card-grid">
              {nutrientMeasurements.map((measurement, index) => {
                const value = readMeasurement(selected, measurement.key);
                const bounds = modelInfo?.feature_bounds[measurement.key];
                const position = value !== null && bounds && bounds.max > bounds.min
                  ? Math.max(0, Math.min(100, ((value - bounds.min) / (bounds.max - bounds.min)) * 100))
                  : null;
                const outsideRange = value !== null && bounds !== undefined && (value < bounds.min || value > bounds.max);
                const Icon = measurement.icon;
                return (
                  <motion.article className="analytics-data-card nutrient-data-card" key={measurement.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <div className="data-card-heading"><span className="data-card-icon"><Icon size={17} /></span><span className="data-card-label">{measurement.label}</span></div>
                    <strong className="data-card-value">{formatMeasurement(value, measurement.unit)}</strong>
                    <div className={`observed-range-track ${outsideRange ? 'out-of-range' : ''}`} aria-label={position === null ? 'Observed training data range unavailable' : `Position in observed training data range: ${position.toFixed(1)} percent`}>
                      {position !== null && <span className="observed-range-marker" style={{ left: `${position}%`, backgroundColor: nutrientColors[index] }} />}
                    </div>
                    <div className="range-caption">{bounds ? <><span>Observed span</span><span>{formatObservedBound(bounds.min)} – {formatObservedBound(bounds.max)}</span></> : <span>Training range unavailable</span>}</div>
                    {outsideRange && <small className="out-of-range-label">Outside observed model-input range</small>}
                    <p>{measurement.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="environment-section">
            <div className="analytics-section-heading"><div><span className="section-kicker">Recorded conditions</span><h3>Weather &amp; Environment</h3><p>Each measurement is presented on its own scale and in its own unit.</p></div></div>
            <div className="environment-grid">
              {climateMeasurements.map((measurement, index) => {
                const value = readMeasurement(selected, measurement.key);
                const bounds = modelInfo?.feature_bounds[measurement.key];
                const outsideRange = value !== null && bounds !== undefined && (value < bounds.min || value > bounds.max);
                const Icon = measurement.icon;
                return (
                  <motion.article className="analytics-data-card environment-card" key={measurement.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + index * 0.05 }}>
                    <div className="data-card-heading"><span className="data-card-icon climate-icon"><Icon size={17} /></span><span className="data-card-label">{measurement.label}</span></div>
                    <strong className="data-card-value">{formatMeasurement(value, measurement.unit)}</strong>
                    <p>{measurement.description}</p>
                    {bounds && <small className={`environment-range-note ${outsideRange ? 'out-of-range-label' : ''}`}>{outsideRange ? 'Outside' : 'Observed'} dataset span: {formatObservedBound(bounds.min)}–{formatObservedBound(bounds.max)} {measurement.unit}</small>}
                    {value !== null && <MeasurementChart label={measurement.label} value={value} unit={measurement.unit} color={['#628D73', '#83A4A0', '#A2B990'][index]} />}
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="analytics-charts-grid">
            <motion.article className="analytics-chart-card nutrient-chart-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <div className="analytics-section-heading"><div><span className="section-kicker">Recorded soil inputs</span><h3>Soil Nutrient Comparison</h3><p>Raw model input values from the selected prediction.</p></div></div>
              {nutrientChartData.length ? (
                <>
                  <div className="nutrient-bar-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={nutrientChartData} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#E9EFE8" />
                        <XAxis dataKey="nutrient" axisLine={false} tickLine={false} tick={{ fill: '#748579', fontSize: 11 }} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#91A095', fontSize: 10 }} />
                        <Tooltip cursor={{ fill: '#F3F7F1' }} contentStyle={{ border: '1px solid #DDE7DE', borderRadius: 9, fontSize: 12 }} formatter={(value, _name, item) => [`${value} ${item.payload.unit}`, 'Recorded value']} />
                        <Bar dataKey="value" name="Recorded value" radius={[5, 5, 0, 0]} animationDuration={650}>{nutrientChartData.map((item, index) => <Cell key={item.nutrient} fill={nutrientColors[index]} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="chart-caveat"><FlaskConical size={14} /> Nutrient values share a display only; comparing bar heights does not indicate agronomic sufficiency because each nutrient has a different role.</p>
                </>
              ) : <ChartEmptyState />}
            </motion.article>

            <motion.article className="ph-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.06 }}>
              <div className="ph-card-heading"><span className="data-card-icon ph-icon"><Gauge size={17} /></span><div><span className="section-kicker">Acidity &amp; alkalinity</span><h3>Soil pH</h3></div></div>
              {pH !== null && pH >= 0 && pH <= 14 ? (
                <>
                  <div className="ph-value-row"><strong>{pH}</strong><span>{pHCategory}</span></div>
                  <p className="ph-explanation">Soil pH influences nutrient availability. This measurement alone does not diagnose overall soil quality.</p>
                  <div className="ph-scale-wrap">
                    <div className="ph-scale" aria-label={`pH scale from zero to fourteen, measured value ${pH}`}>
                      <span className="ph-region acidic-region" /><span className="ph-region neutral-region" /><span className="ph-region alkaline-region" />
                      <span className="ph-marker" style={{ left: `${(pH / 14) * 100}%` }}><i /></span>
                    </div>
                    <div className="ph-scale-numbers"><span>0</span><span>7</span><span>14</span></div>
                    <div className="ph-scale-labels"><span>Acidic</span><span>Neutral</span><span>Alkaline</span></div>
                  </div>
                </>
              ) : (
                <div className="ph-empty"><Gauge size={21} /><strong>{pH === null ? 'pH not available' : 'pH outside scale'}</strong><span>{pH === null ? 'This saved prediction has no valid pH measurement.' : 'A pH scale can display values from 0 to 14.'}</span></div>
              )}
            </motion.article>
          </section>
          <p className="analytics-disclaimer"><Check size={14} /> Readings come from the selected saved prediction. Units follow the existing input form; the source CSV does not document measurement units. No live weather or estimated soil values are used.</p>
        </>
      )}
    </motion.div>
  );
}

function MeasurementChart({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const data = [{ label, value }];
  return (
    <div className="environment-chart" aria-label={`${label} recorded value ${value} ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 2, left: -28, bottom: -7 }}>
          <XAxis hide dataKey="label" />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip cursor={{ fill: '#F2F6F1' }} contentStyle={{ border: '1px solid #DDE7DE', borderRadius: 8, fontSize: 11 }} formatter={(amount) => [`${amount} ${unit}`, label]} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={52} animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmptyState() {
  return <div className="analytics-chart-empty"><FlaskConical size={19} /><span>No valid nutrient values in this prediction.</span></div>;
}

export default SoilAnalytics;
