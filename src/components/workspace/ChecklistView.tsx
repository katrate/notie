import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Tooltip } from '../Tooltip';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_PRESETS = [
  { label: '9AM', hour: 9, min: 0 },
  { label: '1PM', hour: 13, min: 0 },
  { label: '6PM', hour: 18, min: 0 },
];

const PRIORITIES = [
  { level: 1, label: 'P1', color: 'bg-red-500 text-white border-red-500' },
  { level: 2, label: 'P2', color: 'bg-orange-500 text-white border-orange-500' },
  { level: 3, label: 'P3', color: 'bg-amber-500 text-white border-amber-500' },
  { level: 4, label: 'P4', color: 'bg-emerald-500 text-white border-emerald-500' },
  { level: 5, label: 'P5', color: 'bg-sky-500 text-white border-sky-500' },
];

function CalendarPicker({ value, onChange, onClose }: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  onClose: () => void;
}) {
  const currentDate = value ? new Date(value) : new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? new Date(value) : null);
  const [hour, setHour] = useState(currentDate.getHours());
  const [minute, setMinute] = useState(currentDate.getMinutes());
  const [showTime, setShowTime] = useState(!!value && !(currentDate.getHours() === 0 && currentDate.getMinutes() === 0));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const goToMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const handleDayClick = (day: number) => {
    const d = new Date(year, month, day);
    setSelectedDate(d);
  };

  const handleSet = () => {
    if (!selectedDate) { onChange(null); onClose(); return; }
    const d = new Date(selectedDate);
    if (showTime) {
      d.setHours(hour, minute, 0, 0);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    onChange(d.toISOString());
    onClose();
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setHour(now.getHours());
    setMinute(now.getMinutes());
    setShowTime(true);
  };

  const today = new Date();
  const isToday = (d: number) =>
    today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const sel = selectedDate?.getDate() === d && selectedDate?.getMonth() === month && selectedDate?.getFullYear() === year;
    cells.push(
      <button
        type="button"
        key={d}
        onClick={() => handleDayClick(d)}
        className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
          sel
            ? 'bg-primary text-on-primary shadow-md'
            : isToday(d)
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-on-surface hover:bg-surface/50'
        }`}
      >
        {d}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute top-full mt-1 right-0 z-50 bg-surface border border-outline/20 rounded-xl shadow-2xl w-[250px] backdrop-blur-xl max-h-[75vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-2">
        <Tooltip label="Previous month">
          <button type="button" onClick={() => goToMonth(-1)} className="p-0.5 rounded hover:bg-surface/50 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
        </Tooltip>
        <span className="font-semibold text-on-surface text-xs">{MONTHS[month]} {year}</span>
        <Tooltip label="Next month">
          <button type="button" onClick={() => goToMonth(1)} className="p-0.5 rounded hover:bg-surface/50 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </Tooltip>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map(d => (
          <div key={d} className="w-8 h-5 flex items-center justify-center text-[9px] font-semibold text-on-surface-variant uppercase tracking-wide">{d[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {cells}
      </div>
      {selectedDate && (
        <div className="border-t border-outline/10 pt-2 mb-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowTime(!showTime)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                showTime ? 'bg-primary/10 text-primary' : 'bg-surface/50 text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[11px] align-middle mr-0.5">schedule</span>
              {showTime ? 'With time' : 'All day'}
            </button>
            <button type="button" onClick={handleToday} className="ml-auto px-2 py-1 rounded-lg text-[10px] font-medium bg-surface/50 text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-all">
              Today
            </button>
          </div>
          {showTime && (
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex bg-surface/50 rounded-lg px-1.5 py-0.5 items-center gap-0.5">
                <Tooltip label="Increase hour">
                  <button type="button" onClick={() => setHour(h => Math.max(0, h - 1))} className="p-0 rounded hover:bg-surface text-on-surface-variant leading-none">
                    <span className="material-symbols-outlined text-[11px]">expand_less</span>
                  </button>
                </Tooltip>
                <span className="text-[11px] font-bold text-on-surface min-w-[14px] text-center">{String(hour).padStart(2, '0')}</span>
                <Tooltip label="Decrease hour">
                  <button type="button" onClick={() => setHour(h => Math.min(23, h + 1))} className="p-0 rounded hover:bg-surface text-on-surface-variant leading-none">
                    <span className="material-symbols-outlined text-[11px]">expand_more</span>
                  </button>
                </Tooltip>
              </div>
              <span className="text-on-surface-variant font-bold text-[11px]">:</span>
              <div className="flex bg-surface/50 rounded-lg px-1.5 py-0.5 items-center gap-0.5">
                <Tooltip label="Increase minute">
                  <button type="button" onClick={() => setMinute(m => Math.max(0, m - 5))} className="p-0 rounded hover:bg-surface text-on-surface-variant leading-none">
                    <span className="material-symbols-outlined text-[11px]">expand_less</span>
                  </button>
                </Tooltip>
                <span className="text-[11px] font-bold text-on-surface min-w-[14px] text-center">{String(minute).padStart(2, '0')}</span>
                <Tooltip label="Decrease minute">
                  <button type="button" onClick={() => setMinute(m => Math.min(55, m + 5))} className="p-0 rounded hover:bg-surface text-on-surface-variant leading-none">
                    <span className="material-symbols-outlined text-[11px]">expand_more</span>
                  </button>
                </Tooltip>
              </div>
              <div className="flex gap-0.5">
                {TIME_PRESETS.map(p => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => { setHour(p.hour); setMinute(p.min); }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                      hour === p.hour && minute === p.min ? 'bg-primary/10 text-primary' : 'bg-surface/50 text-on-surface-variant hover:bg-surface'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-outline/10 pt-2">
        <button type="button" onClick={handleClear} className="px-3 py-1 rounded-lg text-[10px] font-medium text-error hover:bg-error/10 transition-all">
          Clear
        </button>
        <button type="button" onClick={handleSet} className="px-4 py-1 rounded-lg text-[10px] font-medium bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm">
          Set
        </button>
      </div>
    </div>
  );
}

function formatDueDate(dueDateString: string | null | undefined) {
  if (!dueDateString) return '';
  const date = new Date(dueDateString);
  if (isNaN(date.getTime())) return '';
  const isJustDate = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
  if (isJustDate) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isOverdue(dueDateString: string | null | undefined): boolean {
  if (!dueDateString) return false;
  const date = new Date(dueDateString);
  return date.getTime() < Date.now();
}

export function ChecklistView() {
  const { pages, activePageId, updatePageContent, updatePage } = useProjectStore() as any;
  const activePage = pages.find((p: any) => p.id === activePageId);

  const showTasksInGraph = activePage?.metadata?.showTasksInGraph ?? false;
  const sortMode = activePage?.metadata?.sortMode || 'default';

  const [todos, setTodos] = useState<any[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [newPriority, setNewPriority] = useState(3);

  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setTodos(activePage.content);
    } else {
      setTodos([]);
    }
  }, [activePage?.content, activePageId]);

  const saveContent = (newTodos: any[]) => {
    setTodos(newTodos);
    if (activePageId) updatePageContent(activePageId, newTodos);
  };

  const toggleShowInGraph = async () => {
    if (activePageId) {
      await updatePage(activePageId, {
        metadata: { ...(activePage?.metadata || {}), showTasksInGraph: !showTasksInGraph }
      });
    }
  };

  const setSortMode = async (mode: string) => {
    if (activePageId) {
      await updatePage(activePageId, {
        metadata: { ...(activePage?.metadata || {}), sortMode: mode }
      });
    }
  };

  const addTodo = (e: any) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    saveContent([
      ...todos,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: newItemText.trim(),
        completed: false,
        dueDate: pickerDate,
        priority: newPriority
      }
    ]);
    setNewItemText('');
    setPickerDate(null);
    setNewPriority(3);
  };

  const toggleTodo = (id: string) => {
    saveContent(todos.map((t: any) => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    saveContent(todos.filter((t: any) => t.id !== id));
  };

  const updateDueDate = (id: string, dueDate: string | null) => {
    saveContent(todos.map((t: any) => t.id === id ? { ...t, dueDate } : t));
  };

  const sortedTodos = [...todos].sort((a: any, b: any) => {
    if (sortMode === 'priority') {
      const pa = a.priority || 3;
      const pb = b.priority || 3;
      if (pa !== pb) return pa - pb;
    }
    if (sortMode === 'dueDate' || sortMode === 'priority') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0; // 'default' — keep creation order
  });

  const dateLabel = pickerDate ? formatDueDate(pickerDate) : null;

  return (
    <div className="flex-1 flex flex-col bg-surface/30 rounded-xl border border-outline/10 p-4 md:p-6 mx-auto max-w-3xl w-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[22px] text-primary">check_box</span>
        <h2 className="text-lg font-bold text-on-surface">To-Do List</h2>
        <div className="ml-auto flex items-center gap-1.5">
          {['default', 'priority', 'dueDate'].map(mode => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2 py-1 rounded-lg border text-[9px] font-medium transition-all ${
                sortMode === mode
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface/50 border-outline/20 text-on-surface-variant hover:border-primary/30 hover:text-primary'
              }`}
            >
              {mode === 'default' ? 'Default' : mode === 'priority' ? 'Priority' : 'Due Date'}
            </button>
          ))}
        </div>
        <button
          onClick={toggleShowInGraph}
          className={`px-2.5 py-1 rounded-lg border text-[9px] font-medium transition-all flex items-center gap-1 ${
            showTasksInGraph
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-surface/50 border-outline/20 text-on-surface-variant hover:border-primary/30 hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[12px]">hub</span>
          <span className="hidden lg:inline">{showTasksInGraph ? 'Showing' : 'Show Tasks'}</span>
        </button>
        {todos.length > 0 && (
          <span className="text-[11px] text-on-surface-variant">{todos.filter(t => t.completed).length}/{todos.length}</span>
        )}
      </div>

      <form onSubmit={addTodo} className="mb-4 relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">add</span>
            </div>
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add a new task..."
              className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg py-2.5 pl-9 pr-3 text-sm text-on-surface outline-none transition-colors focus:bg-surface/80"
            />
          </div>
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPicker(showPicker === 'new' ? null : 'new')}
              className={`h-full px-3 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
                pickerDate
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface/50 border-outline/20 text-on-surface-variant hover:border-primary/30 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              <span className="hidden lg:inline">{dateLabel || 'Due'}</span>
            </button>
            {showPicker === 'new' && (
              <CalendarPicker
                value={pickerDate}
                onChange={(d) => setPickerDate(d)}
                onClose={() => setShowPicker(null)}
              />
            )}
          </div>
          <div className="flex items-center gap-0.5 bg-surface/50 rounded-lg border border-outline/20 px-1">
            {PRIORITIES.map(p => (
              <button
                key={p.level}
                type="button"
                onClick={() => setNewPriority(p.level)}
                className={`w-6 h-6 rounded text-[9px] font-bold transition-all ${
                  newPriority === p.level
                    ? `${p.color} shadow-sm scale-110`
                    : 'text-on-surface-variant hover:bg-surface/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!newItemText.trim()}
            className="px-4 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto space-y-1">
        {sortedTodos.length === 0 ? (
          <div className="text-center text-on-surface-variant py-6 opacity-40">
            <span className="material-symbols-outlined text-[36px] mb-2">task_alt</span>
            <p className="text-sm">Add a task above</p>
          </div>
        ) : (
          sortedTodos.map(todo => (
            <div
              key={todo.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all group ${
                todo.completed
                  ? 'bg-surface/10 border-transparent'
                  : isOverdue(todo.dueDate) && !todo.completed
                    ? 'bg-error/5 border-error/20'
                    : 'bg-surface/50 border-outline/10 hover:border-primary/30 shadow-sm'
              }`}
            >
              <button
                onClick={() => toggleTodo(todo.id)}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                  todo.completed ? 'bg-primary text-on-primary' : 'border-2 border-on-surface-variant hover:border-primary text-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">check</span>
              </button>

              {(todo.priority != null && todo.priority >= 1 && todo.priority <= 5) && (
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                  PRIORITIES[todo.priority - 1].color.replace('text-white', 'text-white/90')
                }`}>
                  P{todo.priority}
                </span>
              )}

              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className={`text-sm font-medium truncate ${
                  todo.completed ? 'line-through text-on-surface-variant opacity-50' : 'text-on-surface'
                }`}>
                  {todo.text}
                </span>
                {todo.dueDate && (
                  <span className={`text-[10px] flex items-center gap-0.5 flex-shrink-0 ${
                    isOverdue(todo.dueDate) && !todo.completed ? 'text-error' : 'text-on-surface-variant'
                  }`}>
                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                    {formatDueDate(todo.dueDate)}
                  </span>
                )}
              </div>

              <div className="relative flex-shrink-0">
                <Tooltip label="Set due date">
                <button
                  onClick={() => setShowPicker(showPicker === todo.id ? null : todo.id)}
                  className={`p-1 rounded transition-all text-on-surface-variant hover:bg-surface hover:text-primary ${
                    showPicker === todo.id ? 'bg-surface text-primary' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
                </button>
              </Tooltip>
                {showPicker === todo.id && (
                  <CalendarPicker
                    value={todo.dueDate}
                    onChange={(d) => {
                      updateDueDate(todo.id, d);
                      setShowPicker(null);
                    }}
                    onClose={() => setShowPicker(null)}
                  />
                )}
              </div>

              <Tooltip label="Delete task">
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-error hover:bg-error/10 p-1 rounded transition-all flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
              </Tooltip>
            </div>
          ))
        )}
      </div>
    </div>
  );
}