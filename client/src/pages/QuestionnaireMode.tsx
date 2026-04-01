import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { ApiService } from '../api/client';
import { Play, Square, RotateCcw, Settings, ClipboardList } from 'lucide-react';
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

// ── Component ────────────────────────────────────────────────────────────────

const QuestionnaireMode = () => {
    const [config, setConfig] = useState({
        recordingLength: 10.0,
        windowSize: 2.0,
        refreshRate: 0.5,
        frequencies: [8.0, 10.0, 12.0, 14.0],
        nHarmonics: 5,
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

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
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
            } catch (e) {
                console.error('Poll error', e);
            }
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
                candidate_frequencies: config.frequencies,
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
    };

    const handleLoadLastConfig = () => {
        const saved = ConfigPersistence.load<any>(STORAGE_KEYS.QUESTIONNAIRE_MODE_CONFIG);
        if (saved) {
            if (saved.config) setConfig(saved.config);
            if (saved.visibleChannels) setVisibleChannels(saved.visibleChannels);
        } else {
            alert('No saved configuration found.');
        }
    };

    const handleFreqChange = (idx: number, val: string) => {
        const newFreqs = [...config.frequencies];
        newFreqs[idx] = parseFloat(val) || 0;
        setConfig(prev => ({ ...prev, frequencies: newFreqs }));
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const progress = Math.min((elapsed / config.recordingLength) * 100, 100);

    const maxCount = result
        ? Math.max(...Object.values(result.frequency_counts), 1)
        : 1;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Layout fullWidth>
            <div className="h-[calc(100vh-5rem)] flex flex-col overflow-hidden">

                {/* ── Main Area ─────────────────────────────────────────────── */}
                <div className="flex-1 bg-[#0a0b0f] relative flex flex-col items-center justify-center overflow-hidden">

                    {/* Decorative background grid */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(100,200,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(100,200,255,0.5) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                        }}
                    />

                    {/* ── IDLE ────────────────────────────────────────────── */}
                    {phase === 'idle' && (
                        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-8">
                            <ClipboardList size={56} className="text-accent opacity-60" />
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Questionnaire Mode</h2>
                                <p className="text-slate-400 text-sm max-w-sm">
                                    Configure a fixed-length EEG recording. TMSI will classify overlapping windows
                                    and return the majority-selected frequency.
                                </p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2">
                                {config.frequencies.map((f, i) => (
                                    <span key={i} className="px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-semibold">
                                        {f} Hz
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500">Configure above, then press <strong className="text-white">Start Recording</strong></p>
                        </div>
                    )}

                    {/* ── RECORDING ───────────────────────────────────────── */}
                    {phase === 'recording' && (
                        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-8">

                            {/* Pulsing ring */}
                            <div className="relative flex items-center justify-center">
                                <div className="absolute w-28 h-28 rounded-full border-2 border-red-500/40 animate-ping" />
                                <div className="absolute w-20 h-20 rounded-full border-2 border-red-500/60 animate-ping" style={{ animationDelay: '0.3s' }} />
                                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                                    <Square size={24} className="text-red-400 fill-red-400" />
                                </div>
                            </div>

                            <div className="text-center">
                                <div className="text-lg font-semibold text-white mb-1">Recording EEG…</div>
                                <div className="text-slate-400 text-sm">
                                    {elapsed.toFixed(1)}s / {config.recordingLength}s
                                    {estimatedSegments !== null && (
                                        <span className="ml-2 text-slate-500">· ~{estimatedSegments} segments</span>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full">
                                <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden border border-border-color">
                                    <div
                                        className="h-full bg-gradient-to-r from-red-500 to-accent rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1 text-xs text-slate-500">
                                    <span>0s</span>
                                    <span>{config.recordingLength}s</span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-600 italic">Focus on the target stimulus…</p>
                        </div>
                    )}

                    {/* ── DONE ────────────────────────────────────────────── */}
                    {phase === 'done' && result && (
                        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-xl px-8">

                            {/* Winner badge */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Majority Selection</div>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-7xl font-black text-white" style={{ textShadow: '0 0 40px rgba(100,200,255,0.4)' }}>
                                        {result.majority_frequency.toFixed(1)}
                                    </span>
                                    <span className="text-2xl text-slate-400 font-semibold">Hz</span>
                                </div>
                                <div className="text-slate-500 text-sm">
                                    from {result.segment_count} segment{result.segment_count !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {/* Frequency breakdown */}
                            <div className="w-full bg-bg-secondary/60 border border-border-color rounded-xl p-5 backdrop-blur-sm">
                                <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-4">Frequency Breakdown</div>
                                <div className="flex flex-col gap-3">
                                    {Object.entries(result.frequency_counts)
                                        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                        .map(([freq, count]) => {
                                            const isWinner = parseFloat(freq) === result.majority_frequency;
                                            const pct = (count / maxCount) * 100;
                                            return (
                                                <div key={freq} className="flex items-center gap-3">
                                                    <div className={`w-16 text-right text-sm font-bold ${isWinner ? 'text-accent' : 'text-slate-400'}`}>
                                                        {parseFloat(freq).toFixed(1)} Hz
                                                    </div>
                                                    <div className="flex-1 h-6 bg-bg-tertiary rounded overflow-hidden border border-border-color">
                                                        <div
                                                            className={`h-full rounded transition-all duration-700 flex items-center justify-end pr-2 ${isWinner
                                                                ? 'bg-gradient-to-r from-accent/60 to-accent'
                                                                : 'bg-gradient-to-r from-slate-700 to-slate-600'
                                                                }`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <div className={`w-8 text-sm font-mono ${isWinner ? 'text-accent font-bold' : 'text-slate-500'}`}>
                                                        {count}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Reset */}
                            <button
                                onClick={handleReset}
                                className="btn btn-outline btn-sm gap-2 border-accent/40 text-accent hover:bg-accent/10"
                            >
                                <RotateCcw size={14} /> New Recording
                            </button>
                        </div>
                    )}

                    {/* ── ERROR ───────────────────────────────────────────── */}
                    {phase === 'error' && (
                        <div className="relative z-10 flex flex-col items-center gap-4 text-center px-8">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center text-2xl">⚠️</div>
                            <div>
                                <div className="text-white font-semibold mb-1">Failed to Start Recording</div>
                                <div className="text-red-400 text-sm max-w-sm">{errorMsg}</div>
                            </div>
                            <button onClick={handleReset} className="btn btn-outline btn-sm gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10">
                                <RotateCcw size={14} /> Try Again
                            </button>
                        </div>
                    )}

                </div>{/* end main area */}

                {/* ── Config Panel (Bottom) ────────────────────────────────────── */}
                <div className="w-full bg-bg-tertiary border-t border-border-color shrink-0">

                    {/* Top row: controls / params / frequencies */}
                    <div className="flex flex-row gap-8 px-4 pt-4 pb-2 items-start overflow-x-auto">

                        {/* Control Group */}
                        <div className="flex flex-col gap-3 min-w-[160px]">
                            <h2 className="text-base font-bold text-primary flex items-center gap-2 uppercase tracking-wide">
                                <Settings size={18} className="text-accent" />
                                Questionnaire
                            </h2>

                            <div className="flex flex-col gap-2">
                                {phase === 'idle' || phase === 'error' ? (
                                    <button
                                        onClick={handleStart}
                                        className="flex-1 btn btn-success btn-sm gap-2"
                                    >
                                        <Play size={16} /> Start Recording
                                    </button>
                                ) : phase === 'done' ? (
                                    <button onClick={handleReset} className="flex-1 btn btn-outline btn-sm gap-2 border-accent/40 text-accent">
                                        <RotateCcw size={16} /> New Recording
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-400 text-xs font-semibold animate-pulse">
                                        <Square size={14} className="fill-red-400" /> Recording…
                                    </div>
                                )}
                            </div>

                            {(phase === 'idle' || phase === 'error') && (
                                <button
                                    onClick={handleLoadLastConfig}
                                    className="btn btn-outline btn-sm gap-2 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                                >
                                    <RotateCcw size={14} /> Restore Last
                                </button>
                            )}
                        </div>

                        <div className="w-px bg-border-color self-stretch my-1" />

                        {/* Parameters */}
                        <div className="flex flex-col gap-3 min-w-[170px]">
                            <h3 className="text-xs font-bold text-secondary uppercase tracking-wide">Parameters</h3>
                            <div className="space-y-2">
                                {[
                                    { label: 'Rec. Length (s)', key: 'recordingLength', step: 1, min: 1 },
                                    { label: 'Window (s)', key: 'windowSize', step: 0.1, min: 0.5 },
                                    { label: 'Refresh (s)', key: 'refreshRate', step: 0.05, min: 0.05 },
                                    { label: 'Harmonics', key: 'nHarmonics', step: 1, min: 1 },
                                ].map(({ label, key, step, min }) => (
                                    <div key={key} className="flex items-center justify-between gap-2">
                                        <label className="text-xs uppercase text-tertiary font-semibold whitespace-nowrap">{label}</label>
                                        <input
                                            type="number"
                                            value={config[key as keyof typeof config] as number}
                                            onChange={e =>
                                                setConfig(prev => ({
                                                    ...prev,
                                                    [key]: key === 'nHarmonics' ? parseInt(e.target.value) || 1 : parseFloat(e.target.value),
                                                }))
                                            }
                                            step={step}
                                            min={min}
                                            disabled={phase === 'recording'}
                                            className="w-20 bg-bg-secondary border border-border-color rounded px-2 py-1 text-primary text-xs text-center transition-colors hover:border-accent focus:border-accent disabled:opacity-40"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="w-px bg-slate-700 self-stretch my-1" />

                        {/* Frequencies */}
                        <div className="flex flex-col gap-3 min-w-[180px]">
                            <h3 className="text-xs font-bold text-secondary uppercase tracking-wide">Target Frequencies</h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {config.frequencies.map((freq, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <div className="w-2 h-2 rounded-full bg-accent border-2 border-accent" />
                                        <input
                                            type="number"
                                            value={freq}
                                            onChange={e => handleFreqChange(idx, e.target.value)}
                                            disabled={phase === 'recording'}
                                            className="w-16 bg-bg-secondary border border-border-color rounded px-2 py-1 text-primary text-xs transition-colors hover:border-accent focus:border-accent disabled:opacity-40"
                                        />
                                        <span className="text-tertiary text-xs">Hz</span>
                                    </div>
                                ))}
                            </div>
                            {phase !== 'recording' && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, frequencies: [...prev.frequencies, 10.0] }))}
                                        className="text-xs text-accent hover:text-accent-light font-semibold"
                                    >
                                        + Add
                                    </button>
                                    {config.frequencies.length > 1 && (
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, frequencies: prev.frequencies.slice(0, -1) }))}
                                            className="text-xs text-error hover:text-error font-semibold"
                                        >
                                            − Remove
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>{/* end top row */}

                    {/* Divider */}
                    <div className="h-px bg-border-color mx-4" />

                    {/* Bottom row: channels — full width so buttons never clip */}
                    <div className="px-4 py-3">
                        <h3 className="text-[10px] font-bold text-white uppercase opacity-70 mb-2">Active Channels</h3>
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

                </div>{/* end config panel */}
            </div>
        </Layout>
    );
};

export default QuestionnaireMode;
