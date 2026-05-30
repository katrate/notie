import { useState, useEffect, useMemo, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const CHART_TYPES = [
  { type: 'bar', label: 'Bar', icon: 'bar_chart' },
  { type: 'line', label: 'Line', icon: 'show_chart' },
  { type: 'pie', label: 'Pie', icon: 'pie_chart' },
  { type: 'area', label: 'Area', icon: 'area_chart' },
  { type: 'radar', label: 'Radar', icon: 'radar' },
] as const;

type ChartType = typeof CHART_TYPES[number]['type'];

function generateDefaultData(type: ChartType) {
  switch (type) {
    case 'bar':
      return [
        { name: 'Q1', series1: 500 },
        { name: 'Q2', series1: 450 },
        { name: 'Q3', series1: 550 },
        { name: 'Q4', series1: 700 },
      ];
    case 'line':
    case 'area':
      return [
        { name: 'Q1', series1: 500 },
        { name: 'Q2', series1: 450 },
        { name: 'Q3', series1: 550 },
        { name: 'Q4', series1: 700 },
      ];
    case 'pie':
      return [
        { name: 'Q1', value: 400 },
        { name: 'Q2', value: 300 },
        { name: 'Q3', value: 600 },
        { name: 'Q4', value: 800 },
      ];
    case 'radar':
      return [
        { subject: 'Speed', A: 120, B: 110, fullMark: 150 },
        { subject: 'Strength', A: 98, B: 130, fullMark: 150 },
        { subject: 'Agility', A: 86, B: 130, fullMark: 150 },
        { subject: 'Stamina', A: 99, B: 100, fullMark: 150 },
        { subject: 'Intelligence', A: 85, B: 90, fullMark: 150 },
      ];
  }
}

const COLORS = ['#98cbff', '#f9735e', '#4ade80', '#facc15', '#a78bfa', '#22d3ee', '#fb923c', '#e879f9'];

function getDefaultKeys(type: ChartType) {
  switch (type) {
    case 'bar': return { xKey: 'name', yKey: 'series1' };
    case 'line': return { xKey: 'name', yKey: 'series1' };
    case 'area': return { xKey: 'name', yKey: 'series1' };
    case 'pie': return { xKey: 'name', yKey: 'value' };
    case 'radar': return { xKey: 'subject', yKey: 'A' };
  }
}

export function ChartView() {
  const { pages, activePageId, updatePageContent, updatePage } = useProjectStore();
  const activePage = pages.find(p => p.id === activePageId);

  const chartType: ChartType | null = activePage?.metadata?.chartType || null;
  const chartConfig = activePage?.metadata?.chartConfig || {};

  const [data, setData] = useState<Record<string, any>[]>([]);
  const [showTypePicker, setShowTypePicker] = useState(!chartType);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showAddSeries, setShowAddSeries] = useState(false);
  const [seriesName, setSeriesName] = useState('');
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setData(activePage.content);
    } else if (chartType) {
      setData(generateDefaultData(chartType));
    } else {
      setData([]);
    }
  }, [activePage?.content, activePageId, chartType]);

  const saveContent = useCallback((newData: Record<string, any>[]) => {
    setData(newData);
    if (activePageId) updatePageContent(activePageId, newData);
  }, [activePageId, updatePageContent]);

  const setChartType = useCallback(async (type: ChartType) => {
    const def = generateDefaultData(type);
    const defaults = getDefaultKeys(type);
    setData(def);
    setShowTypePicker(false);
    if (activePageId) {
      await updatePage(activePageId, {
        metadata: {
          ...(activePage?.metadata || {}),
          chartType: type,
          chartConfig: { ...chartConfig, xKey: defaults.xKey, yKey: defaults.yKey },
        },
      });
      await updatePageContent(activePageId, def);
    }
  }, [activePageId, activePage?.metadata, chartConfig, updatePage, updatePageContent]);

  const defaults = getDefaultKeys(chartType || 'bar');
  const xKey = chartConfig.xKey || defaults.xKey;
  const yKey = chartConfig.yKey || defaults.yKey;
  const ySeries: string[] = chartConfig.ySeries || (chartConfig.yKey ? [chartConfig.yKey] : [defaults.yKey]);
  const showLegend = chartConfig.showLegend !== false;
  const showGrid = chartConfig.showGrid !== false;
  const showTooltip = chartConfig.showTooltip !== false;
  const chartTitle = chartConfig.title || '';

  const columnLabels: Record<string, string> = chartConfig.columnLabels || {};
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');


  const keys = useMemo(() => {
    if (data.length === 0) return { numericKeys: [], allKeys: [] };
    const all = Object.keys(data[0]);
    const numeric = all.filter(k => k !== 'name' && k !== 'subject' && k !== 'fullMark');
    return { numericKeys: numeric, allKeys: all };
  }, [data]);

  const updateCell = useCallback((index: number, key: string, val: string) => {
    const newData = data.map((row, i) => {
      if (i !== index) return row;
      const isNumeric = keys.numericKeys.includes(key);
      return { ...row, [key]: isNumeric ? (Number(val) || 0) : val };
    });
    saveContent(newData);
  }, [data, keys.numericKeys, saveContent]);

  const deleteRow = useCallback((index: number) => {
    saveContent(data.filter((_, i) => i !== index));
  }, [data, saveContent]);

  const openAddRow = useCallback(() => {
    const init: Record<string, string> = {};
    for (const k of keys.allKeys) {
      init[k] = keys.numericKeys.includes(k) ? '0' : '';
    }
    setNewRowData(init);
    setShowAddRow(true);
  }, [keys]);

  const confirmAddRow = useCallback(() => {
    const row: Record<string, any> = {};
    for (const k of keys.allKeys) {
      row[k] = keys.numericKeys.includes(k) ? (Number(newRowData[k]) || 0) : (newRowData[k] || '');
    }
    if (!row[xKey]) return;
    saveContent([...data, row]);
    setShowAddRow(false);
    setNewRowData({});
  }, [data, keys, newRowData, xKey, saveContent]);

  const confirmAddSeries = useCallback(() => {
    const key = seriesName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || data.length === 0) return;
    const newData = data.map(row => ({ ...row, [key]: 0 }));
    const nextYSeries = ySeries.includes(key) ? ySeries : [...ySeries, key];
    saveContent(newData);
    if (activePageId) {
      const newConfig = { ...chartConfig, ySeries: nextYSeries, columnLabels: { ...columnLabels, [key]: seriesName.trim() } };
      updatePage(activePageId, { metadata: { ...(activePage?.metadata || {}), chartConfig: newConfig } });
    }
    setShowAddSeries(false);
    setSeriesName('');
  }, [seriesName, data, ySeries, activePageId, chartConfig, columnLabels, saveContent, updatePage]);

  const deleteSeries = useCallback((key: string) => {
    const newData = data.map(row => {
      const { [key]: _, ...rest } = row;
      return rest;
    });
    const nextYSeries = ySeries.filter(k => k !== key);
    const nextLabels = { ...columnLabels };
    delete nextLabels[key];
    saveContent(newData);
    if (activePageId) {
      const newConfig = { ...chartConfig, ySeries: nextYSeries.length > 0 ? nextYSeries : [Object.keys(newData[0] || {}).find(k => k !== xKey) || ''].filter(Boolean), columnLabels: nextLabels };
      updatePage(activePageId, { metadata: { ...(activePage?.metadata || {}), chartConfig: newConfig } });
    }
  }, [data, ySeries, columnLabels, xKey, activePageId, chartConfig, saveContent, updatePage]);

  const renderChart = () => {
    if (!chartType) return null;

    switch (chartType) {
      case 'bar': {
        if (!yKey) return null;
        return (
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
            <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, fontSize: 13 }} />}
            {showLegend && <Legend />}
            <Bar dataKey={yKey} name={columnLabels[yKey] || yKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      }

      case 'line': {
        if (ySeries.length === 0) return null;
        return (
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
            <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, fontSize: 13 }} />}
            {showLegend && <Legend />}
            {ySeries.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} name={columnLabels[k] || k} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            ))}
          </LineChart>
        );
      }

      case 'area': {
        if (ySeries.length === 0) return null;
        return (
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />}
            <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, fontSize: 13 }} />}
            {showLegend && <Legend />}
            {ySeries.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} name={columnLabels[k] || k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} strokeWidth={2} />
            ))}
          </AreaChart>
        );
      }

      case 'pie':
        return (
          <PieChart margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, fontSize: 13 }} />}
            {showLegend && <Legend />}
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="70%" innerRadius={20} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        );

      case 'radar':
        return (
          <RadarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey={xKey} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis stroke="rgba(255,255,255,0.15)" tick={{ fontSize: 10 }} />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: 8, fontSize: 13 }} />}
            {showLegend && <Legend />}
            {keys.numericKeys.filter(k => k !== 'fullMark').slice(0, 2).map((k, i) => (
              <Radar key={k} name={columnLabels[k] || k} dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />
            ))}
          </RadarChart>
        );

      default:
        return null;
    }
  };

  if (!activePage) return null;

  if (showTypePicker) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface/30 rounded-xl border border-outline/10 p-6">
        <div className="max-w-2xl w-full">
          <h2 className="text-xl font-bold text-on-surface text-center mb-2">Choose Chart Type</h2>
          <p className="text-sm text-on-surface-variant text-center mb-8">Select the type of chart you want to create</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.type}
                onClick={() => setChartType(ct.type)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-surface/60 border border-outline/10 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
              >
                <span className="material-symbols-outlined text-4xl text-on-surface-variant group-hover:text-primary transition-colors">{ct.icon}</span>
                <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{ct.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-5 bg-surface/30 rounded-xl border border-outline/10 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <h2 className="text-lg font-bold text-on-surface">{chartTitle || (chartType ? `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart` : 'Chart')}</h2>
      </div>

      {/* Chart */}
      <div className="flex-shrink-0 bg-surface/50 rounded-xl border border-outline/10 p-4">
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%" key={`chart-${chartType}-${data.length}`}>
            {renderChart() || (
              <div className="flex items-center justify-center h-full text-on-surface-variant text-sm">
                {chartType ? 'Add data to get started' : 'Select a chart type to begin'}
              </div>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add Row Modal */}
      {showAddRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddRow(false)}>
          <div className="bg-surface rounded-xl border border-outline/20 shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-on-surface mb-4">Add Data Point</h3>
            <div className="space-y-3">
              {keys.allKeys.map(k => (
                <div key={k}>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{k}</label>
                  <input
                    type={keys.numericKeys.includes(k) ? 'number' : 'text'}
                    value={newRowData[k] ?? ''}
                    onChange={e => setNewRowData(prev => ({ ...prev, [k]: e.target.value }))}
                    placeholder={keys.numericKeys.includes(k) ? '0' : k}
                    className="w-full bg-background border border-outline/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                    autoFocus={k === xKey}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowAddRow(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-on-surface/10 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={confirmAddRow} className="px-4 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-lg transition-colors">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowAddSeries(false); setSeriesName(''); }}>
          <div className="bg-surface rounded-xl border border-outline/20 shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-on-surface mb-4">Add Series</h3>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Series Name</label>
              <input
                type="text"
                value={seriesName}
                onChange={e => setSeriesName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmAddSeries(); }}
                placeholder="e.g. Revenue"
                className="w-full bg-background border border-outline/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => { setShowAddSeries(false); setSeriesName(''); }} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-on-surface/10 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={confirmAddSeries} className="px-4 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-lg transition-colors">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="flex-shrink-0 bg-surface/50 rounded-xl border border-outline/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Chart Data</h3>
          <div className="flex items-center gap-2">
            {(chartType === 'line' || chartType === 'area') && (
              <button onClick={() => setShowAddSeries(true)} className="text-xs text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 px-2.5 py-1 rounded transition-colors">
                + Add Series
              </button>
            )}
            <button onClick={openAddRow} className="text-xs text-primary hover:bg-primary/10 px-2.5 py-1 rounded transition-colors font-medium">
              + Add Row
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-on-surface border-collapse">
            <thead>
              <tr className="border-b border-outline/10 text-on-surface-variant">
                {keys.allKeys.map((k, ki) => (
                  <th key={k} className={`pb-2 pr-3 font-semibold uppercase tracking-wider whitespace-nowrap group ${ki === 0 ? 'sticky left-0 z-10 bg-surface' : ''}`}>
                    {renamingCol === k ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && activePageId) {
                            const next = { ...chartConfig, columnLabels: { ...columnLabels, [k]: renameValue } };
                            updatePage(activePageId, { metadata: { ...(activePage?.metadata || {}), chartConfig: next } });
                            setRenamingCol(null);
                          }
                          if (e.key === 'Escape') setRenamingCol(null);
                        }}
                        onBlur={() => setRenamingCol(null)}
                        autoFocus
                        className="w-24 bg-background border border-primary/50 rounded px-1.5 py-0.5 text-xs outline-none"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="cursor-pointer hover:text-on-surface transition-colors"
                          onClick={() => { setRenamingCol(k); setRenameValue(columnLabels[k] || k); }}
                          title="Click to rename"
                        >
                          {columnLabels[k] || k}
                        </span>
                        {ki > 0 && (
                          <button
                            onClick={() => deleteSeries(k)}
                            className="opacity-0 group-hover:opacity-100 hover:text-error transition-all text-[10px]"
                            title="Remove series"
                          >
                            <span className="material-symbols-outlined text-[12px]">close</span>
                          </button>
                        )}
                      </span>
                    )}
                  </th>
                ))}
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-outline/5 hover:bg-surface/50 transition-colors">
                  {keys.allKeys.map((k, ki) => (
                    <td key={k} className={`py-1.5 pr-3 ${ki === 0 ? 'sticky left-0 z-10 bg-surface' : ''}`}>
                      <input
                        type={keys.numericKeys.includes(k) ? 'number' : 'text'}
                        value={row[k] ?? ''}
                        onChange={e => updateCell(i, k, e.target.value)}
                        className="w-full min-w-[80px] bg-transparent border border-transparent hover:border-outline/20 focus:border-primary/50 rounded px-2 py-1 outline-none transition-colors"
                      />
                    </td>
                  ))}
                  <td className="py-1.5">
                    <button onClick={() => deleteRow(i)} className="text-on-surface-variant opacity-40 hover:opacity-100 hover:text-error p-1 rounded hover:bg-error/10 transition-all">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
