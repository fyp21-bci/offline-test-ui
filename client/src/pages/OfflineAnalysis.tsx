import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import DatasetSelector from '../components/DatasetSelector';
import AlgorithmChain from '../components/ProcessorConfig/AlgorithmChain';
import FBCCAConfig from '../components/ProcessorConfig/FBCCAConfig';
import TimeSeriesChart from '../components/Visualizations/TimeSeriesChart';
import HorizontalChannelControls from '../components/Visualizations/HorizontalChannelControls';
import PlotControls from '../components/Visualizations/PlotControls';
import HighResPlot from '../components/Visualizations/HighResPlot';
import FFTPlot from '../components/Visualizations/FFTPlot';
import TMSIPlot from '../components/Visualizations/TMSIPlot';
import FBCCAPlot from '../components/Visualizations/FBCCAPlot';
import { ApiService, type AnalysisResult } from '../api/client';

function OfflineAnalysis() {
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
    const [analysisResults, setAnalysisResults] = useState<AnalysisResult[] | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rawSignalData, setRawSignalData] = useState<any[]>([]); // To store TimeSeries data
    const [targetFrequency, setTargetFrequency] = useState<number>(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Visibility State
    const [visibleChannels, setVisibleChannels] = useState<Record<string, boolean>>({});
    const [availableChannels, setAvailableChannels] = useState<string[]>([]);
    const [showOverlay, setShowOverlay] = useState(true);

    // Separate states for different range controls:
    // - xAxisRange: For Quick Zoom buttons
    // - userSelectedRange: For rangeslider selections (updates high-res plot only)
    const [xAxisRange, setXAxisRange] = useState<[number, number] | null>(null);
    const [userSelectedRange, setUserSelectedRange] = useState<[number, number] | null>(null);
    const [samplingRate, setSamplingRate] = useState(250);

    // Classifier Configuration State (Shared for TMSI and FBCCA)
    const [classifierConfig, setClassifierConfig] = useState({
        frequencies: [8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0],
        window_sec: 1.0,
        n_harmonics: 5,
        n_subbands: 5,
        target_frequency: null as number | number[] | null
    });

    // Derived state: Get selected channel indices for plot image
    const selectedChannelIndices = availableChannels
        .map((ch, idx) => ({ ch, idx }))
        .filter(({ ch }) => visibleChannels[ch])
        .map(({ idx }) => idx);

    // Memoized time window - prioritizes userSelectedRange (rangeslider), falls back to xAxisRange (quick zoom)
    const timeWindow = useMemo(() => {
        const activeRange = userSelectedRange || xAxisRange;
        const rangeSource = userSelectedRange ? 'rangeslider' : (xAxisRange ? 'quick-zoom' : 'none');

        if (!activeRange) {
            console.log('⏱️ App: timeWindow set to null (full range)');
            return null;
        }
        const window = {
            start: activeRange[0] / samplingRate,
            end: activeRange[1] / samplingRate
        };
        console.log('⏱️ App: timeWindow updated to:', window, 'source:', rangeSource, 'samples:', activeRange);
        return window;
    }, [userSelectedRange, xAxisRange, samplingRate]);

    // Fetch data when dataset changes
    useEffect(() => {
        if (selectedDatasetId) {
            // Reset state
            setRawSignalData([]);
            setAnalysisResults(null);
            setAvailableChannels([]);
            setXAxisRange(null); // Reset to full range

            ApiService.getDatasetData(selectedDatasetId)
                .then(res => {
                    const n_samples = res.data.length > 0 ? res.data[0].length : 0;
                    const formatted = [];

                    // Identify channels
                    const channels = res.channels && res.channels.length > 0
                        ? res.channels
                        : res.data.map((_, i) => `Ch${i + 1}`);

                    setAvailableChannels(channels);

                    // Initial visibility: All true
                    const initialVis: Record<string, boolean> = {};
                    channels.forEach(ch => initialVis[ch] = true);
                    setVisibleChannels(initialVis);

                    // Assuming res.data is number[][] (channels x samples)
                    for (let i = 0; i < n_samples; i++) {
                        const point: any = { time: i }; // Use index as time
                        res.data.forEach((channelData, chIdx) => {
                            const chName = channels[chIdx];
                            point[chName] = channelData[i];
                        });
                        formatted.push(point);
                    }

                    setRawSignalData(formatted);
                    setSamplingRate(res.fs);
                })
                .catch(err => {
                    console.error("Failed to load signal data", err);
                });
        }
    }, [selectedDatasetId]);


    const handleRunAnalysis = async (chain: any[]) => {
        if (!selectedDatasetId || chain.length === 0) return;

        setIsProcessing(true);
        setAnalysisResults(null);

        try {
            // Execute chain.
            const lastNode = chain[chain.length - 1];
            const result = await ApiService.runAnalysis(selectedDatasetId, lastNode.processor.name, lastNode.config);

            // Determine Result Type
            if (result.type === 'classification' || result.data.results) {
                if (Array.isArray(result.data.results)) {
                    setAnalysisResults(result.data.results);
                } else {
                    setAnalysisResults([result]);
                }
            } else if (result.type === 'spectrum') {
                setAnalysisResults([result]);
            }

        } catch (err) {
            console.error("Analysis failed", err);
            alert("Analysis failed. " + (err as any).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleWindowClick = (_res: AnalysisResult, index: number) => {
        setSelectedIndex(index);
    };

    const handleZoomPreset = (seconds: number | null) => {
        console.log('🔍 App: handleZoomPreset called with seconds:', seconds);
        if (seconds === null) {
            console.log('🔍 App: Resetting to full view');
            setXAxisRange(null);
            setUserSelectedRange(null); // Clear rangeslider selection
        } else {
            const maxSamples = seconds * samplingRate;
            const newRange: [number, number] = [0, Math.min(maxSamples, rawSignalData.length)];
            console.log('🔍 App: Setting xAxisRange to:', newRange);
            setXAxisRange(newRange);
            setUserSelectedRange(null); // Clear rangeslider selection when using quick zoom
        }
    };

    // Handle rangeslider changes - updates high-res plot but NOT the TimeSeriesChart data
    const handleRangeChange = (range: [number, number] | null) => {
        console.log('🔄 App: handleRangeChange called with:', range);
        // CRITICAL: This only updates userSelectedRange for the high-res plot
        // We NEVER filter rawSignalData - TimeSeriesChart always gets full dataset
        setUserSelectedRange(range);
        console.log('🔄 App: userSelectedRange state updated for high-res plot');
    };

    const toggleChannel = (channel: string) => {
        setVisibleChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
    };

    const toggleAllChannels = (show: boolean) => {
        const next = { ...visibleChannels };
        availableChannels.forEach(ch => next[ch] = show);
        setVisibleChannels(next);
    };

    return (
        <Layout>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">

                {/* Sidebar: Data & Params */}
                <div className="lg:col-span-1 flex flex-col gap-6 overflow-hidden">
                    <div className="flex-1 flex flex-col gap-4 min-h-[200px]">
                        <DatasetSelector
                            selectedId={selectedDatasetId}
                            onSelect={setSelectedDatasetId}
                        />

                        {/* Channel Controls - Moved to top of chart */}


                        {/* Overlay Toggle */}
                        {availableChannels.length > 0 && (
                            <div className="card p-4 flex items-center justify-between">
                                <span className="text-sm font-semibold text-secondary uppercase tracking-wide">Analysis Overlay</span>
                                <button
                                    role="switch"
                                    aria-checked={showOverlay}
                                    onClick={() => setShowOverlay(!showOverlay)}
                                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-primary ${showOverlay ? 'bg-accent shadow-lg' : 'bg-bg-tertiary'
                                        }`}
                                >
                                    <span
                                        className={`${showOverlay ? 'translate-x-7' : 'translate-x-1'
                                            } inline-block h-6 w-6 transform rounded-full bg-primary transition-transform shadow-md`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <label className="text-sm font-semibold text-secondary uppercase tracking-wide mb-3 block">Expected Target (Hz)</label>
                        <input
                            type="number"
                            value={targetFrequency}
                            onChange={(e) => setTargetFrequency(Number(e.target.value))}
                            className="w-full text-lg bg-bg-tertiary border-border-color focus:border-accent h-12 rounded-lg"
                            placeholder="e.g., 10"
                        />
                        <p className="text-xs text-tertiary mt-3 font-medium">
                            Used to color-code classification accuracy in the time series view.
                        </p>
                    </div>

                    {/* Classifier Configuration (Replaces TMSI Config) */}
                    <FBCCAConfig
                        title="Classifier Configuration"
                        onConfigChange={setClassifierConfig}
                    />
                </div>

                {/* Main Content: Pipeline & Viz */}
                <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden h-full">

                    {/* Top: Algorithm Builder */}
                    <div className="h-[350px] min-h-[350px]">
                        <AlgorithmChain onRun={handleRunAnalysis} isProcessing={isProcessing} />
                    </div>

                    {/* Bottom: Visualization Dashboard */}
                    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                        {/* Time Series Visualization - Full Width */}
                        <div className="flex-1 flex flex-col gap-4">
                            {/* Plot Controls */}
                            {rawSignalData.length > 0 && (
                                <PlotControls
                                    onZoomPreset={handleZoomPreset}
                                    dataLength={rawSignalData.length}
                                    samplingRate={samplingRate}
                                />
                            )}

                            {/* Channel Selection */}
                            {availableChannels.length > 0 && (
                                <div className="px-1">
                                    <HorizontalChannelControls
                                        channels={availableChannels}
                                        visible={visibleChannels}
                                        onToggle={toggleChannel}
                                        onToggleAll={toggleAllChannels}
                                    />
                                </div>
                            )}

                            {/* Plotly Interactive Chart */}
                            <div className="card flex flex-col min-h-0">
                                <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-wide">Interactive View (Plotly)</h3>
                                <div className="flex-1 min-h-0 overflow-auto">
                                    {rawSignalData.length > 0 ? (
                                        <TimeSeriesChart
                                            data={rawSignalData}
                                            datasetId={selectedDatasetId}
                                            results={analysisResults || []}
                                            targetFrequency={targetFrequency}
                                            onWindowClick={(res) => {
                                                const idx = analysisResults?.indexOf(res) ?? 0;
                                                handleWindowClick(res, idx);
                                            }}
                                            selectedWindowIndex={selectedIndex}
                                            visibleChannels={visibleChannels}
                                            showOverlay={showOverlay}
                                            onRangeChange={handleRangeChange}
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-600 border border-dashed border-gray-800 rounded">
                                            No signal data. Select a dataset to visualize.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* High-Resolution Plot (Below, Centered) */}
                            <div className="flex justify-center w-full">
                                <div className="w-full">
                                    <HighResPlot
                                        datasetId={selectedDatasetId}
                                        selectedChannels={selectedChannelIndices}
                                        timeWindow={timeWindow}
                                        samplingRate={samplingRate}
                                        dataLength={rawSignalData.length}
                                    />
                                </div>
                            </div>

                            {/* FFT Plot (Below High-Res, Centered) */}
                            <div className="flex justify-center w-full">
                                <div className="w-full">
                                    <FFTPlot
                                        datasetId={selectedDatasetId}
                                        selectedChannels={selectedChannelIndices}
                                        timeWindow={timeWindow}
                                        samplingRate={samplingRate}
                                        dataLength={rawSignalData.length}
                                    />
                                </div>
                            </div>

                            {/* TMSI Classification Plot */}
                            <div className="flex justify-center w-full">
                                <div className="w-full">
                                    <TMSIPlot
                                        datasetId={selectedDatasetId}
                                        selectedChannels={selectedChannelIndices}
                                        timeWindow={timeWindow}
                                        samplingRate={samplingRate}
                                        dataLength={rawSignalData.length}
                                        tmsiConfig={classifierConfig}
                                        targetFrequency={classifierConfig.target_frequency || undefined}
                                    />
                                </div>
                            </div>

                            {/* FBCCA Classification Plot (Below TMSI) */}
                            <div className="flex justify-center w-full pb-8">
                                <div className="w-full">
                                    <FBCCAPlot
                                        datasetId={selectedDatasetId}
                                        selectedChannels={selectedChannelIndices}
                                        timeWindow={timeWindow}
                                        samplingRate={samplingRate}
                                        dataLength={rawSignalData.length}
                                        fbccaConfig={classifierConfig}
                                        targetFrequency={classifierConfig.target_frequency || undefined}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </Layout>
    );
}

export default OfflineAnalysis;
