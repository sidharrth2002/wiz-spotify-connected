import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Layout, Mode, RoomsResponse } from './types';

const modes: Mode[] = ['auto', 'calm', 'party', 'surround'];

const apiBase = import.meta.env.VITE_API_BASE || '';

const buildUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(path, apiBase || window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const clampLayout = (layout: Layout): Layout =>
  Object.fromEntries(
    Object.entries(layout || {}).map(([id, pos]) => {
      const x = clamp01(typeof pos.x === 'number' ? pos.x : 0.5);
      const y = clamp01(typeof pos.y === 'number' ? pos.y : 0.5);
      return [id, { x, y }];
    })
  );

const buildCircleLayout = (roomIds: string[]): Layout => {
  if (!roomIds.length) return {};
  const radius = 0.35;
  const center = 0.5;
  return roomIds.reduce((acc, id, index) => {
    const angle = (index / roomIds.length) * Math.PI * 2;
    acc[id] = {
      x: clamp01(center + radius * Math.cos(angle)),
      y: clamp01(center + radius * Math.sin(angle))
    };
    return acc;
  }, {} as Layout);
};

const mergeLayout = (roomIds: string[], incoming?: Layout): Layout => {
  const sanitized = clampLayout(incoming || {});
  const missing = roomIds.filter((id) => !sanitized[id]);
  if (!missing.length) return sanitized;
  const defaults = buildCircleLayout(missing);
  return { ...sanitized, ...defaults };
};

const App: React.FC = () => {
  const [rooms, setRooms] = useState<RoomsResponse>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>('auto');
  const [sensitivity, setSensitivity] = useState('1.1');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [layout, setLayout] = useState<Layout>({});
  const [dragging, setDragging] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  const roomIds = useMemo(() => Object.keys(rooms), [rooms]);
  const selectedRoomIds = useMemo(
    () => roomIds.filter((id) => selected[id] !== false),
    [roomIds, selected]
  );

  const persistLayout = async (nextLayout: Layout) => {
    try {
      const res = await fetch(buildUrl('/layout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextLayout)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('Layout saved for surround mode');
    } catch (err: any) {
      setStatus(`Layout save failed: ${err?.message || err}`);
    }
  };

  const queueLayoutSave = (nextLayout: Layout) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistLayout(nextLayout);
    }, 350);
  };

  const updatePosition = (roomId: string, clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top) / rect.height);

    setLayout((prev) => {
      const next = { ...prev, [roomId]: { x, y } };
      queueLayoutSave(next);
      return next;
    });
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragging) return;
      updatePosition(dragging, event.clientX, event.clientY);
    };

    const handleUp = () => setDragging(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging]);

  const fetchRooms = async () => {
    setLoading(true);
    setStatus('Loading rooms…');
    try {
      const res = await fetch(buildUrl('/rooms'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RoomsResponse = await res.json();
      setRooms(data || {});
      setSelected((prev) => {
        const next: Record<string, boolean> = { ...prev };
        Object.keys(data || {}).forEach((id) => {
          if (!(id in next)) next[id] = true;
        });
        return next;
      });
      await fetchLayout(data || {});
      setStatus('Rooms loaded');
    } catch (err: any) {
      setStatus(`Failed to load rooms: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLayout = async (roomsData: RoomsResponse) => {
    try {
      const res = await fetch(buildUrl('/layout'));
      const payload = res.ok ? await res.json() : {};
      setLayout(mergeLayout(Object.keys(roomsData), payload as Layout));
    } catch (_err) {
      setLayout(mergeLayout(Object.keys(roomsData), {}));
    }
  };

  const start = async () => {
    if (selectedRoomIds.length === 0) {
      setStatus('Select at least one room');
      return;
    }
    setLoading(true);
    setStatus('Starting…');
    try {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        await persistLayout(layout);
      } else if (Object.keys(layout).length) {
        await persistLayout(layout);
      }

      const params = {
        roomIds: selectedRoomIds.join(','),
        mode,
        sensitivity: sensitivity || '1.1'
      };
      const res = await fetch(buildUrl('/dance-to-system-audio', params));
      const text = await res.text();
      setStatus(text || 'Started');
    } catch (err: any) {
      setStatus(`Failed to start: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const abort = async () => {
    setLoading(true);
    setStatus('Aborting…');
    try {
      const res = await fetch(buildUrl('/dance-to-system-audio/abort'));
      const text = await res.text();
      setStatus(text || 'Aborted');
    } catch (err: any) {
      setStatus(`Failed to abort: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
  }, []);

  return (
    <div className="page">
      <div className="glow" />
      <header className="hero">
        <div>
          <p className="eyebrow">Live audio → Wiz</p>
          <h1>Wiz Audio Sync</h1>
          <p className="sub">Pick rooms, pick a vibe, launch the Mac audio tap.</p>
        </div>
        <div className="pill">Rooms: {roomIds.length}</div>
      </header>

      <section className="card">
        <div className="card-head">
          <h3>Rooms</h3>
          <button className="ghost" onClick={fetchRooms} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="chips" aria-live="polite">
          {roomIds.length === 0 && <div className="muted">No rooms yet. Turn bulbs on and hit refresh.</div>}
          {roomIds.map((id) => (
            <label key={id} className={`chip ${selected[id] === false ? 'dim' : ''}`}>
              <input
                type="checkbox"
                checked={selected[id] !== false}
                onChange={(e) => setSelected((prev) => ({ ...prev, [id]: e.target.checked }))}
              />
              <span className="chip-label">{id}</span>
              <span className="chip-meta">{rooms[id]?.length || 0} bulbs</span>
            </label>
          ))}
        </div>
        <p className="hint">Surround mode splits left/right using the layout below (vertical center line).</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Room layout</h3>
          <p className="hint">Drag the lamps to mirror your space. Placement drives surround flow.</p>
        </div>
        <div className="layout-board" ref={boardRef} aria-label="Room layout canvas">
          {roomIds.length === 0 && <div className="muted empty-board">Discover rooms to place them on the map.</div>}
          {roomIds.map((id) => {
            const pos = layout[id] ?? { x: 0.5, y: 0.5 };
            return (
              <button
                key={id}
                className={`lamp ${dragging === id ? 'dragging' : ''} ${selected[id] === false ? 'dim' : ''}`}
                style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragging(id);
                  updatePosition(id, event.clientX, event.clientY);
                }}
              >
                <span className="lamp-dot" />
                <span className="lamp-label">{id}</span>
                <span className="lamp-meta">{rooms[id]?.length || 0} bulbs</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card grid">
        <div className="field">
          <label>Mode</label>
          <div className="segmented">
            {modes.map((m) => (
              <button
                key={m}
                className={m === mode ? 'seg active' : 'seg'}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Sensitivity</label>
          <input
            type="number"
            min="0.8"
            max="2.5"
            step="0.05"
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value)}
          />
          <p className="hint">Higher = more reactive</p>
        </div>
      </section>

      <section className="card actions">
        <div className="actions-row">
          <button className="primary" onClick={start} disabled={loading}>
            Start system audio sync
          </button>
          <button className="ghost" onClick={abort} disabled={loading}>
            Abort
          </button>
        </div>
        <div className="status">{status || 'Idle'}</div>
      </section>
    </div>
  );
};

export default App;
