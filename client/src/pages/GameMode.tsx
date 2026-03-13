
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useStream } from '../hooks/useStream';
import { ApiService } from '../api/client';
import BlinkingStimulus from '../components/Game/BlinkingStimulus';
import { Play, Square, Settings, Cpu } from 'lucide-react';
import HorizontalChannelControls from '../components/Visualizations/HorizontalChannelControls';

const GameMode = () => {
    const { isConnected, latestData, connect, disconnect } = useStream(false);

    // Config
    const [config, setConfig] = useState({
        windowLength: 2.0,
        refreshRate: 0.1,
        algorithms: ['TMSI Classifier'],
        // Default target frequencies for the balls
        frequencies: [10.0, 12.0]
    });

    const [visibleChannels, setVisibleChannels] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'].forEach(ch => initial[ch] = true);
        return initial;
    });

    // Prediction State
    const [prediction, setPrediction] = useState<{
        algorithm: string;
        frequency: number;
        confidence: number;
    } | null>(null);

    // Handle Stream Data
    useEffect(() => {
        if (!latestData || !latestData.classification) return;

        // Check TMSI result
        const tmsi = latestData.classification['TMSI Classifier'];
        if (tmsi && tmsi.best_frequency) {
            setPrediction({
                algorithm: 'TMSI Classifier',
                frequency: tmsi.best_frequency,
                confidence: tmsi.confidence || 0
            });
        }
    }, [latestData]);

    const handleStart = async () => {
        const activeChannels = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8']
            .map((ch, idx) => visibleChannels[ch] ? idx : -1)
            .filter(idx => idx !== -1);

        try {
            await ApiService.startGameStream({
                window_length: config.windowLength,
                refresh_rate: config.refreshRate,
                algorithms: config.algorithms,
                candidate_frequencies: config.frequencies,
                channels: activeChannels
            });
            connect(); // Ensure websocket is connected
        } catch (e) {
            console.error("Failed to start game stream", e);
            alert("Failed to start game stream");
        }
    };

    const handleStop = async () => {
        try {
            await ApiService.stopStream();
            disconnect();
            setPrediction(null);
        } catch (e) {
            console.error("Failed to stop stream", e);
        }
    };

    const handleFreqChange = (idx: number, val: string) => {
        const newFreqs = [...config.frequencies];
        newFreqs[idx] = parseFloat(val) || 0;
        setConfig(prev => ({ ...prev, frequencies: newFreqs }));
    };

    return (
        <Layout fullWidth>
            <div className="h-[calc(100vh-5rem)] flex flex-col overflow-hidden">

                {/* Game Area */}
                <div className="flex-1 bg-black relative flex flex-col overflow-hidden">

                    {/* Status Overlay */}
                    <div className="absolute top-4 right-4 bg-slate-900/80 p-3 rounded border border-slate-700 backdrop-blur-sm z-10 w-auto">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">Prediction</div>
                        {prediction ? (
                            <div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    {prediction.frequency.toFixed(1)} <span className="text-sm text-slate-400">Hz</span>
                                </div>
                                <div className="text-xs text-green-400">
                                    Confidence: {(prediction.confidence * 100).toFixed(1)}%
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic">Waiting...</div>
                        )}
                    </div>

                    {/* Blinking Stimuli */}
                    <div className="w-full h-full flex justify-between items-center px-4">
                        {config.frequencies.map((freq, idx) => {
                            // Determine if this frequency is currently predicted
                            const isPredicted = prediction ? Math.abs(prediction.frequency - freq) < 0.2 : false;

                            return (
                                <BlinkingStimulus
                                    key={`${freq}-${idx}`}
                                    frequency={freq}
                                    isSelected={isPredicted}
                                    color="white"
                                    size={350}
                                />
                            );
                        })}
                    </div>

                    {!isConnected && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                            <div className="text-center text-slate-400">
                                <Cpu size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg">Game Mode Disconnected</p>
                                <p className="text-sm opacity-60">Configure settings and click start to begin</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Configuration Panel (Bottom) */}
                <div className="w-full h-auto bg-slate-900 border-t border-slate-800 p-4 flex flex-row gap-8 overflow-x-auto shrink-0 items-start">

                    {/* Control Group */}
                    <div className="flex flex-col gap-3 min-w-[160px]">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Settings size={18} />
                            Game Config
                        </h2>

                        {/* Control Buttons */}
                        <div className="flex gap-2">
                            {!isConnected ? (
                                <button
                                    onClick={handleStart}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded flex items-center justify-center gap-2 font-bold text-sm transition-colors"
                                >
                                    <Play size={16} /> Start
                                </button>
                            ) : (
                                <button
                                    onClick={handleStop}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded flex items-center justify-center gap-2 font-bold text-sm transition-colors"
                                >
                                    <Square size={16} /> Stop
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="w-px bg-slate-700 self-stretch my-1" />

                    {/* Stream Params */}
                    <div className="flex flex-col gap-3 min-w-[140px]">
                        <h3 className="text-[10px] font-bold text-white uppercase opacity-70">Parameters</h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] uppercase text-slate-400 font-bold whitespace-nowrap">Window (s)</label>
                                <input
                                    type="number"
                                    value={config.windowLength}
                                    onChange={e => setConfig({ ...config, windowLength: parseFloat(e.target.value) })}
                                    step="0.1"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs text-center"
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] uppercase text-slate-400 font-bold whitespace-nowrap">Refresh (s)</label>
                                <input
                                    type="number"
                                    value={config.refreshRate}
                                    onChange={e => setConfig({ ...config, refreshRate: parseFloat(e.target.value) })}
                                    step="0.05"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-px bg-slate-700 self-stretch my-1" />

                    {/* Frequencies */}
                    <div className="flex flex-col gap-3 min-w-[180px]">
                        <h3 className="text-[10px] font-bold text-white uppercase opacity-70">Frequencies</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {config.frequencies.map((freq, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <div className="w-2 h-2 rounded-full bg-white border border-slate-600"></div>
                                    <input
                                        type="number"
                                        value={freq}
                                        onChange={e => handleFreqChange(idx, e.target.value)}
                                        className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                    />
                                    <span className="text-slate-400 text-[10px]">Hz</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfig(prev => ({ ...prev, frequencies: [...prev.frequencies, 10.0] }))}
                                className="text-[10px] text-sky-400 hover:text-sky-300"
                            >
                                + Add
                            </button>
                            {config.frequencies.length > 2 && (
                                <button
                                    onClick={() => setConfig(prev => ({ ...prev, frequencies: prev.frequencies.slice(0, -1) }))}
                                    className="text-[10px] text-red-400 hover:text-red-300"
                                >
                                    - Remove
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="w-px bg-slate-700 self-stretch my-1" />

                    {/* Channels */}
                    <div className="flex flex-col gap-3 flex-1 min-w-[300px]">
                        <h3 className="text-[10px] font-bold text-white uppercase opacity-70">Active Channels</h3>
                        <HorizontalChannelControls
                            channels={['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8']}
                            visible={visibleChannels}
                            onToggle={(ch) => setVisibleChannels(prev => ({ ...prev, [ch]: !prev[ch] }))}
                            onToggleAll={(show) => {
                                const next = { ...visibleChannels };
                                ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'].forEach(ch => next[ch] = show);
                                setVisibleChannels(next);
                            }}
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default GameMode;
