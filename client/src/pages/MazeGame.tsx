import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { ApiService } from '../api/client';
import { Play, Settings, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import HorizontalChannelControls from '../components/Visualizations/HorizontalChannelControls';
import { ConfigPersistence, STORAGE_KEYS } from '../utils/configPersistence';

// ─── Maze Definition ──────────────────────────────────────────────────────────
// Each level is a horizontal corridor. Segments are defined as [xStart, xEnd] (0–100 units).
// At the top end of each corridor there's an opening that connects to the next level.
// The opening is specified by its center x value in 'upTo' on the level below.

interface Corridor {
    xStart: number;  // 0–100 (percentage)
    xEnd: number;
    upTo: number;    // x-center of the passage leading to the next level (null for top goal)
}

// 6-level maze. Level 0 = bottom (start), Level 5 = top (goal).
const MAZE_LEVELS: Corridor[] = [
    { xStart: 30, xEnd: 70,  upTo: 42 },   // level 0 – start corridor
    { xStart: 20, xEnd: 62,  upTo: 55 },   // level 1
    { xStart: 35, xEnd: 80,  upTo: 68 },   // level 2
    { xStart: 45, xEnd: 85,  upTo: 50 },   // level 3
    { xStart: 25, xEnd: 65,  upTo: 38 },   // level 4
    { xStart: 15, xEnd: 55,  upTo: 35 },   // level 5 – top / goal
];

const STEP = 5;           // % movement per command
const CHAR_WIDTH = 3;     // % half-width of character collision box
const PASSAGE_HALF = 6;   // how wide the passage gap is (±% from upTo centre)

// ─── Types ────────────────────────────────────────────────────────────────────
type GamePhase = 'config' | 'ready' | 'recording' | 'moving' | 'won';

interface MazeConfig {
    recordingLength: number;
    windowSize: number;
    refreshRate: number;
    nHarmonics: number;
    leftFreq: number;
    rightFreq: number;
    moveDelay: number;   // ms pause after move before next recording
}

// ─── Component ────────────────────────────────────────────────────────────────
const MazeGame = () => {
    const [config, setConfig] = useState<MazeConfig>({
        recordingLength: 6.0,
        windowSize: 2.0,
        refreshRate: 0.5,
        nHarmonics: 5,
        leftFreq: 8.0,
        rightFreq: 12.0,
        moveDelay: 1200,
    });

    const [visibleChannels, setVisibleChannels] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'].forEach(ch => (init[ch] = true));
        return init;
    });

    const [gamePhase, setGamePhase] = useState<GamePhase>('config');
    const [charX, setCharX] = useState(50);         // 0–100 %
    const [charLevel, setCharLevel] = useState(0);   // index into MAZE_LEVELS
    const [, setLastDecision] = useState<'left' | 'right' | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [flashDir, setFlashDir] = useState<'left' | 'right' | null>(null);
    const [showPanel, setShowPanel] = useState(true);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const gameActiveRef = useRef(false);  // guards recursive recording loop

    // ── Cleanup ───────────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            gameActiveRef.current = false;
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ── Derived ───────────────────────────────────────────────────────────────
    const totalLevels = MAZE_LEVELS.length;
    const progressPct = Math.round((charLevel / (totalLevels - 1)) * 100);

    // ── Maze movement logic ───────────────────────────────────────────────────
    const tryMove = useCallback((direction: 'left' | 'right', _charX: number, _charLevel: number): { newX: number; newLevel: number } => {
        const lvl = MAZE_LEVELS[_charLevel];
        let newX = direction === 'left' ? _charX - STEP : _charX + STEP;

        // Clamp to walls
        newX = Math.max(lvl.xStart + CHAR_WIDTH, Math.min(lvl.xEnd - CHAR_WIDTH, newX));

        // Check if we landed in the upward passage → advance level
        let newLevel = _charLevel;
        if (_charLevel < MAZE_LEVELS.length - 1) {
            const passageLeft = lvl.upTo - PASSAGE_HALF;
            const passageRight = lvl.upTo + PASSAGE_HALF;
            if (newX >= passageLeft && newX <= passageRight) {
                newLevel = _charLevel + 1;
                // Place character at the same x (restricted to new corridor)
                const nextLvl = MAZE_LEVELS[newLevel];
                newX = Math.max(nextLvl.xStart + CHAR_WIDTH, Math.min(nextLvl.xEnd - CHAR_WIDTH, newX));
            }
        }

        return { newX, newLevel };
    }, []);

    // ── Single recording round ─────────────────────────────────────────────────
    const runOneRound = useCallback(async (currentX: number, currentLevel: number) => {
        if (!gameActiveRef.current) return;

        const activeChannels = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8']
            .map((ch, idx) => (visibleChannels[ch] ? idx : -1))
            .filter(idx => idx !== -1);

        try {
            setGamePhase('recording');
            setElapsed(0);
            setLastDecision(null);

            await ApiService.startQuestionnaireRecording({
                recording_length: config.recordingLength,
                window_size: config.windowSize,
                refresh_rate: config.refreshRate,
                candidate_frequencies: [config.leftFreq, config.rightFreq],
                n_harmonics: config.nHarmonics,
                channels: activeChannels,
            });

            // Poll until done
            await new Promise<void>((resolve, reject) => {
                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = setInterval(async () => {
                    if (!gameActiveRef.current) { clearInterval(pollRef.current!); reject(new Error('stopped')); return; }
                    try {
                        const data = await ApiService.getQuestionnaireResult();
                        setElapsed(data.elapsed ?? 0);
                        if (data.done && data.result) {
                            clearInterval(pollRef.current!);
                            resolve();

                            const freq = data.result.majority_frequency;
                            const isLeft = Math.abs(freq - config.leftFreq) <= Math.abs(freq - config.rightFreq);
                            const decision: 'left' | 'right' = isLeft ? 'left' : 'right';
                            setLastDecision(decision);
                            setFlashDir(decision);
                            setTimeout(() => setFlashDir(null), 700);

                            setGamePhase('moving');

                            // Apply movement (use functional updater pattern via refs)
                            const { newX, newLevel } = tryMove(decision, currentX, currentLevel);
                            setCharX(newX);
                            setCharLevel(newLevel);

                            // Check win — player reached the top level
                            if (newLevel === MAZE_LEVELS.length - 1) {
                                setTimeout(() => {
                                    setGamePhase('won');
                                    gameActiveRef.current = false;
                                }, 900);
                                return;
                            }

                            // After move delay, start next round
                            setTimeout(() => {
                                if (gameActiveRef.current) {
                                    runOneRound(newX, newLevel);
                                }
                            }, config.moveDelay);
                        }
                    } catch (e) { console.error('Poll error', e); }
                }, 500);
            });

        } catch (err: any) {
            if (err?.message === 'stopped') return;
            setErrorMsg(err?.response?.data?.detail ?? err?.message ?? 'Unknown error');
            setGamePhase('config');
            gameActiveRef.current = false;
        }
    }, [config, visibleChannels, tryMove]);

    // ── Start game ────────────────────────────────────────────────────────────
    const handleStart = useCallback(() => {
        setCharX(50);
        setCharLevel(0);
        setLastDecision(null);
        setErrorMsg('');
        setElapsed(0);
        gameActiveRef.current = true;
        ConfigPersistence.save(STORAGE_KEYS.QUESTIONNAIRE_MODE_CONFIG, { config, visibleChannels });
        runOneRound(50, 0);
    }, [config, visibleChannels, runOneRound]);

    const handleReset = useCallback(() => {
        gameActiveRef.current = false;
        if (pollRef.current) clearInterval(pollRef.current);
        setGamePhase('config');
        setCharX(50);
        setCharLevel(0);
        setLastDecision(null);
        setElapsed(0);
        setErrorMsg('');
    }, []);

    const handleLoadLast = () => {
        const saved = ConfigPersistence.load<any>(STORAGE_KEYS.QUESTIONNAIRE_MODE_CONFIG);
        if (saved?.config) setConfig(prev => ({ ...prev, ...saved.config }));
        if (saved?.visibleChannels) setVisibleChannels(saved.visibleChannels);
    };

    // ── Rendering helpers ─────────────────────────────────────────────────────
    // Map level index → Y% in the canvas (level 0 = bottom, last = top)
    const levelToY = (lvlIdx: number) => {
        return 92 - (lvlIdx / (totalLevels - 1)) * 82; // 10%–92% range from top
    };

    const corridorHeight = 9; // % height of each corridor band
    const passageWidth = PASSAGE_HALF * 2;

    return (
        <Layout fullWidth>
            <div style={{ height: 'calc(100vh - 5rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#060810' }}>

                {/* ══════════════════ MAZE ARENA ══════════════════ */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

                    {/* Starfield background */}
                    <canvas id="maze-bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }} />

                    {/* Ambient gradient */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,220,130,0.04)',
                        pointerEvents: 'none',
                    }} />

                    {/* ── SVG Maze ── */}
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    >
                        <defs>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <filter id="charGlow">
                                <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
                                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <linearGradient id="corridorGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(0,240,180,0.18)" />
                                <stop offset="100%" stopColor="rgba(0,240,180,0.18)" />
                            </linearGradient>
                            <linearGradient id="goalGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(255,215,0,0.3)" />
                                <stop offset="100%" stopColor="rgba(255,215,0,0.3)" />
                            </linearGradient>
                            <radialGradient id="charGrad" cx="35%" cy="30%">
                                <stop offset="0%" stopColor="#00c87a" />
                                <stop offset="100%" stopColor="#00c87a" />
                            </radialGradient>
                            <radialGradient id="charGradRecording" cx="35%" cy="30%">
                                <stop offset="0%" stopColor="#cc2222" />
                                <stop offset="100%" stopColor="#cc2222" />
                            </radialGradient>
                        </defs>

                        {/* Draw corridor floors + walls + passages */}
                        {MAZE_LEVELS.map((lvl, i) => {
                            const cy = levelToY(i);
                            const isGoal = i === MAZE_LEVELS.length - 1;
                            const isCurrentLevel = charLevel === i;

                            return (
                                <g key={i}>
                                    {/* Corridor fill */}
                                    <rect
                                        x={lvl.xStart} y={cy - corridorHeight / 2}
                                        width={lvl.xEnd - lvl.xStart} height={corridorHeight}
                                        fill={isGoal ? 'url(#goalGrad)' : isCurrentLevel ? 'url(#corridorGrad)' : 'rgba(0,200,140,0.06)'}
                                        rx="0.5"
                                        style={{ transition: 'fill 0.4s ease' }}
                                    />
                                    {/* Left wall */}
                                    <line x1={lvl.xStart} y1={cy - corridorHeight / 2} x2={lvl.xStart} y2={cy + corridorHeight / 2}
                                        stroke={isCurrentLevel ? 'rgba(0,255,180,0.7)' : 'rgba(0,200,140,0.3)'} strokeWidth="0.3"
                                        filter="url(#glow)" style={{ transition: 'stroke 0.4s ease' }}
                                    />
                                    {/* Right wall */}
                                    <line x1={lvl.xEnd} y1={cy - corridorHeight / 2} x2={lvl.xEnd} y2={cy + corridorHeight / 2}
                                        stroke={isCurrentLevel ? 'rgba(0,255,180,0.7)' : 'rgba(0,200,140,0.3)'} strokeWidth="0.3"
                                        filter="url(#glow)" style={{ transition: 'stroke 0.4s ease' }}
                                    />
                                    {/* Top floor */}
                                    {i < MAZE_LEVELS.length - 1 ? (
                                        <>
                                            {/* Left segment of top floor */}
                                            <line x1={lvl.xStart} y1={cy - corridorHeight / 2} x2={lvl.upTo - PASSAGE_HALF} y2={cy - corridorHeight / 2}
                                                stroke={isCurrentLevel ? 'rgba(0,255,180,0.7)' : 'rgba(0,200,140,0.3)'} strokeWidth="0.3"
                                                filter="url(#glow)"
                                            />
                                            {/* Right segment of top floor */}
                                            <line x1={lvl.upTo + PASSAGE_HALF} y1={cy - corridorHeight / 2} x2={lvl.xEnd} y2={cy - corridorHeight / 2}
                                                stroke={isCurrentLevel ? 'rgba(0,255,180,0.7)' : 'rgba(0,200,140,0.3)'} strokeWidth="0.3"
                                                filter="url(#glow)"
                                            />
                                            {/* Passage indicator glow */}
                                            <rect
                                                x={lvl.upTo - PASSAGE_HALF} y={cy - corridorHeight / 2 - 1.5}
                                                width={passageWidth} height={1.5}
                                                fill={isCurrentLevel ? 'rgba(0,255,180,0.4)' : 'rgba(0,200,140,0.15)'}
                                                rx="0.3"
                                                style={{ transition: 'fill 0.4s ease' }}
                                            />
                                            {/* "▲" arrows at passage */}
                                            <text
                                                x={lvl.upTo} y={cy - corridorHeight / 2 - 0.2}
                                                textAnchor="middle" fontSize="2"
                                                fill={isCurrentLevel ? 'rgba(0,255,200,0.9)' : 'rgba(0,200,140,0.4)'}
                                                style={{ transition: 'fill 0.4s ease', userSelect: 'none' }}
                                            >▲</text>
                                        </>
                                    ) : (
                                        /* Goal top floor – fully closed */
                                        <line x1={lvl.xStart} y1={cy - corridorHeight / 2} x2={lvl.xEnd} y2={cy - corridorHeight / 2}
                                            stroke="rgba(255,215,0,0.6)" strokeWidth="0.4" filter="url(#glow)"
                                        />
                                    )}
                                    {/* Bottom floor */}
                                    <line x1={lvl.xStart} y1={cy + corridorHeight / 2} x2={lvl.xEnd} y2={cy + corridorHeight / 2}
                                        stroke={isCurrentLevel ? 'rgba(0,255,180,0.7)' : 'rgba(0,200,140,0.3)'} strokeWidth="0.3"
                                        filter="url(#glow)"
                                    />

                                    {/* Level label */}
                                    <text x={lvl.xStart - 1} y={cy + 0.6}
                                        textAnchor="end" fontSize="1.8"
                                        fill={isGoal ? 'rgba(255,215,0,0.7)' : 'rgba(0,200,140,0.35)'}
                                        style={{ userSelect: 'none' }}
                                    >{isGoal ? '🏆' : i === 0 ? 'START' : `L${i}`}</text>
                                </g>
                            );
                        })}

                        {/* Vertical connectors between levels */}
                        {MAZE_LEVELS.slice(0, -1).map((lvl, i) => {
                            const cy = levelToY(i);
                            const nextCy = levelToY(i + 1);
                            return (
                                <rect key={`conn-${i}`}
                                    x={lvl.upTo - PASSAGE_HALF / 2} y={nextCy + corridorHeight / 2}
                                    width={PASSAGE_HALF} height={cy - corridorHeight / 2 - (nextCy + corridorHeight / 2)}
                                    fill="rgba(0,200,140,0.08)"
                                    stroke="rgba(0,200,140,0.2)" strokeWidth="0.15"
                                />
                            );
                        })}

                        {/* ── Character ── */}
                        <g style={{ transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
                            transform={`translate(${charX}, ${levelToY(charLevel)})`}>
                            {/* Glow ring when recording */}
                            {gamePhase === 'recording' && (
                                <>
                                    <circle cx="0" cy="0" r="4" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="0.4"
                                        style={{ animation: 'mazePing 1.2s ease-out infinite' }}
                                    />
                                    <circle cx="0" cy="0" r="5.5" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="0.4"
                                        style={{ animation: 'mazePing 1.8s ease-out infinite', animationDelay: '0.3s' }}
                                    />
                                </>
                            )}
                            {/* Body */}
                            <circle cx="0" cy="0" r="2.5"
                                fill={gamePhase === 'recording' ? 'url(#charGradRecording)' : 'url(#charGrad)'}
                                filter="url(#charGlow)"
                                style={{ transition: 'fill 0.3s ease' }}
                            />
                            {/* Highlight */}
                            <ellipse cx="-0.7" cy="-0.9" rx="0.8" ry="0.5" fill="rgba(255,255,255,0.4)" />
                        </g>

                        {/* Goal star */}
                        {gamePhase === 'won' && (
                            <text x={charX} y={levelToY(MAZE_LEVELS.length - 1)}
                                textAnchor="middle" dominantBaseline="middle" fontSize="5"
                                style={{ animation: 'mazeSpin 1s linear infinite' }}
                            >⭐</text>
                        )}
                    </svg>

                    {/* ── HUD overlays ── */}

                    {/* Top-left: progress */}
                    <div style={{
                        position: 'absolute', top: '12px', left: '16px',
                        display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 30,
                    }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(0,200,140,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                            Progress
                        </div>
                        <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '3px',
                                width: `${progressPct}%`,
                                background: '#00dc82',
                                transition: 'width 0.6s ease',
                                boxShadow: '0 0 8px rgba(0,220,130,0.5)',
                            }} />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(0,200,140,0.6)', fontFamily: 'monospace' }}>
                            Level {charLevel + 1} / {totalLevels}
                        </div>
                    </div>

                    {/* Top-right: recording countdown */}
                    {gamePhase === 'recording' && (
                        <div style={{
                            position: 'absolute', top: '12px', right: '16px', zIndex: 30,
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '0.78rem', fontWeight: 700 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'mazePulse 1s infinite' }} />
                                Recording…
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'white', fontWeight: 700 }}>
                                {elapsed.toFixed(1)}s
                                <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.75rem', fontWeight: 400 }}> / {config.recordingLength}s</span>
                            </div>
                            <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min((elapsed / config.recordingLength) * 100, 100)}%`,
                                    background: '#ef4444',
                                    transition: 'width 0.5s ease',
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Center bottom: last decision flash */}
                    {flashDir && (
                        <div style={{
                            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                            zIndex: 30, display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 24px', borderRadius: '12px',
                            background: flashDir === 'left' ? 'rgba(56,189,248,0.15)' : 'rgba(168,85,247,0.15)',
                            border: `1px solid ${flashDir === 'left' ? 'rgba(56,189,248,0.5)' : 'rgba(168,85,247,0.5)'}`,
                            color: flashDir === 'left' ? '#38bdf8' : '#a855f7',
                            fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.1em',
                            animation: 'mazeDecisionFade 0.7s ease forwards',
                        }}>
                            {flashDir === 'left' ? <><ChevronLeft size={18} /> LEFT — {config.leftFreq} Hz</> : <>RIGHT — {config.rightFreq} Hz <ChevronRight size={18} /></>}
                        </div>
                    )}

                    {/* ── Error overlay ── */}
                    {errorMsg && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 50,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.7)',
                        }}>
                            <div style={{ padding: '24px', borderRadius: '16px', background: '#110a0a', border: '1px solid rgba(239,68,68,0.4)', textAlign: 'center', maxWidth: '320px' }}>
                                <div style={{ fontSize: '1rem', color: '#f87171', fontWeight: 700, marginBottom: '12px' }}>⚠ Error</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(148,163,184,0.7)', marginBottom: '16px' }}>{errorMsg}</div>
                                <button onClick={handleReset} style={{ padding: '8px 20px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}>
                                    <RotateCcw size={14} style={{ display: 'inline', marginRight: '6px' }} />
                                    Reset
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Ready / Start overlay ── */}
                    {gamePhase === 'config' && !errorMsg && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 40,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(6,8,16,0.8)', backdropFilter: 'blur(4px)',
                        }}>
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
                                padding: '36px 48px', borderRadius: '20px',
                                background: 'rgba(0,200,130,0.04)', border: '1px solid rgba(0,200,130,0.2)',
                                boxShadow: '0 0 60px rgba(0,200,130,0.08)',
                            }}>
                                <div style={{ fontSize: '3rem' }}>🧩</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>EEG Maze</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(148,163,184,0.6)', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 }}>
                                    Think <span style={{ color: '#38bdf8', fontWeight: 700 }}>LEFT ({config.leftFreq} Hz)</span> or{' '}
                                    <span style={{ color: '#a855f7', fontWeight: 700 }}>RIGHT ({config.rightFreq} Hz)</span> to navigate the maze from bottom to top.
                                </div>
                                <button id="maze-start-btn" onClick={handleStart} style={{
                                    padding: '14px 36px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800,
                                    fontSize: '0.95rem', letterSpacing: '0.05em',
                                    background: '#00dc82',
                                    border: 'none', color: '#000',
                                    boxShadow: '0 0 30px rgba(0,220,130,0.35)',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(0,220,130,0.55)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(0,220,130,0.35)'; }}
                                >
                                    <Play size={18} /> Start Game
                                </button>
                                <div style={{ fontSize: '0.68rem', color: 'rgba(100,116,139,0.5)', textAlign: 'center' }}>
                                    Configure EEG parameters in the panel below
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── WIN overlay ── */}
                    {gamePhase === 'won' && (
                        <div style={{
                            position: 'absolute', inset: 0, zIndex: 50,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(6,8,16,0.85)', backdropFilter: 'blur(6px)',
                            animation: 'mazeWinIn 0.5s ease',
                        }}>
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px',
                                padding: '40px 56px', borderRadius: '24px',
                                background: 'rgba(255,215,0,0.08)',
                                border: '1px solid rgba(255,215,0,0.35)',
                                boxShadow: '0 0 80px rgba(255,200,0,0.15)',
                            }}>
                                <div style={{ fontSize: '4rem', animation: 'mazeBounce 0.6s ease infinite alternate' }}>🏆</div>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffd700', letterSpacing: '-0.02em', textShadow: '0 0 30px rgba(255,215,0,0.6)' }}>
                                    Congratulations!
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,215,0,0.65)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
                                    You navigated the maze from start to finish using your brain signals!
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button onClick={handleStart} style={{
                                        padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, fontSize: '0.875rem',
                                        background: '#ffd700',
                                        border: 'none', color: '#000',
                                        boxShadow: '0 0 24px rgba(255,200,0,0.4)',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                    }}>
                                        <Play size={15} /> Play Again
                                    </button>
                                    <button onClick={handleReset} style={{
                                        padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
                                        background: 'transparent', border: '1px solid rgba(255,215,0,0.3)', color: 'rgba(255,215,0,0.7)',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                    }}>
                                        <Settings size={15} /> Reconfigure
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CSS keyframes */}
                    <style>{`
                        @keyframes mazePing {
                            0% { transform: scale(1); opacity: 0.8; }
                            100% { transform: scale(2.2); opacity: 0; }
                        }
                        @keyframes mazePulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.3; }
                        }
                        @keyframes mazeDecisionFade {
                            0% { opacity: 1; transform: translateX(-50%) translateY(0); }
                            100% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
                        }
                        @keyframes mazeSpin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                        @keyframes mazeBounce {
                            from { transform: translateY(-4px); }
                            to { transform: translateY(4px); }
                        }
                        @keyframes mazeWinIn {
                            from { opacity: 0; backdrop-filter: blur(0); }
                            to { opacity: 1; backdrop-filter: blur(6px); }
                        }
                    `}</style>
                </div>

                {/* ══════════════════ CONFIG PANEL ══════════════════ */}
                <div style={{ background: '#0c0e18', borderTop: '1px solid rgba(0,200,140,0.15)', flexShrink: 0 }}>
                    {/* Collapse toggle */}
                    <button
                        onClick={() => setShowPanel(p => !p)}
                        style={{
                            width: '100%', padding: '6px', background: 'rgba(0,200,140,0.04)',
                            border: 'none', color: 'rgba(0,200,140,0.4)', cursor: 'pointer',
                            fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                    >
                        <Settings size={12} /> EEG Config {showPanel ? '▼' : '▲'}
                    </button>

                    {showPanel && (
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', padding: '10px 16px 14px', alignItems: 'flex-start', overflowX: 'auto' }}>

                            {/* Controls */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#00dc82', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Settings size={12} /> Maze Controls
                                </div>
                                {gamePhase === 'config' && (
                                    <>
                                        <button id="maze-panel-start" onClick={handleStart} className="btn btn-success btn-sm" style={{ width: '100%', background: '#00dc82', borderColor: 'transparent', color: '#000' }}>
                                            <Play size={13} /> Start Game
                                        </button>
                                        <button onClick={handleLoadLast} className="btn btn-outline btn-sm" style={{ width: '100%', borderColor: 'rgba(59,130,246,0.4)', color: '#60a5fa', fontSize: '0.7rem' }}>
                                            <RotateCcw size={12} /> Load Last Config
                                        </button>
                                    </>
                                )}
                                {(gamePhase === 'recording' || gamePhase === 'moving') && (
                                    <>
                                        <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, animation: 'mazePulse 1s infinite', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                                            {gamePhase === 'recording' ? 'Recording EEG…' : 'Moving…'}
                                        </div>
                                        <button onClick={handleReset} className="btn btn-outline btn-sm" style={{ width: '100%', borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', fontSize: '0.7rem' }}>
                                            <RotateCcw size={12} /> Stop / Reset
                                        </button>
                                    </>
                                )}
                                {gamePhase === 'won' && (
                                    <button onClick={handleReset} className="btn btn-outline btn-sm" style={{ width: '100%', borderColor: 'rgba(0,200,140,0.4)', color: '#00dc82', fontSize: '0.7rem' }}>
                                        <RotateCcw size={12} /> Reset
                                    </button>
                                )}
                            </div>

                            <div style={{ width: '1px', background: 'rgba(0,200,140,0.12)', alignSelf: 'stretch', margin: '2px 0' }} />

                            {/* Frequencies */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '190px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Target Frequencies</div>
                                {([
                                    { label: 'LEFT', key: 'leftFreq' as const, color: '#38bdf8' },
                                    { label: 'RIGHT', key: 'rightFreq' as const, color: '#a855f7' },
                                ]).map(({ label, key, color }) => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.05em', width: '36px' }}>{label}</label>
                                        <input
                                            type="number"
                                            value={config[key]}
                                            onChange={e => setConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                            step={0.5} min={1}
                                            disabled={gamePhase !== 'config'}
                                            style={{ width: '64px', background: '#0a0a0a', border: `1px solid ${gamePhase !== 'config' ? '#222' : '#333'}`, color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', height: '30px', outline: 'none' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: '#595959' }}>Hz</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ width: '1px', background: 'rgba(0,200,140,0.12)', alignSelf: 'stretch', margin: '2px 0' }} />

                            {/* EEG Params */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '210px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EEG Parameters</div>
                                {([
                                    { label: 'Rec. Length (s)', key: 'recordingLength' as const, step: 1, min: 1 },
                                    { label: 'Window (s)', key: 'windowSize' as const, step: 0.1, min: 0.5 },
                                    { label: 'Refresh (s)', key: 'refreshRate' as const, step: 0.05, min: 0.05 },
                                    { label: 'Harmonics', key: 'nHarmonics' as const, step: 1, min: 1 },
                                    { label: 'Move Delay (ms)', key: 'moveDelay' as const, step: 100, min: 200 },
                                ]).map(({ label, key, step, min }) => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{label}</label>
                                        <input
                                            type="number"
                                            value={config[key]}
                                            onChange={e => setConfig(prev => ({
                                                ...prev,
                                                [key]: (key === 'nHarmonics' || key === 'moveDelay') ? parseInt(e.target.value) || 1 : parseFloat(e.target.value),
                                            }))}
                                            step={step} min={min}
                                            disabled={gamePhase !== 'config'}
                                            style={{ width: '70px', background: '#0a0a0a', border: `1px solid ${gamePhase !== 'config' ? '#222' : '#333'}`, color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', height: '30px', outline: 'none' }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div style={{ width: '1px', background: 'rgba(0,200,140,0.12)', alignSelf: 'stretch', margin: '2px 0' }} />

                            {/* Channels */}
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
                        </div>
                    )}
                </div>

            </div>
        </Layout>
    );
};

export default MazeGame;
