import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../../api/client';

interface FFTPlotProps {
    datasetId: string | null;
    selectedChannels: number[];
    timeWindow: { start: number; end: number } | null;
    samplingRate: number;
    dataLength: number;
}

const FFTPlot: React.FC<FFTPlotProps> = ({
    datasetId,
    selectedChannels,
    timeWindow,
    samplingRate,
    dataLength
}) => {
    const [plotImageUrl, setPlotImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(1200);

    // Measure container width
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setContainerWidth(width > 0 ? width : 1200);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Cleanup blob URLs
    useEffect(() => {
        return () => {
            if (plotImageUrl) {
                URL.revokeObjectURL(plotImageUrl);
            }
        };
    }, [plotImageUrl]);

    // Fetch FFT plot when parameters change
    useEffect(() => {
        const fetchPlot = async () => {
            if (!datasetId || selectedChannels.length === 0) {
                setPlotImageUrl(null);
                return;
            }

            // Calculate time window
            const startTime = timeWindow ? timeWindow.start : 0;
            const endTime = timeWindow ? timeWindow.end : (dataLength / samplingRate);

            console.log('📊 FFTPlot: Fetching FFT with:', {
                datasetId,
                channels: selectedChannels,
                timeWindow: { start: startTime, end: endTime },
                width: containerWidth
            });

            setIsLoading(true);
            setError(null);

            try {
                const imageUrl = await ApiService.getPlotImage(
                    datasetId,
                    selectedChannels,
                    startTime,
                    endTime,
                    containerWidth,
                    'fft' // Request FFT plot
                );
                setPlotImageUrl(imageUrl);
                console.log('✅ FFTPlot: Successfully loaded FFT plot');
            } catch (err: any) {
                console.error('❌ FFTPlot: Failed to fetch FFT plot:', err);
                setError(err.response?.data?.detail || 'Failed to load FFT plot');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlot();
    }, [datasetId, selectedChannels, timeWindow, dataLength, samplingRate, containerWidth]);

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

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-gray-900/30 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-3 border-b border-gray-800">
                <h4 className="text-xs font-medium text-gray-400">
                    FFT Spectrum ({selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''})
                </h4>
                {timeWindow && (
                    <p className="text-xs text-gray-500 mt-1">
                        Window: {timeWindow.start.toFixed(2)}s - {timeWindow.end.toFixed(2)}s
                    </p>
                )}
            </div>

            <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-white/5">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        <p className="text-xs text-gray-500">Generating FFT plot...</p>
                    </div>
                ) : error ? (
                    <div className="text-center">
                        <p className="text-sm text-red-400 mb-2">⚠️ Error</p>
                        <p className="text-xs text-gray-500">{error}</p>
                    </div>
                ) : plotImageUrl ? (
                    <img
                        src={plotImageUrl}
                        alt="FFT spectrum plot"
                        className="w-full h-auto"
                    />
                ) : (
                    <p className="text-xs text-gray-600">
                        {timeWindow ? 'Loading FFT plot...' : 'Select a time window using the rangeslider'}
                    </p>
                )}
            </div>
        </div>
    );
};

export default FFTPlot;
