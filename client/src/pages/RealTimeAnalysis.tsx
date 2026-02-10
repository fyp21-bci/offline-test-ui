import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { useStream } from '../hooks/useStream';
import ClassificationPanel from '../components/RealTime/ClassificationPanel';
import ServerSidePlot from '../components/RealTime/ServerSidePlot';
import HorizontalChannelControls from '../components/Visualizations/HorizontalChannelControls';
import TMSIConfig from '../components/ProcessorConfig/TMSIConfig';
import FBCCAConfig from '../components/ProcessorConfig/FBCCAConfig';

type ProcessorType = 'TMSI' | 'FBCCA';

function RealTimeAnalysis() {
    const { isConnected, error, latestData, startStreaming, stopStreaming } = useStream(false);

    // Local state to hold the latest of each type
    const [plots, setPlots] = useState<{ time_plot?: string; fft_plot?: string; classification_plot?: string } | null>(null);
    const [rawData, setRawData] = useState<Record<string, number[]> | null>(null);
    const [classificationResult, setClassificationResult] = useState<any>(null);
    const samplingRateRef = useRef(250);

    // Config State
    const [selectedProcessor, setSelectedProcessor] = useState<ProcessorType>('TMSI');

    // Store the last applied config to re-use when channels change
    const [lastAppliedConfig, setLastAppliedConfig] = useState<any>(null);

    // Channel Selection (Assume 8 channels for now or allow user to toggle)
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

    // Handle Config Application from Child Components
    const handleConfigApply = (config: any) => {
        setLastAppliedConfig(config);
        startStreamWithConfig(config);
    };

    const startStreamWithConfig = (config: any) => {
        const channels = getActiveChannelIndices();

        // Construct payload matching backend StreamStartRequest
        const payload: any = {
            window_size_seconds: config.window_sec || 5,
            channels: channels,
            processor_name: selectedProcessor === 'TMSI' ? 'TMSI Classifier' : 'FBCCA Classifier',
            processor_config: config // Pass the entire config object as processor_config
        };

        stopStreaming().then(() => {
            setTimeout(() => {
                startStreaming(payload);
            }, 300);
        });
    };

    // Restart stream if channels change (only if we have a config applied)
    useEffect(() => {
        if (isConnected && lastAppliedConfig) {
            // Debounce slightly to avoid rapid restarts
            const timer = setTimeout(() => {
                startStreamWithConfig(lastAppliedConfig);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [visibleChannels]); // Intentionally not including lastAppliedConfig to avoid loops if it changes separately

    // Handle incoming data
    useEffect(() => {
        if (!latestData) return;

        if (latestData.raw_data) {
            setRawData(latestData.raw_data);
            if (latestData.fs) {
                samplingRateRef.current = latestData.fs;
            }
        }

        if (latestData.plots) {
            setPlots(latestData.plots);
        }

        if (latestData.classification) {
            setClassificationResult(latestData.classification);
        }
    }, [latestData]);

    return (
        <Layout>
            <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 p-4">
                {/* Header / Status Bar */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isConnected ? 'bg-green-900/30 text-green-400 border border-green-800' :
                                error ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-slate-700 text-slate-400'
                                }`}>
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : error ? 'bg-red-400' : 'bg-slate-400'}`} />
                                {isConnected ? 'Live Stream Active' : error ? 'Connection Error' : 'Offline'}
                            </div>
                            {error && <span className="text-red-400 text-sm">{error}</span>}
                        </div>
                    </div>

                    {/* Config Area */}
                    <div className="flex flex-col gap-4 border-t border-slate-700 pt-4">
                        {/* Row 1: Global Settings (Channels & Processor Selector) */}
                        <div className="grid grid-cols-1 gap-4">
                            {/* Processor Selection & Channels contained in one flexible row if possible, or stacked */}
                            <div className="flex flex-col lg:flex-row gap-8 items-start">
                                {/* Processor Selection */}
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Algorithm</label>
                                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 w-fit">
                                        <button
                                            onClick={() => setSelectedProcessor('TMSI')}
                                            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${selectedProcessor === 'TMSI' ? 'bg-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                        >
                                            TMSI
                                        </button>
                                        <button
                                            onClick={() => setSelectedProcessor('FBCCA')}
                                            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${selectedProcessor === 'FBCCA' ? 'bg-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                        >
                                            FBCCA
                                        </button>
                                    </div>
                                </div>

                                {/* Channels */}
                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Active Channels</label>
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
                        </div>

                        {/* Row 2: Processor Specific Config */}
                        <div className="mt-2 text-white">
                            {selectedProcessor === 'TMSI' ? (
                                <TMSIConfig onConfigChange={handleConfigApply} />
                            ) : (
                                <FBCCAConfig onConfigChange={handleConfigApply} />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
                    {/* Main Chart Area (Left 3 cols) */}
                    <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
                        {/* Raw Signal Plot */}
                        <div className="flex-1 min-h-0">
                            <ServerSidePlot
                                title="Time Domain (Raw EEG)"
                                imageBase64={plots?.time_plot}
                            />
                        </div>

                        {/* FFT Plot (Bottom third) */}
                        <div className="h-[250px] min-h-[250px]">
                            <ServerSidePlot
                                title="Frequency Domain (FFT)"
                                imageBase64={plots?.fft_plot}
                            />
                        </div>
                    </div>

                    {/* Sidebar Stats (Right col) */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <ClassificationPanel result={classificationResult} />

                        {/* Classification Plot */}
                        <div className="h-[200px]">
                            <ServerSidePlot
                                title="Classification Window"
                                imageBase64={plots?.classification_plot}
                            />
                        </div>

                        {/* Stream Info */}
                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex-1">
                            <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">Stream Info</h3>
                            <div className="space-y-2 text-sm text-slate-500 font-mono">
                                <div className="flex justify-between">
                                    <span>Rate:</span>
                                    <span className="text-slate-300">{samplingRateRef.current} Hz</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Channels:</span>
                                    <span className="text-slate-300">{rawData ? Object.keys(rawData).length : 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Processor:</span>
                                    <span className="text-slate-300">{selectedProcessor}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default RealTimeAnalysis;
