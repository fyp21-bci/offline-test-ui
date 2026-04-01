import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../../api/client';
import { ZoomIn, ZoomOut } from 'lucide-react';

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
    const [zoom, setZoom] = useState<number>(1);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const imageWrapperRef = useRef<HTMLDivElement>(null);

    const getXRelativeToImage = (e: React.MouseEvent) => {
        if (!imageWrapperRef.current) return 0;
        const rect = imageWrapperRef.current.getBoundingClientRect();
        return e.clientX - rect.left;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2 && plotImageUrl) { // Right click
            e.preventDefault();
            setIsSelecting(true);
            const x = getXRelativeToImage(e);
            setStartX(x);
            setCurrentX(x);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isSelecting && plotImageUrl) {
            setCurrentX(getXRelativeToImage(e));
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isSelecting && plotImageUrl) {
            setIsSelecting(false);
            const x1 = startX;
            const x2 = getXRelativeToImage(e);
            const left = Math.min(x1, x2);
            const right = Math.max(x1, x2);
            const selWidth = right - left;
            
            if (selWidth > 15 && imageWrapperRef.current && scrollContainerRef.current) {
                const viewWidth = scrollContainerRef.current.clientWidth;
                const zoomFactor = viewWidth / selWidth;
                const newZoom = Math.min(30, Math.max(1, zoom * zoomFactor)); 
                
                setZoom(newZoom);
                
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        const newLeft = left * (newZoom / zoom);
                        scrollContainerRef.current.scrollLeft = newLeft;
                    }
                }, 0);
            }
        }
    };

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

    const abortControllerRef = useRef<AbortController | null>(null);

    // Fetch FFT plot when parameters change
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
                    'fft', // Request FFT plot
                    newController.signal
                );
                if (imageUrl) {
                    setPlotImageUrl(imageUrl);
                    console.log('✅ FFTPlot: Successfully loaded FFT plot');
                }
            } catch (err: any) {
                console.error('❌ FFTPlot: Failed to fetch FFT plot:', err);
                setError(err.response?.data?.detail || 'Failed to load FFT plot');
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
        <div ref={containerRef} className="h-full flex flex-col bg-gray-900/30 rounded-lg border border-gray-800 overflow-hidden relative">
            <div className="p-3 border-b border-gray-800 flex justify-between items-start">
                <div>
                    <h4 className="text-xs font-medium text-gray-400">
                        FFT Spectrum ({selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''})
                    </h4>
                    {timeWindow && (
                        <p className="text-xs text-gray-500 mt-1">
                            Window: {timeWindow.start.toFixed(2)}s - {timeWindow.end.toFixed(2)}s
                        </p>
                    )}
                </div>
                {plotImageUrl && (
                    <div className="flex gap-2 items-center bg-gray-900/80 p-1 rounded-lg border border-gray-700">
                        <button onClick={() => setZoom(z => Math.max(1, z - 0.25))} className="p-1.5 rounded hover:bg-gray-700 text-gray-300 transition-colors" title="Zoom Out">
                            <ZoomOut size={16} />
                        </button>
                        <button onClick={() => setZoom(1)} className="px-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors" title="Reset Zoom">
                            {Math.round(zoom * 100)}%
                        </button>
                        <button onClick={() => setZoom(z => Math.min(30, z + 0.25))} className="p-1.5 rounded hover:bg-gray-700 text-gray-300 transition-colors" title="Zoom In">
                            <ZoomIn size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div 
                ref={scrollContainerRef}
                className="flex-1 w-full p-4 overflow-x-auto overflow-y-hidden bg-white/5 relative"
                onContextMenu={(e) => e.preventDefault()}
            >
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        <p className="text-xs text-gray-500">Generating FFT plot...</p>
                    </div>
                ) : error ? (
                    <div className="text-center h-full flex flex-col items-center justify-center">
                        <p className="text-sm text-red-400 mb-2">⚠️ Error</p>
                        <p className="text-xs text-gray-500">{error}</p>
                    </div>
                ) : plotImageUrl ? (
                    <div 
                        ref={imageWrapperRef}
                        className="relative h-full"
                        style={{ width: `${zoom * 100}%` }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <img
                            src={plotImageUrl}
                            alt="FFT spectrum plot"
                            style={{ 
                                width: '100%',
                                height: '100%',
                                objectFit: 'fill'
                            }}
                            className="block pointer-events-none"
                            draggable={false}
                        />
                        {isSelecting && (
                            <div 
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: Math.min(startX, currentX),
                                    width: Math.abs(currentX - startX),
                                    backgroundColor: 'rgba(59, 130, 246, 0.25)',
                                    borderLeft: '1px solid #3b82f6',
                                    borderRight: '1px solid #3b82f6',
                                    pointerEvents: 'none',
                                    zIndex: 10
                                }}
                            />
                        )}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-xs text-gray-600">
                            {timeWindow ? 'Loading FFT plot...' : 'Select a time window using the rangeslider'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FFTPlot;
