import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { ApiService } from '../api/client';
import { Play, Square, RotateCcw, Settings, Image as ImageIcon } from 'lucide-react';
import HorizontalChannelControls from '../components/Visualizations/HorizontalChannelControls';
import { ConfigPersistence, STORAGE_KEYS } from '../utils/configPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

interface QuestionnaireResult {
    majority_frequency: number;
    segment_count: number;
    frequency_counts: Record<string, number>;
    all_decisions: number[];
}

type Phase = 'idle' | 'recording' | 'done' | 'error';
type SelectionState = 'none' | 'left' | 'right';

// ── Component ────────────────────────────────────────────────────────────────

const ImageSelectionMode = () => {
    const [config, setConfig] = useState({
        recordingLength: 10.0,
        windowSize: 2.0,
        refreshRate: 0.5,
        nHarmonics: 5,
        leftFreq: 8.0,
        rightFreq: 12.0,
        leftImageUrl: '/images/cat.png',
        rightImageUrl: '/images/dog.png',
    });

    const [visibleChannels, setVisibleChannels] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'].forEach(ch => (initial[ch] = true));
        return initial;
    });

    const [phase, setPhase] = useState<Phase>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [estimatedSegments, setEstimatedSegments] = useState<number | null>(null);
    const [result, setResult] = useState<QuestionnaireResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [selection, setSelection] = useState<SelectionState>('none');

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Reset selection when going back to idle/recording
    useEffect(() => {
        if (phase === 'idle' || phase === 'recording') setSelection('none');
    }, [phase]);

    // Handle result
    useEffect(() => {
        if (phase === 'done' && result) {
            const freq = result.majority_frequency;
            if (Math.abs(freq - config.leftFreq) < 0.01) setSelection('left');
            else if (Math.abs(freq - config.rightFreq) < 0.01) setSelection('right');
            else {
                const dLeft = Math.abs(freq - config.leftFreq);
                const dRight = Math.abs(freq - config.rightFreq);
                setSelection(dLeft <= dRight ? 'left' : 'right');
            }
        }
    }, [phase, result, config.leftFreq, config.rightFreq]);

    // ── Polling ───────────────────────────────────────────────────────────────

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const startPolling = () => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const data = await ApiService.getQuestionnaireResult();
                setElapsed(data.elapsed ?? 0);
                if (data.done && data.result) {
                    stopPolling();
                    setResult(data.result);
                    setPhase('done');
                }
            } catch (e) { console.error('Poll error', e); }
        }, 500);
    };

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleStart = async () => {
        const activeChannels = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8']
            .map((ch, idx) => (visibleChannels[ch] ? idx : -1))
            .filter(idx => idx !== -1);

        try {
            setErrorMsg('');
            const resp = await ApiService.startQuestionnaireRecording({
                recording_length: config.recordingLength,
                window_size: config.windowSize,
                refresh_rate: config.refreshRate,
                candidate_frequencies: [config.leftFreq, config.rightFreq],
                n_harmonics: config.nHarmonics,
                channels: activeChannels,
            });
            setEstimatedSegments(resp.estimated_segments ?? null);
            setElapsed(0);
            setResult(null);
            setPhase('recording');
            startPolling();
            ConfigPersistence.save('IMAGE_SELECTION_MODE_CONFIG', { config, visibleChannels });
        } catch (e: any) {
            const msg = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
            setErrorMsg(msg);
            setPhase('error');
        }
    };

    const handleReset = () => {
        stopPolling();
        setPhase('idle');
        setElapsed(0);
        setResult(null);
        setErrorMsg('');
        setEstimatedSegments(null);
        setSelection('none');
    };

    const handleLoadLastConfig = () => {
        const saved = ConfigPersistence.load<any>('IMAGE_SELECTION_MODE_CONFIG');
        if (saved) {
            if (saved.config) setConfig(saved.config);
            if (saved.visibleChannels) setVisibleChannels(saved.visibleChannels);
        } else { alert('No saved configuration found.'); }
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const progress = Math.min((elapsed / config.recordingLength) * 100, 100);
    const isRecording = phase === 'recording';

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Layout fullWidth>
            {/* Outer wrapper — fills the space below the navbar */}
            <div style={{ height: 'calc(100vh - 5rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* ══════════════════ GAME ARENA ══════════════════ */}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#080a10' }}>

                    {/* Grid background */}
                    <div style={{
                        position: 'absolute', inset: 0, opacity: 0.04,
                        backgroundImage: 'linear-gradient(rgba(100,200,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(100,200,255,0.5) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }} />

                    {/* Left ambient glow */}
                    <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', pointerEvents: 'none',
                        backgroundColor: selection === 'left' ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.01)',
                        transition: 'background-color 0.9s ease',
                    }} />

                    {/* Right ambient glow */}
                    <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', pointerEvents: 'none',
                        backgroundColor: selection === 'right' ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.01)',
                        transition: 'background-color 0.9s ease',
                    }} />

                    {/* Center divider line */}
                    <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '50%', width: '1px', background: 'rgba(255,255,255,0.04)' }} />

                    {/* ════ LEFT IMAGE ZONE ════ */}
                    <div style={{
                        position: 'absolute', left: '10%', top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        transition: 'all 0.7s ease',
                        opacity: selection === 'right' ? 0.2 : (phase === 'done' && selection === 'left' ? 0 : 1), // Hide when popped up
                    }}>
                        <div style={{
                            width: '400px', height: '400px', borderRadius: '32px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: '#111',
                            border: `2px solid rgba(56,189,248,0.2)`,
                            boxShadow: '0 0 30px rgba(56,189,248,0.1)',
                            transition: 'all 0.7s ease',
                            overflow: 'hidden',
                            position: 'relative',
                        }}>
                            {config.leftImageUrl ? (
                                <img src={config.leftImageUrl} alt="Left option" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <ImageIcon size={48} color="rgba(56,189,248,0.5)" />
                            )}
                            {/* Frequency badge */}
                            <div style={{
                                position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                                padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.4)',
                                display: 'flex', alignItems: 'baseline', gap: '4px'
                            }}>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>{config.leftFreq}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(56,189,248,0.7)' }}>Hz</span>
                            </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(56,189,248,0.6)', textTransform: 'uppercase' }}>← LEFT</span>
                    </div>

                    {/* ════ RIGHT IMAGE ZONE ════ */}
                    <div style={{
                        position: 'absolute', right: '10%', top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        transition: 'all 0.7s ease',
                        opacity: selection === 'left' ? 0.2 : (phase === 'done' && selection === 'right' ? 0 : 1), // Hide when popped up
                    }}>
                        <div style={{
                            width: '400px', height: '400px', borderRadius: '32px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: '#111',
                            border: `2px solid rgba(168,85,247,0.2)`,
                            boxShadow: '0 0 30px rgba(168,85,247,0.1)',
                            transition: 'all 0.7s ease',
                            overflow: 'hidden',
                            position: 'relative',
                        }}>
                            {config.rightImageUrl ? (
                                <img src={config.rightImageUrl} alt="Right option" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <ImageIcon size={48} color="rgba(168,85,247,0.5)" />
                            )}
                            {/* Frequency badge */}
                            <div style={{
                                position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                                padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.4)',
                                display: 'flex', alignItems: 'baseline', gap: '4px'
                            }}>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#a855f7' }}>{config.rightFreq}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(168,85,247,0.7)' }}>Hz</span>
                            </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(168,85,247,0.6)', textTransform: 'uppercase' }}>RIGHT →</span>
                    </div>

                    {/* ════ CENTER POPUP WHEN DONE ════ */}
                    {phase === 'done' && selection !== 'none' && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 30,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(8,10,16,0.85)', backdropFilter: 'blur(8px)',
                            animation: 'fadeIn 0.5s ease forwards',
                        }}>
                            <h2 style={{
                                fontSize: '2.5rem', fontWeight: 900, marginBottom: '24px',
                                color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                animation: 'slideDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                            }}>
                                You Picked This!
                            </h2>
                            <div style={{
                                width: '320px', height: '320px', borderRadius: '32px',
                                overflow: 'hidden', position: 'relative',
                                border: `4px solid ${selection === 'left' ? '#38bdf8' : '#a855f7'}`,
                                boxShadow: `0 0 80px ${selection === 'left' ? 'rgba(56,189,248,0.4)' : 'rgba(168,85,247,0.4)'}`,
                                animation: 'popIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                            }}>
                                <img
                                    src={selection === 'left' ? config.leftImageUrl : config.rightImageUrl}
                                    alt="Selected"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    backgroundColor: selection === 'left' ? 'rgba(56,189,248,0.1)' : 'rgba(168,85,247,0.1)',
                                    pointerEvents: 'none',
                                }} />
                            </div>

                            <button
                                onClick={handleReset}
                                style={{
                                    marginTop: '40px', padding: '12px 32px', borderRadius: '99px',
                                    background: selection === 'left' ? '#38bdf8' : '#a855f7', color: 'black',
                                    fontSize: '1.1rem', fontWeight: 800, border: 'none', cursor: 'pointer',
                                    boxShadow: `0 4px 20px ${selection === 'left' ? 'rgba(56,189,248,0.4)' : 'rgba(168,85,247,0.4)'}`,
                                    animation: 'slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                                    animationDelay: '0.2s', opacity: 0, fillMode: 'forwards'
                                }}
                            >
                                Play Again
                            </button>
                        </div>
                    )}


                    {/* ════ STATUS OVERLAY (bottom) ════ */}
                    <div style={{
                        position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                        zIndex: 20, whiteSpace: 'nowrap',
                    }}>

                        {phase === 'idle' && (
                            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.85rem', letterSpacing: '0.05em', background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '20px' }}>
                                Look at the image you want to select, then press <strong style={{ color: 'white' }}>Start Recording</strong>
                            </p>
                        )}

                        {phase === 'recording' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '280px', background: 'rgba(0,0,0,0.6)', padding: '16px', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '1rem', fontWeight: 600 }}>
                                    <Square size={16} style={{ fill: '#f87171', animation: 'pulse 1s infinite' }} />
                                    <span>Recording Focus…</span>
                                    <span style={{ color: 'white', fontFamily: 'monospace' }}>{elapsed.toFixed(1)}s</span>
                                    <span style={{ color: 'rgba(148,163,184,0.5)' }}>/ {config.recordingLength}s</span>
                                </div>
                                {/* Progress bar */}
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{
                                        height: '100%', borderRadius: '4px',
                                        width: `${progress}%`,
                                        background: '#ef4444',
                                        transition: 'width 0.5s ease-out',
                                    }} />
                                </div>
                            </div>
                        )}

                        {phase === 'error' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.8)', padding: '16px', borderRadius: '12px' }}>
                                <div style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 600 }}>⚠ {errorMsg}</div>
                                <button onClick={handleReset}
                                    style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RotateCcw size={14} /> Try Again
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CSS keyframes */}
                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes popIn {
                            0% { transform: scale(0.5); opacity: 0; }
                            50% { transform: scale(1.05); opacity: 1; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                        @keyframes slideDown {
                            from { transform: translateY(-30px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                        @keyframes slideUp {
                            from { transform: translateY(30px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.5; }
                        }
                    `}</style>

                </div>{/* end arena */}

                {/* ══════════════════ CONFIG PANEL ══════════════════ */}
                <div style={{ background: '#111111', borderTop: '1px solid #222222', flexShrink: 0 }}>

                    {/* Single scrollable row */}
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', padding: '12px 16px', alignItems: 'flex-start', overflowX: 'auto' }}>

                        {/* ── Controls ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Settings size={13} /> Image Selection
                            </div>
                            {(phase === 'idle' || phase === 'error') ? (
                                <button onClick={handleStart} className="btn btn-success btn-sm" style={{ width: '100%' }}>
                                    <Play size={14} /> Start Recording
                                </button>
                            ) : phase === 'done' ? (
                                <button onClick={handleReset} className="btn btn-outline btn-sm" style={{ width: '100%', borderColor: 'rgba(0,240,255,0.4)', color: '#00f0ff' }}>
                                    <RotateCcw size={14} /> Play Again
                                </button>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, animation: 'pulse 2s infinite' }}>
                                    <Square size={12} style={{ fill: '#f87171' }} /> Recording…
                                </div>
                            )}
                            {(phase === 'idle' || phase === 'error') && (
                                <button onClick={handleLoadLastConfig} className="btn btn-outline btn-sm" style={{ width: '100%', borderColor: 'rgba(59,130,246,0.5)', color: '#60a5fa', fontSize: '0.7rem' }}>
                                    <RotateCcw size={12} /> Restore Last
                                </button>
                            )}
                        </div>

                        <div style={{ width: '1px', background: '#222222', alignSelf: 'stretch', margin: '2px 0' }} />

                        {/* ── Image Configuration ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Target Images</div>
                            {([
                                { label: 'LEFT', key: 'leftImageUrl', color: '#38bdf8' },
                                { label: 'RIGHT', key: 'rightImageUrl', color: '#a855f7' },
                            ] as const).map(({ label, key, color }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.05em', width: '36px' }}>{label}</label>
                                    <input
                                        type="text"
                                        value={config[key]}
                                        onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Local Path (e.g., /left.png)"
                                        disabled={isRecording}
                                        style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${isRecording ? '#222' : '#333'}`, color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', height: '30px', outline: 'none' }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ width: '1px', background: '#222222', alignSelf: 'stretch', margin: '2px 0' }} />

                        {/* ── Frequencies ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Frequencies</div>
                            {([
                                { label: 'LEFT', key: 'leftFreq', color: '#38bdf8' },
                                { label: 'RIGHT', key: 'rightFreq', color: '#a855f7' },
                            ] as const).map(({ label, key, color }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.05em', width: '36px' }}>{label}</label>
                                    <input
                                        type="number"
                                        value={config[key as keyof typeof config]}
                                        onChange={e => setConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                        step={0.5} min={1}
                                        disabled={isRecording}
                                        style={{ width: '64px', background: '#0a0a0a', border: `1px solid ${isRecording ? '#222' : '#333'}`, color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', height: '30px', outline: 'none' }}
                                    />
                                    <span style={{ fontSize: '0.7rem', color: '#595959' }}>Hz</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ width: '1px', background: '#222222', alignSelf: 'stretch', margin: '2px 0' }} />

                        {/* ── Parameters ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '190px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Parameters</div>
                            {([
                                { label: 'Rec. Length (s)', key: 'recordingLength', step: 1, min: 1 },
                                { label: 'Window (s)', key: 'windowSize', step: 0.1, min: 0.5 },
                                { label: 'Refresh (s)', key: 'refreshRate', step: 0.05, min: 0.05 },
                                { label: 'Harmonics', key: 'nHarmonics', step: 1, min: 1 },
                            ] as const).map(({ label, key, step, min }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{label}</label>
                                    <input
                                        type="number"
                                        value={config[key as keyof typeof config]}
                                        onChange={e => setConfig(prev => ({
                                            ...prev,
                                            [key]: key === 'nHarmonics' ? parseInt(e.target.value) || 1 : parseFloat(e.target.value),
                                        }))}
                                        step={step} min={min}
                                        disabled={isRecording}
                                        style={{ width: '64px', background: '#0a0a0a', border: `1px solid ${isRecording ? '#222' : '#333'}`, color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', height: '30px', outline: 'none' }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ width: '1px', background: '#222222', alignSelf: 'stretch', margin: '2px 0' }} />

                        {/* ── Channels ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '300px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Channels</div>
                            <HorizontalChannelControls
                                channels={['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8']}
                                visible={visibleChannels}
                                onToggle={ch => setVisibleChannels(prev => ({ ...prev, [ch]: !prev[ch] }))}
                                onToggleAll={show => {
                                    const next = { ...visibleChannels };
                                    ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'].forEach(ch => (next[ch] = show));
                                    setVisibleChannels(next);
                                }}
                            />
                        </div>

                    </div>{/* end single row */}

                </div>{/* end config panel */}

            </div>{/* end outer wrapper */}
        </Layout>
    );
};

export default ImageSelectionMode;
