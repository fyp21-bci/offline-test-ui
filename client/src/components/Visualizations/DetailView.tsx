import React, { useMemo, useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { type AnalysisResult, ApiService } from '../../api/client';

interface DetailViewProps {
    result: AnalysisResult | null;
    datasetId: string | null;
    selectedChannels: number[]; // Channel indices
    timeWindow: { start: number; end: number } | null; // Time in seconds
    samplingRate: number;
    dataLength: number; // Total number of samples
}

const DetailView: React.FC<DetailViewProps> = ({
    result,
    datasetId,
    selectedChannels,
    timeWindow,
    samplingRate,
    dataLength
}) => {
    // State for plot image
    const [plotImageUrl, setPlotImageUrl] = useState<string | null>(null);
    const [isLoadingPlot, setIsLoadingPlot] = useState(false);
    const [plotError, setPlotError] = useState<string | null>(null);

    // Fetch plot image when parameters change
    useEffect(() => {
        // Cleanup previous image URL to prevent memory leaks
        return () => {
            if (plotImageUrl) {
                URL.revokeObjectURL(plotImageUrl);
            }
        };
    }, [plotImageUrl]);

    // Fetch plot when dataset, channels, or time window changes
    useEffect(() => {
        const fetchPlot = async () => {
            if (!datasetId || selectedChannels.length === 0) {
                setPlotImageUrl(null);
                return;
            }

            // Calculate time window: use provided window or full range
            const startTime = timeWindow ? timeWindow.start : 0;
            const endTime = timeWindow ? timeWindow.end : (dataLength / samplingRate);

            setIsLoadingPlot(true);
            setPlotError(null);

            try {
                const imageUrl = await ApiService.getPlotImage(
                    datasetId,
                    selectedChannels,
                    startTime,
                    endTime
                );
                setPlotImageUrl(imageUrl);
            } catch (error: any) {
                console.error('Failed to fetch plot image:', error);
                setPlotError(error.response?.data?.detail || 'Failed to load plot image');
            } finally {
                setIsLoadingPlot(false);
            }
        };

        fetchPlot();
    }, [datasetId, selectedChannels, timeWindow, dataLength, samplingRate]);

    // Parse Spectrum Data
    const spectrumData = useMemo(() => {
        if (!result || !result.data.frequencies || !result.data.magnitudes) return null;
        return {
            x: result.data.frequencies,
            y: result.data.magnitudes,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#a855f7', width: 2 },
            name: 'Magnitude'
        } as any;
    }, [result]);

    // Parse Classification Scores
    const scoresData = useMemo(() => {
        if (!result || !result.data.scores) return null;

        const labels = Object.keys(result.data.scores);
        const values = Object.values(result.data.scores);
        const bestFreq = result.data.best_frequency?.toString();

        const colors = labels.map(l => l === bestFreq ? '#22c55e' : '#a855f7');

        return {
            y: labels, // Horizontal bar chart: labels on Y
            x: values,
            type: 'bar',
            orientation: 'h',
            marker: { color: colors },
            text: values.map((v: any) => v.toFixed(3)),
            textposition: 'auto'
        } as any;
    }, [result]);

    if (!result) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded-lg p-8">
                <p>Select a time window to view details.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* High-Resolution Plot Image from Backend */}
            <div className="card">
                <h4 className="text-sm font-medium text-gray-400 mb-4">High-Resolution Plot</h4>
                <div className="relative min-h-[200px] flex items-center justify-center bg-gray-900/50 rounded-lg overflow-hidden">
                    {isLoadingPlot ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            <p className="text-xs text-gray-500">Loading plot...</p>
                        </div>
                    ) : plotError ? (
                        <div className="text-center p-4">
                            <p className="text-xs text-red-400">{plotError}</p>
                        </div>
                    ) : plotImageUrl ? (
                        <img
                            src={plotImageUrl}
                            alt="High-resolution channel plot"
                            className="w-full h-auto"
                            style={{ maxWidth: '100%', height: 'auto' }}
                        />
                    ) : (
                        <p className="text-xs text-gray-600">
                            Select channels and adjust the time window to view a high-resolution plot
                        </p>
                    )}
                </div>
            </div>

            {/* Existing Plotly Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* FFT Spectrum */}
                <div className="card">
                    <h4 className="text-sm font-medium text-gray-400 mb-4">Frequency Spectrum (FFT)</h4>
                    <div style={{ width: '100%', height: 200 }}>
                        {spectrumData ? (
                            <Plot
                                data={[spectrumData]}
                                layout={{
                                    autosize: true,
                                    margin: { t: 10, r: 10, b: 30, l: 30 },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    xaxis: { title: { text: 'Frequency (Hz)' }, color: '#6b7280', showgrid: true, gridcolor: '#374151' },

                                    yaxis: { showgrid: true, gridcolor: '#374151', color: '#6b7280' },
                                    showlegend: false
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false }}
                            />
                        ) : (
                            <p className="text-xs text-gray-600">No spectrum data available.</p>
                        )}
                    </div>
                </div>

                {/* Classification Scores */}
                <div className="card">
                    <h4 className="text-sm font-medium text-gray-400 mb-4 flex justify-between">
                        <span>Classification</span>
                        {result.data.best_frequency && (
                            <span className="text-purple-400 font-bold">{result.data.best_frequency} Hz</span>
                        )}
                    </h4>
                    <div style={{ width: '100%', height: 200 }}>
                        {scoresData ? (
                            <Plot
                                data={[scoresData]}
                                layout={{
                                    autosize: true,
                                    margin: { t: 10, r: 10, b: 30, l: 50 },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    xaxis: { showgrid: true, gridcolor: '#374151', color: '#6b7280' },
                                    yaxis: { type: 'category', color: '#a3a3a3' },
                                    showlegend: false
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false }}
                            />
                        ) : (
                            <div className="text-center py-6">
                                {result.data.best_frequency ? (
                                    <div className="text-3xl font-bold text-white mb-2">{result.data.best_frequency} Hz</div>
                                ) : (
                                    <p className="text-xs text-gray-600">No classification scores.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetailView;
