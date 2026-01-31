import React, { useMemo, useRef } from 'react';
import Plot from 'react-plotly.js';
import { type AnalysisResult } from '../../api/client';

interface TimeSeriesChartProps {
    data: any[]; // Raw points - ALWAYS pass full dataset, never filtered
    datasetId: string | null; // Stable ID for uirevision
    results?: AnalysisResult[]; // For coloring background
    targetFrequency?: number;
    onWindowClick?: (result: AnalysisResult) => void;
    selectedWindowIndex?: number | null;
    visibleChannels?: Record<string, boolean>;
    showOverlay?: boolean;
    onRangeChange?: (range: [number, number] | null) => void; // Callback for high-res plot updates
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
    data,
    datasetId,
    results,
    targetFrequency,
    onWindowClick,
    selectedWindowIndex,
    visibleChannels,
    showOverlay = true,
    onRangeChange
}) => {
    // Debug: Track data.length and datasetId changes
    console.log('🔢 TimeSeriesChart render, data.length:', data.length, 'datasetId:', datasetId);

    // Ref to store debounce timeout for range changes
    const timeoutRef = useRef<number | null>(null);

    // 1. Determine active channels
    const channels = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0])
            .filter(k => k !== 'time')
            .filter(ch => visibleChannels ? visibleChannels[ch] : true);
    }, [data, visibleChannels]);

    // 2. Prepare Plotly Data (Traces)
    const plotData = useMemo(() => {
        if (channels.length === 0) return [];

        const time = data.map(d => d.time);

        return channels.map((ch, index) => {
            const y = data.map(d => d[ch]);
            // Stack traces: Create a subplot for each channel
            // Plotly assigns axes like y, y2, y3...
            const axisName = index === 0 ? 'y' : `y${index + 1}`;

            return {
                x: time,
                y: y,
                name: ch,
                type: 'scatter',
                mode: 'lines',
                xaxis: 'x', // Shared X axis
                yaxis: axisName,
                line: { width: 1 }
            } as any;
        });
    }, [data, channels]);


    // 3. Prepare Layout (Subplots)
    const layout = useMemo(() => {
        const n = channels.length;
        if (n === 0) return {};

        console.log('📐 TimeSeriesChart: Building layout, datasetId:', datasetId, 'uirevision:', `dataset-${datasetId}`);

        const subplotsLayout: any = {
            // CRITICAL: uirevision preserves UI state across re-renders
            // Tie it to data.length so it's stable for the same dataset
            // but changes when we actually load a new dataset
            uirevision: `dataset-${datasetId}`,
            grid: {
                rows: n,
                columns: 1,
                pattern: 'independent', // or 'coupled' for shared x? 
                // We use shared 'x' axis reference in traces, so we just need to position Y axes
            },
            showlegend: false,
            margin: { t: 30, r: 10, b: 30, l: 50 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#a3a3a3' },
            xaxis: {
                showgrid: true,
                zeroline: false,
                gridcolor: '#374151',
                anchor: n > 1 ? `y${n}` : 'y',
                // Preserve xaxis state - use datasetId for stability
                uirevision: `dataset-${datasetId}`,
                // CRITICAL: Don't explicitly set rangeslider.range
                // Plotly infers the full extent from the data (which is always full dataset)
                // User selections are managed by Plotly's internal state
                rangeslider: {
                    visible: true,
                    thickness: 0.1,
                    // CRITICAL: Explicitly set the rangeslider's extent to prevent collapse
                    // This is DIFFERENT from xaxis.range (which is the visible selection)
                    // rangeslider.range defines the min/max of the slider itself
                    range: [0, data.length - 1]
                }
            }
        };

        // Manual Stacking Logic for Y-axes
        const spacing = 0.05;
        const height = (1 - (n - 1) * spacing) / n;

        channels.forEach((_, i) => {
            const axisName = i === 0 ? 'yaxis' : `yaxis${i + 1}`;

            const top = 1 - i * (height + spacing);
            const bottom = top - height;

            subplotsLayout[axisName] = {
                domain: [bottom, top],
                showgrid: true,
                gridcolor: '#333',
                zeroline: false,
                title: channels[i],
                titlefont: { size: 10 },
                range: [-30, 30]
            };
        });

        // Add Shapes for Classification Results (Background Colors)
        const shapes: any[] = [];
        if (showOverlay && results && targetFrequency && data.length > 0) {
            const totalPoints = data.length;
            const windowSize = totalPoints / results.length;

            results.forEach((res, i) => {
                const start = i * windowSize;
                const end = (i + 1) * windowSize;

                const detectedFreq = res.data.best_frequency;
                const isCorrect = Math.abs((detectedFreq || 0) - targetFrequency) < 0.5;
                const color = isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

                // Highlight box for the whole vertical column
                shapes.push({
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper', // Stretch across all subplots
                    x0: start,
                    x1: end,
                    y0: 0,
                    y1: 1,
                    fillcolor: color,
                    line: { width: 0 },
                    layer: 'below'
                });

                // Border for selected window
                if (selectedWindowIndex === i) {
                    shapes.push({
                        type: 'rect',
                        xref: 'x',
                        yref: 'paper',
                        x0: start,
                        x1: end,
                        y0: 0,
                        y1: 1,
                        fillcolor: 'rgba(0,0,0,0)',
                        line: { color: '#a855f7', width: 2 },
                    });
                }
            });
        }
        subplotsLayout.shapes = shapes;

        // Click Handler area? Plotly handles click events on points.
        // But we want clicks on "Windows" (background regions).
        // shapes don't capture events easily.
        // We might need an invisible trace or use chart Click event and calculate X coordinate.

        return subplotsLayout;
    }, [data.length, channels.length, results, targetFrequency, selectedWindowIndex, showOverlay]);

    const handleClick = (e: any) => {
        if (!onWindowClick || !results || !data.length) return;

        // e.points[0].x gives the x-coordinate (time/index)
        const x = e.points[0].x;

        // Find which window this X belongs to
        const totalPoints = data.length;
        const windowSize = totalPoints / results.length;
        const index = Math.floor(x / windowSize);

        if (index >= 0 && index < results.length) {
            onWindowClick(results[index]);
        }
    };

    // Handle rangeslider and zoom/pan interactions
    const handleRelayout = (e: any) => {
        console.log('📊 TimeSeriesChart: onRelayout event:', e);
        console.log('📊 Event keys:', Object.keys(e));

        // Check if x-axis range changed (from zooming or panning)
        if (e['xaxis.range[0]'] !== undefined && e['xaxis.range[1]'] !== undefined) {
            const newRange: [number, number] = [
                Math.floor(e['xaxis.range[0]']),
                Math.ceil(e['xaxis.range[1]'])
            ];
            console.log('📊 TimeSeriesChart: Detected range change:', newRange);

            // Debounce: only notify parent after user stops interacting
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                if (onRangeChange) {
                    console.log('📊 TimeSeriesChart: Calling onRangeChange for high-res plot:', newRange);
                    onRangeChange(newRange);
                }
            }, 500);
        }
        // Check for rangeslider-specific range updates
        else if (e['xaxis.range'] !== undefined) {
            const newRange: [number, number] = [
                Math.floor(e['xaxis.range'][0]),
                Math.ceil(e['xaxis.range'][1])
            ];
            console.log('📊 TimeSeriesChart: Rangeslider range change:', newRange);

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                if (onRangeChange) {
                    console.log('📊 TimeSeriesChart: Calling onRangeChange for high-res plot:', newRange);
                    onRangeChange(newRange);
                }
            }, 500);
        }
        // Handle autorange reset (double-click or reset button)
        else if (e['xaxis.autorange'] === true) {
            console.log('📊 TimeSeriesChart: Resetting to autorange');

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                if (onRangeChange) {
                    console.log('📊 TimeSeriesChart: Calling onRangeChange with null (full range)');
                    onRangeChange(null);
                }
            }, 300);
        }
    };

    return (
        <Plot
            data={plotData}
            layout={{
                ...layout,
                autosize: true,
                height: 700,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                dragmode: 'zoom'
            }}
            style={{ width: '100%', height: '100%' }}
            config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                displaylogo: false
            }}
            onClick={handleClick}
            onRelayout={handleRelayout}
        />
    );
};

export default TimeSeriesChart;
