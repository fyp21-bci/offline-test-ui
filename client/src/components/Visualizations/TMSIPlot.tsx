import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../../api/client';

interface TMSIPlotProps {
    datasetId: string | null;
    selectedChannels: number[];
    timeWindow: { start: number; end: number } | null;
    samplingRate: number;
    dataLength: number;
    tmsiConfig: {
        frequencies: number[];
        window_sec: number;
        n_harmonics: number;
    };
    targetFrequency?: number | number[];
}

const TMSIPlot: React.FC<TMSIPlotProps> = ({
    datasetId,
    selectedChannels,
    timeWindow,
    samplingRate,
    dataLength,
    tmsiConfig,
    targetFrequency
}) => {
    const [plotImageUrl, setPlotImageUrl] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch TMSI classification plot when parameters change
    useEffect(() => {
        const fetchPlot = async () => {
            if (!datasetId || selectedChannels.length === 0 || tmsiConfig.frequencies.length === 0) {
                setPlotImageUrl(null);
                setMetadata(null);
                return;
            }

            // Calculate time window
            const startTime = timeWindow ? timeWindow.start : 0;
            const endTime = timeWindow ? timeWindow.end : (dataLength / samplingRate);

            console.log('📊 TMSIPlot: Fetching classification plot with:', {
                datasetId,
                channels: selectedChannels,
                timeWindow: { start: startTime, end: endTime },
                tmsiConfig,
                targetFrequency
            });

            setIsLoading(true);
            setError(null);

            try {
                const result = await ApiService.getClassificationPlot(
                    datasetId,
                    selectedChannels,
                    startTime,
                    endTime,
                    tmsiConfig,
                    targetFrequency
                );

                setPlotImageUrl(result.image);
                setMetadata(result.metadata);
                console.log('✅ TMSIPlot: Successfully loaded classification plot');
            } catch (err: any) {
                console.error('❌ TMSIPlot: Failed to fetch classification plot:', err);
                setError(err.response?.data?.detail || 'Failed to load classification plot');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        datasetId,
        JSON.stringify(selectedChannels), // Stringify array for stable comparison
        timeWindow?.start,
        timeWindow?.end,
        dataLength,
        samplingRate,
        JSON.stringify(tmsiConfig.frequencies), // Stringify array for stable comparison
        tmsiConfig.window_sec,
        tmsiConfig.n_harmonics,
        JSON.stringify(targetFrequency) // Stringify distinct target frequencies too
    ]);

    if (!datasetId) {
        return (
            <div ref={containerRef} className="h-64 flex items-center justify-center bg-gray-900/30 rounded-lg border border-gray-800">
                <p className="text-sm text-gray-600">No dataset selected</p>
            </div>
        );
    }

    if (selectedChannels.length === 0) {
        return (
            <div ref={containerRef} className="h-64 flex items-center justify-center bg-gray-900/30 rounded-lg border border-gray-800">
                <p className="text-sm text-gray-600">No channels selected</p>
            </div>
        );
    }

    if (tmsiConfig.frequencies.length === 0) {
        return (
            <div ref={containerRef} className="h-64 flex items-center justify-center bg-gray-900/30 rounded-lg border border-gray-800">
                <p className="text-sm text-gray-600">Configure TMSI frequencies to view plot</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-gray-900/30 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-3 border-b border-gray-800">
                <h4 className="text-xs font-medium text-gray-400">
                    TMSI Classification ({selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''})
                </h4>
                {timeWindow && (
                    <p className="text-xs text-gray-500 mt-1">
                        Window: {timeWindow.start.toFixed(2)}s - {timeWindow.end.toFixed(2)}s
                    </p>
                )}
                {metadata && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span className="text-gray-500">
                            Segments: <span className="text-gray-300 font-medium">{metadata.total_segments}</span>
                        </span>
                        {(() => {
                            // Calculate accuracy if not provided explicitly
                            const accuracy = metadata.accuracy !== undefined
                                ? metadata.accuracy
                                : (metadata.correct_count !== undefined && metadata.total_segments > 0)
                                    ? metadata.correct_count / metadata.total_segments
                                    : undefined;

                            if (accuracy === undefined) return null;

                            return (
                                <span className="text-gray-500">
                                    Accuracy: <span className={`font-medium ${accuracy >= 0.7 ? 'text-green-400' : accuracy >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(accuracy * 100).toFixed(1)}%
                                    </span>
                                </span>
                            );
                        })()}
                        {metadata.target_frequency !== undefined && (
                            <span className="text-gray-500">
                                Target: <span className="text-purple-400 font-medium">
                                    {Array.isArray(metadata.target_frequency)
                                        ? metadata.target_frequency.join(', ')
                                        : metadata.target_frequency} Hz
                                </span>
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-white/5">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        <p className="text-xs text-gray-500">Generating classification plot...</p>
                    </div>
                ) : error ? (
                    <div className="text-center">
                        <p className="text-sm text-red-400 mb-2">⚠️ Error</p>
                        <p className="text-xs text-gray-500">{error}</p>
                    </div>
                ) : plotImageUrl ? (
                    <img
                        src={plotImageUrl}
                        alt="TMSI classification plot"
                        className="w-full h-auto"
                    />
                ) : (
                    <p className="text-xs text-gray-600">
                        Configure parameters to view classification plot
                    </p>
                )}
            </div>

            {metadata && metadata.frequency_counts && (
                <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                    <p className="text-sm font-medium text-gray-300 mb-3">Detected Frequencies (Counts):</p>
                    <div className="flex flex-col gap-2">
                        {Object.entries(metadata.frequency_counts as Record<string, number>)
                            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])) // Sort by frequency
                            .map(([freq, count]) => (
                                <div key={freq} className="flex items-center text-sm">
                                    <span className="font-bold text-white min-w-[60px]">
                                        {freq} Hz
                                    </span>
                                    <span className="text-gray-500 mx-2">-</span>
                                    <span className="text-gray-300">
                                        {count} segments
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TMSIPlot;
