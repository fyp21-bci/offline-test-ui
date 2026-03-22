import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../../api/client';

interface HighResPlotProps {
    datasetId: string | null;
    selectedChannels: number[];
    timeWindow: { start: number; end: number } | null;
    samplingRate: number;
    dataLength: number;
}

const HighResPlot: React.FC<HighResPlotProps> = ({
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
    const [containerWidth, setContainerWidth] = useState<number>(1200); // Default width

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

    // Cleanup blob URLs on unmount or when URL changes
    useEffect(() => {
        return () => {
            if (plotImageUrl) {
                URL.revokeObjectURL(plotImageUrl);
            }
        };
    }, [plotImageUrl]);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Fetch plot when parameters change
    useEffect(() => {
        const fetchPlot = async () => {
            if (!datasetId || selectedChannels.length === 0) {
                setPlotImageUrl(null);
                return;
            }

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const newController = new AbortController();
            abortControllerRef.current = newController;

            // Calculate time window: use provided window or full range
            const startTime = timeWindow ? timeWindow.start : 0;
            const endTime = timeWindow ? timeWindow.end : (dataLength / samplingRate);

            console.log('🎨 HighResPlot: Fetching plot with:', {
                datasetId,
                channels: selectedChannels,
                timeWindow: { start: startTime, end: endTime },
                isFullRange: !timeWindow
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
                    'time',
                    newController.signal
                );
                if (imageUrl) {
                    setPlotImageUrl(imageUrl);
                    console.log('✅ HighResPlot: Successfully loaded plot');
                }
            } catch (err: any) {
                console.error('❌ HighResPlot: Failed to fetch plot image:', err);
                setError(err.response?.data?.detail || 'Failed to load plot');
            } finally {
                if (abortControllerRef.current === newController) {
                    setIsLoading(false);
                }
            }
        };

        fetchPlot();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [datasetId, selectedChannels, timeWindow, dataLength, samplingRate, containerWidth]);

    if (!datasetId) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded-lg">
                <p className="text-sm">No dataset selected</p>
            </div>
        );
    }

    if (selectedChannels.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded-lg">
                <p className="text-sm">No channels selected</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-gray-900/30 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-3 border-b border-gray-800">
                <h4 className="text-xs font-medium text-gray-400">
                    High-Resolution Plot ({selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''})
                </h4>
            </div>

            <div className="flex-1 relative flex items-center justify-center p-4 overflow-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                        <p className="text-xs text-gray-500">Loading plot...</p>
                    </div>
                ) : error ? (
                    <div className="text-center p-4">
                        <p className="text-xs text-red-400">{error}</p>
                        <p className="text-xs text-gray-600 mt-2">Try adjusting the time window or channel selection</p>
                    </div>
                ) : plotImageUrl ? (
                    <img
                        src={plotImageUrl}
                        alt="High-resolution signal plot"
                        className="w-full h-auto"
                    />
                ) : (
                    <p className="text-xs text-gray-600">
                        Adjust time window or channels to view plot
                    </p>
                )}
            </div>
        </div>
    );
};

export default HighResPlot;
