import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { ApiService } from '../api/client';
import { Play, Square, RotateCcw, Settings } from 'lucide-react';
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
type BallPosition = 'center' | 'left' | 'right';

// ── Component ────────────────────────────────────────────────────────────────

const QuestionnaireMode = () => {
    const [config, setConfig] = useState({
        recordingLength: 10.0,
        windowSize: 2.0,
        refreshRate: 0.5,
        nHarmonics: 5,
        leftFreq: 8.0,
        rightFreq: 12.0,
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
    const [ballPos, setBallPos] = useState<BallPosition>('center');

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Reset ball when going back to idle/recording
    useEffect(() => {
        if (phase === 'idle' || phase === 'recording') setBallPos('center');
    }, [phase]);

    // Animate ball on result
    useEffect(() => {
        if (phase === 'done' && result) {
            const freq = result.majority_frequency;
            if (Math.abs(freq - config.leftFreq) < 0.01) setBallPos('left');
            else if (Math.abs(freq - config.rightFreq) < 0.01) setBallPos('right');
            else {
                const dLeft = Math.abs(freq - config.leftFreq);
                const dRight = Math.abs(freq - config.rightFreq);
                setBallPos(dLeft <= dRight ? 'left' : 'right');
            }
        }
    }, [phase, result]);

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
            ConfigPersistence.save(STORAGE_KEYS.QUESTIONNAIRE_MODE_CONFIG, { config, visibleChannels });
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
        setBallPos('center');
    };

    const handleLoadLastConfig = () => {
        const saved = ConfigPersistence.load<any>(STORAGE_KEYS.QUESTIONNAIRE_MODE_CONFIG);
        if (saved) {
            if (saved.config) setConfig(saved.config);
            if (saved.visibleChannels) setVisibleChannels(saved.visibleChannels);
        } else { alert('No saved configuration found.'); }
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const progress = Math.min((elapsed / config.recordingLength) * 100, 100);
    const isRecording = phase === 'recording';

    // Ball translates ~38% of viewport width left/right
    const ballTranslateX = ballPos === 'left' ? '-38vw' : ballPos === 'right' ? '38vw' : '0px';

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
                        backgroundColor: ballPos === 'left' ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.01)',
                        transition: 'background-color 0.9s ease',
                    }} />

                    {/* Right ambient glow */}
                    <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', pointerEvents: 'none',
                        backgroundColor: ballPos === 'right' ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.01)',
                        transition: 'background-color 0.9s ease',
                    }} />

                    {/* Center divider line */}
                    <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '50%', width: '1px', background: 'rgba(255,255,255,0.04)' }} />

                    {/* ════ LEFT ZONE LABEL ════ */}
                    <div style={{
                        position: 'absolute', left: '5%', top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        transition: 'all 0.7s ease',
                        opacity: ballPos === 'right' ? 0.4 : 1,
                        scale: ballPos === 'left' ? '1.1' : '1',
                    }}>
                        <div style={{
                            width: '120px', height: '120px', borderRadius: '20px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: ballPos === 'left'
                                ? 'rgba(56,189,248,0.1)'
                                : 'rgba(56,189,248,0.04)',
                            border: `2px solid ${ballPos === 'left' ? 'rgba(56,189,248,0.8)' : 'rgba(56,189,248,0.2)'}`,
                            boxShadow: ballPos === 'left' ? '0 0 50px rgba(56,189,248,0.25)' : 'none',
                            transition: 'all 0.7s ease',
                        }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#38bdf8', lineHeight: 1 }}>
                                {config.leftFreq}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(56,189,248,0.55)', marginTop: '2px' }}>Hz</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(56,189,248,0.45)', textTransform: 'uppercase' }}>← LEFT</span>
                        {ballPos === 'left' && phase === 'done' && (
                            <div style={{
                                fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', borderRadius: '99px',
                                background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)',
                                animation: 'pulse 2s infinite',
                            }}>✓ Selected</div>
                        )}
                    </div>

                    {/* ════ RIGHT ZONE LABEL ════ */}
                    <div style={{
                        position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        transition: 'all 0.7s ease',
                        opacity: ballPos === 'left' ? 0.4 : 1,
                        scale: ballPos === 'right' ? '1.1' : '1',
                    }}>
                        <div style={{
                            width: '120px', height: '120px', borderRadius: '20px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: ballPos === 'right'
                                ? 'rgba(168,85,247,0.1)'
                                : 'rgba(168,85,247,0.04)',
                            border: `2px solid ${ballPos === 'right' ? 'rgba(168,85,247,0.8)' : 'rgba(168,85,247,0.2)'}`,
                            boxShadow: ballPos === 'right' ? '0 0 50px rgba(168,85,247,0.25)' : 'none',
                            transition: 'all 0.7s ease',
                        }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#a855f7', lineHeight: 1 }}>
                                {config.rightFreq}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(168,85,247,0.55)', marginTop: '2px' }}>Hz</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(168,85,247,0.45)', textTransform: 'uppercase' }}>RIGHT →</span>
                        {ballPos === 'right' && phase === 'done' && (
                            <div style={{
                                fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', borderRadius: '99px',
                                background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)',
                                animation: 'pulse 2s infinite',
                            }}>✓ Selected</div>
                        )}
                    </div>

                    {/* ════ BALL ════ */}
                    <div style={{
                        position: 'relative',
                        transform: `translateX(${ballTranslateX})`,
                        transition: 'transform 0.95s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        zIndex: 20,
                    }}>
                        {/* Pulsing rings when recording */}
                        {isRecording && (
                            <>
                                <div style={{
                                    position: 'absolute', inset: '-30px', borderRadius: '50%',
                                    border: '2px solid rgba(239,68,68,0.25)',
                                    animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
                                }} />
                                <div style={{
                                    position: 'absolute', inset: '-50px', borderRadius: '50%',
                                    border: '2px solid rgba(239,68,68,0.12)',
                                    animation: 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
                                    animationDelay: '0.3s',
                                }} />
                            </>
                        )}

                        {/* The ball */}
                        <div style={{
                            width: '88px', height: '88px', borderRadius: '50%',
                            background: isRecording
                                ? '#f87171'
                                : ballPos === 'left'
                                ? '#38bdf8'
                                : ballPos === 'right'
                                ? '#a855f7'
                                : '#64748b',
                            boxShadow: isRecording
                                ? '0 0 40px rgba(239,68,68,0.65), inset 0 3px 10px rgba(255,255,255,0.2)'
                                : ballPos === 'left'
                                ? '0 0 60px rgba(56,189,248,0.75), inset 0 3px 10px rgba(255,255,255,0.25)'
                                : ballPos === 'right'
                                ? '0 0 60px rgba(168,85,247,0.75), inset 0 3px 10px rgba(255,255,255,0.25)'
                                : '0 0 20px rgba(100,116,139,0.3), inset 0 3px 6px rgba(255,255,255,0.08)',
                            position: 'relative',
                            transition: 'background 0.45s ease, box-shadow 0.45s ease',
                        }}>
                            {/* Specular highlight */}
                            <div style={{
                                position: 'absolute', top: '14px', left: '20px',
                                width: '22px', height: '12px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.28)', filter: 'blur(3px)',
                            }} />
                        </div>
                    </div>

                    {/* ════ STATUS OVERLAY (below ball) ════ */}
                    <div style={{
                        position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                        zIndex: 20, whiteSpace: 'nowrap',
                    }}>

                        {phase === 'idle' && (
                            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                                Configure below, then press <strong style={{ color: 'white' }}>Start Recording</strong>
                            </p>
                        )}

                        {phase === 'recording' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '280px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                                    <Square size={12} style={{ fill: '#f87171' }} />
                                    <span>Recording…</span>
                                    <span style={{ color: 'white', fontFamily: 'monospace' }}>{elapsed.toFixed(1)}s</span>
                                    <span style={{ color: 'rgba(148,163,184,0.5)' }}>/ {config.recordingLength}s</span>
                                    {estimatedSegments !== null && (
                                        <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.7rem' }}>· ~{estimatedSegments} seg</span>
                                    )}
                                </div>
                                {/* Progress bar */}
                                <div style={{ width: '280px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{
                                        height: '100%', borderRadius: '3px',
                                        width: `${progress}%`,
                                        background: '#ef4444',
                                        transition: 'width 0.5s ease-out',
                                    }} />
                                </div>
                            </div>
                        )}

                        {phase === 'done' && result && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase' }}>Majority Result</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                    <span style={{
                                        fontSize: '3rem', fontWeight: 900, lineHeight: 1,
                                        color: ballPos === 'left' ? '#38bdf8' : '#a855f7',
                                        textShadow: `0 0 30px ${ballPos === 'left' ? 'rgba(56,189,248,0.5)' : 'rgba(168,85,247,0.5)'}`,
                                    }}>
                                        {result.majority_frequency.toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: '1.25rem', color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>Hz</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(100,116,139,0.8)' }}>
                                    from {result.segment_count} segment{result.segment_count !== 1 ? 's' : ''}
                                </div>
                                {/* Mini breakdown pills */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                    {Object.entries(result.frequency_counts)
                                        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                        .map(([freq, count]) => {
                                            const isWinner = parseFloat(freq) === result.majority_frequency;
                                            const isLeft = Math.abs(parseFloat(freq) - config.leftFreq) < 0.01;
                                            return (
                                                <div key={freq} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLeft ? '#38bdf8' : '#a855f7' }} />
                                                    <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: isWinner ? 700 : 400, color: isWinner ? 'white' : 'rgba(100,116,139,0.8)' }}>
                                                        {parseFloat(freq).toFixed(1)} Hz × {count}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {phase === 'error' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>⚠ {errorMsg}</div>
                                <button onClick={handleReset}
                                    style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RotateCcw size={13} /> Try Again
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CSS keyframe for ping */}
                    <style>{`
                        @keyframes ping {
                            75%, 100% { transform: scale(2.5); opacity: 0; }
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
                                <Settings size={13} /> Questionnaire
                            </div>
                            {(phase === 'idle' || phase === 'error') ? (
                                <button onClick={handleStart} className="btn btn-success btn-sm" style={{ width: '100%' }}>
                                    <Play size={14} /> Start Recording
                                </button>
                            ) : phase === 'done' ? (
                                <button onClick={handleReset} className="btn btn-outline btn-sm" style={{ width: '100%', borderColor: 'rgba(0,240,255,0.4)', color: '#00f0ff' }}>
                                    <RotateCcw size={14} /> New Recording
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

                        {/* ── Left / Right Frequencies ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '190px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Target Frequencies</div>
                            {([
                                { label: 'LEFT', key: 'leftFreq', color: '#38bdf8' },
                                { label: 'RIGHT', key: 'rightFreq', color: '#a855f7' },
                            ] as const).map(({ label, key, color }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.05em', width: '36px' }}>{label}</label>
                                    <input
                                        type="number"
                                        value={config[key]}
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
                                        value={config[key]}
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

export default QuestionnaireMode;
