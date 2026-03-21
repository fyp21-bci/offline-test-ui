import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { useStream } from '../hooks/useStream';
import ClassificationPanel from '../components/RealTime/ClassificationPanel';
import ServerSidePlot from '../components/RealTime/ServerSidePlot';
import HorizontalChannelControls from '../components/Visualizations/HorizontalChannelControls';
import TMSIConfig from '../components/ProcessorConfig/TMSIConfig';
import FBCCAConfig from '../components/ProcessorConfig/FBCCAConfig';
import { Play, Square, Check, Circle } from 'lucide-react';
import { ApiService } from '../api/client';

function RealTimeAnalysis() {
    const { isConnected, error, latestData, startStreaming, stopStreaming } = useStream(false);

    // Config State
    const [tmsiConfig, setTmsiConfig] = useState<any>(null);
    const [fbccaConfig, setFbccaConfig] = useState<any>(null);
    const [activeProcessors, setActiveProcessors] = useState<Record<string, boolean>>({
        'TMSI Classifier': true,
        'FBCCA Classifier': true
    });

    // Stream Settings
    const [refreshRate, setRefreshRate] = useState(1.0);
    const [classificationWindow, setClassificationWindow] = useState(1.0); // Default 1.0s
    const [isConfigExpanded, setIsConfigExpanded] = useState(true);

    // Results State
    const [plots, setPlots] = useState<any>(null);
    const [rawData, setRawData] = useState<Record<string, number[]> | null>(null);
    const [results, setResults] = useState<Record<string, any>>({});

    const samplingRateRef = useRef(250);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingIntervalRef = useRef<number | null>(null);

    // Channel Selection
    const AVAILABLE_CHANNELS = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8'];
    const [visibleChannels, setVisibleChannels] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        AVAILABLE_CHANNELS.forEach(ch => initial[ch] = true);
        return initial;
    });

    const getActiveChannelIndices = () => {
        return AVAILABLE_CHANNELS
            .map((ch, idx) => visibleChannels[ch] ? idx : -1)
            .filter(idx => idx !== -1);
    };

    // Initial default configs
    const DEFAULT_TMSI = {
        frequencies: [7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0],
        window_sec: 1.0,
        n_harmonics: 5,
        target_frequency: null
    };

    const DEFAULT_FBCCA = {
        frequencies: [7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0],
        window_sec: 1.0,
        n_harmonics: 5,
        n_subbands: 5,
        target_frequency: null
    };

    // On Mount, set defaults if not set (or could rely on child components to callback on init)
    // But child components call onConfigChange when user applies.
    // We should probably just auto-start with defaults if desired, or wait for user.
    // The previous code auto-started. Let's keep auto-start logic simple or manual.

    const handleStartStream = () => {
        const channels = getActiveChannelIndices();

        // Prepare list of active processors
        const processors = Object.keys(activeProcessors).filter(p => activeProcessors[p]);

        if (processors.length === 0) {
            alert("Please select at least one algorithm.");
            return;
        }

        // Config map
        const processor_configs: Record<string, any> = {};
        if (activeProcessors['TMSI Classifier']) processor_configs['TMSI Classifier'] = tmsiConfig || DEFAULT_TMSI;
        if (activeProcessors['FBCCA Classifier']) processor_configs['FBCCA Classifier'] = fbccaConfig || DEFAULT_FBCCA;

        const payload = {
            window_size_seconds: 3.0, // Buffer size
            update_interval_seconds: refreshRate,
            classification_window_size: classificationWindow,
            channels: channels,
            processors: processors,
            processor_configs: processor_configs
        };

        console.log("Starting stream Payload:", payload);

        if (isConnected) {
            stopStreaming().then(() => {
                setTimeout(() => startStreaming(payload), 500);
            });
        } else {
            startStreaming(payload);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop
            try {
                await ApiService.stopRecording();
                setIsRecording(false);
                if (recordingIntervalRef.current) {
                    clearInterval(recordingIntervalRef.current);
                    recordingIntervalRef.current = null;
                }
                setRecordingDuration(0);
            } catch (e) {
                console.error("Failed to stop recording", e);
            }
        } else {
            // Start
            // Start
            if (!isConnected) {
                alert("Please start the stream first before recording.");
                return;
            }

            const filename = prompt("Enter a name for this recording (optional):");
            if (filename === null) return; // User cancelled

            try {
                await ApiService.startRecording(filename || undefined);
                setIsRecording(true);
                setRecordingDuration(0);
                recordingIntervalRef.current = window.setInterval(() => {
                    setRecordingDuration(prev => prev + 1);
                }, 1000);
            } catch (e) {
                console.error("Failed to start recording", e);
                alert("Failed to start recording");
            }
        }
    };

    // Cleanup interval
    useEffect(() => {
        return () => {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, []);

    // Auto-start (optional - let's default to manual or auto with defaults to be safe)
    // Let's stick to manual for now to avoid complexity of waiting for config, 
    // OR just use the defaults defined above.

    /* 
    useEffect(() => {
        // Optional: Auto start with defaults?
        // handleStartStream(); 
        // Better to wait for user to click START given the complexity now.
    }, []);
    */

    // Updating Active Channels usually restarts stream in previous code
    // Let's make it explicit via "Update Stream" button if stream is running,
    // or just restart automatically.
    useEffect(() => {
        if (isConnected) {
            const timer = setTimeout(() => {
                handleStartStream();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [visibleChannels, activeProcessors]); // We don't auto-restart on config changes (user clicks Apply), but channel toggle is instant.

    // Handle Incoming Data
    useEffect(() => {
        if (!latestData) return;

        if (latestData.raw_data) {
            setRawData(latestData.raw_data);
            if (latestData.fs) samplingRateRef.current = latestData.fs;
        }

        if (latestData.plots) {
            setPlots(latestData.plots);
        }

        if (latestData.classification) {
            // It's now a dict of results
            const newResults: Record<string, any> = {};
            const rawMap = latestData.classification;

            Object.keys(rawMap).forEach(procName => {
                const rawResult = rawMap[procName];
                const pred = rawResult ? rawResult.best_frequency : null;

                // determine correctness
                let isCorrect: boolean | undefined = undefined;
                // find target for this processor
                let target = null;
                if (procName === 'TMSI Classifier') target = tmsiConfig?.target_frequency;
                if (procName === 'FBCCA Classifier') target = fbccaConfig?.target_frequency;

                if (target !== null && target !== undefined && pred !== undefined) {
                    if (Array.isArray(target)) {
                        isCorrect = target.some((t: number) => Math.abs(t - pred) < 0.1);
                    } else {
                        isCorrect = Math.abs(target - pred) < 0.1;
                    }
                }

                newResults[procName] = {
                    ...rawResult,
                    predicted_class: pred ? `${pred.toFixed(1)} Hz` : '--',
                    is_correct: isCorrect,
                    confidence: rawResult.confidence
                };
            });
            setResults(newResults);
        }
    }, [latestData]); // , tmsiConfig, fbccaConfig -> triggers re-calc of correctness if config changes? 
    // But tmsiConfig updates only on Apply. Good.

    return (
        <Layout>
            <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 p-4 overflow-hidden">
                {/* Header / Config Bar */}
                <div className={`bg-bg-tertiary rounded-lg border border-border-color flex flex-col transition-all duration-300 ${isConfigExpanded ? 'max-h-[600px] p-4' : 'max-h-[70px] p-2'}`}>

                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                                className="text-slate-400 hover:text-white"
                            >
                                {isConfigExpanded ? '▼' : '▶'}
                            </button>

                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isConnected ? 'bg-green-900/30 text-green-400 border border-green-800' :
                                error ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-slate-700 text-slate-400'
                                }`}>
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : error ? 'bg-red-400' : 'bg-slate-400'}`} />
                                {isConnected ? 'Live Stream Active' : error ? 'Connection Error' : 'Offline'}
                            </div>

                            {!isConnected ? (
                                <button
                                    onClick={handleStartStream}
                                    style={{
                                        color: '#00CC96',
                                        backgroundColor: '#00CC9620',
                                        borderColor: '#00CC96',
                                        boxShadow: '0 0 10px #00CC9640'
                                    }}
                                    className="px-5 py-3 flex items-center gap-2 transition-all duration-200 uppercase tracking-widest font-bold border-2 rounded-lg hover:bg-slate-800 text-sm"
                                >
                                    <Play size={16} />
                                    <span>Start Stream</span>
                                </button>
                            ) : (
                                <button
                                    onClick={stopStreaming}
                                    style={{
                                        color: '#EF553B',
                                        backgroundColor: '#EF553B20',
                                        borderColor: '#EF553B',
                                        boxShadow: '0 0 10px #EF553B40'
                                    }}
                                    className="px-5 py-3 flex items-center gap-2 transition-all duration-200 uppercase tracking-widest font-bold border-2 rounded-lg hover:bg-slate-800 text-sm"
                                >
                                    <Square size={16} fill="currentColor" />
                                    <span>Stop Stream</span>
                                </button>
                            )}

                            {/* Record Button */}
                            <button
                                onClick={toggleRecording}
                                disabled={!isConnected && !isRecording}
                                style={isRecording ? {
                                    color: '#EF553B',
                                    backgroundColor: '#EF553B20',
                                    borderColor: '#EF553B',
                                    boxShadow: '0 0 10px #EF553B40'
                                } : {
                                    color: isConnected ? '#ffffff' : '#555',
                                    borderColor: isConnected ? '#ffffff50' : '#333',
                                }}
                                className={`px-5 py-3 flex items-center gap-2 transition-all duration-200 uppercase tracking-widest font-bold border-2 rounded-lg text-sm ${!isConnected && !isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                            >
                                {isRecording ? <Square size={16} fill="currentColor" /> : <Circle size={16} fill="currentColor" className="text-red-500" />}
                                <span>{isRecording ? formatDuration(recordingDuration) : 'Record'}</span>
                            </button>
                        </div>

                        {/* Compact Status when collapsed */}
                        {!isConfigExpanded && isConnected && (
                            <div className="flex gap-4 text-xs text-slate-400">
                                <span>Refresh: {refreshRate}s</span>
                                <span>Window: {classificationWindow}s</span>
                                <span>Analyzers: {Object.keys(activeProcessors).filter(k => activeProcessors[k]).length}</span>
                            </div>
                        )}
                    </div>

                    {/* Scrollable Config Content */}
                    <div className={`flex flex-col gap-6 overflow-y-auto ${!isConfigExpanded && 'hidden'}`}>

                        {/* Global Settings Row */}
                        <div className="flex flex-col lg:flex-row gap-6 p-4 bg-bg-hover rounded-lg border border-border-light">

                            {/* Refresh Rate */}
                            <div className="min-w-[150px]">
                                <label className="text-xs font-bold text-tertiary uppercase block mb-2 tracking-wide">Refresh Rate (s)</label>
                                <input
                                    type="number"
                                    value={refreshRate}
                                    onChange={(e) => setRefreshRate(parseFloat(e.target.value) || 1.0)}
                                    step="0.1"
                                    min="0.1"
                                    max="5.0"
                                    className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-2 text-primary text-sm focus:border-accent outline-none transition-colors"
                                />
                            </div>

                            {/* Classification Window Size */}
                            <div className="min-w-[150px]">
                                <label className="text-xs font-bold text-tertiary uppercase block mb-2 tracking-wide">Window Size (s)</label>
                                <input
                                    type="number"
                                    value={classificationWindow}
                                    onChange={(e) => setClassificationWindow(parseFloat(e.target.value) || 1.0)}
                                    step="0.1"
                                    min="0.1"
                                    max="5.0"
                                    className="w-full bg-bg-tertiary border border-border-color rounded px-2 py-2 text-primary text-sm focus:border-accent outline-none transition-colors"
                                />
                            </div>

                            {/* Active Processors Toggle */}
                            <div className="min-w-[200px]">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Active Classifiers</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setActiveProcessors(prev => ({ ...prev, 'TMSI Classifier': !prev['TMSI Classifier'] }))}
                                        style={activeProcessors['TMSI Classifier'] ? {
                                            backgroundColor: '#AB63FA20', // purple
                                            borderColor: '#AB63FA',
                                            color: '#AB63FA',
                                            boxShadow: '0 0 10px #AB63FA40'
                                        } : {
                                            color: '#AB63FA',
                                            borderColor: '#AB63FA40'
                                        }}
                                        className="btn btn-outline text-sm px-5 py-3 flex items-center gap-2 transition-all duration-200 uppercase tracking-widest font-bold border-2 rounded-lg hover:bg-slate-800"
                                    >
                                        <span>TMSI</span>
                                        {activeProcessors['TMSI Classifier'] ? <Check size={16} strokeWidth={3} /> : <div className="w-3 h-3 rounded-full bg-current opacity-40" />}
                                    </button>

                                    <button
                                        onClick={() => setActiveProcessors(prev => ({ ...prev, 'FBCCA Classifier': !prev['FBCCA Classifier'] }))}
                                        style={activeProcessors['FBCCA Classifier'] ? {
                                            backgroundColor: '#19D3F320', // teal
                                            borderColor: '#19D3F3',
                                            color: '#19D3F3',
                                            boxShadow: '0 0 10px #19D3F340'
                                        } : {
                                            color: '#19D3F3',
                                            borderColor: '#19D3F340'
                                        }}
                                        className="btn btn-outline text-sm px-5 py-3 flex items-center gap-2 transition-all duration-200 uppercase tracking-widest font-bold border-2 rounded-lg hover:bg-slate-800"
                                    >
                                        <span>FBCCA</span>
                                        {activeProcessors['FBCCA Classifier'] ? <Check size={16} strokeWidth={3} /> : <div className="w-3 h-3 rounded-full bg-current opacity-40" />}
                                    </button>
                                </div>
                            </div>

                            {/* Channels */}
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Active Channels</label>
                                <HorizontalChannelControls
                                    channels={AVAILABLE_CHANNELS}
                                    visible={visibleChannels}
                                    onToggle={(ch) => setVisibleChannels(prev => ({ ...prev, [ch]: !prev[ch] }))}
                                    onToggleAll={(show) => {
                                        const next = { ...visibleChannels };
                                        AVAILABLE_CHANNELS.forEach(ch => next[ch] = show);
                                        setVisibleChannels(next);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Algorithm Configs Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {activeProcessors['TMSI Classifier'] && (
                                <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-2">
                                    <TMSIConfig onConfigChange={(c) => setTmsiConfig(c)} />
                                </div>
                            )}

                            {activeProcessors['FBCCA Classifier'] && (
                                <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-2">
                                    <FBCCAConfig onConfigChange={(c) => setFbccaConfig(c)} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">

                    {/* Left Column: Signal Plots */}
                    <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto">
                        <div className="h-[250px] shrink-0">
                            <ServerSidePlot
                                title="Time Domain (Raw EEG)"
                                imageBase64={plots?.time_plot}
                            />
                        </div>
                        <div className="h-[250px] shrink-0">
                            <ServerSidePlot
                                title="Frequency Domain (FFT)"
                                imageBase64={plots?.fft_plot}
                            />
                        </div>
                    </div>

                    {/* Right Column: Classification Results */}
                    <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto">

                        {/* TMSI Results */}
                        {activeProcessors['TMSI Classifier'] && (
                            <div className="flex gap-4 h-[300px]">
                                <div className="w-[300px] shrink-0">
                                    <ClassificationPanel result={results['TMSI Classifier']} title="TMSI Result" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <ServerSidePlot
                                        title="TMSI Analysis Window"
                                        imageBase64={plots?.['classification_plot_TMSI Classifier']}
                                    />
                                </div>
                            </div>
                        )}

                        {/* FBCCA Results */}
                        {activeProcessors['FBCCA Classifier'] && (
                            <div className="flex gap-4 h-[300px]">
                                <div className="w-[300px] shrink-0">
                                    <ClassificationPanel result={results['FBCCA Classifier']} title="FBCCA Result" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <ServerSidePlot
                                        title="FBCCA Analysis Window"
                                        imageBase64={plots?.['classification_plot_FBCCA Classifier']}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Stream Stats (Shared) */}
                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 mt-auto">
                            <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">System Status</h3>
                            <div className="grid grid-cols-3 gap-4 text-sm text-slate-500 font-mono">
                                <div>
                                    <span className="block text-xs">Sampling Rate</span>
                                    <span className="text-slate-300">{samplingRateRef.current} Hz</span>
                                </div>
                                <div>
                                    <span className="block text-xs">Channels</span>
                                    <span className="text-slate-300">{rawData ? Object.keys(rawData).length : 0}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Layout>
    );

}

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default RealTimeAnalysis;
