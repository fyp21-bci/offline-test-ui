import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

interface RealTimeChartProps {
    data: Record<string, number[]>; // Channel name -> Data array
    samplingRate: number;
    windowSizeSec: number;
}

const RealTimeChart: React.FC<RealTimeChartProps> = ({ data, samplingRate }) => {
    // Transform data for Plotly
    const plotData = useMemo(() => {
        if (!data || Object.keys(data).length === 0) return [];

        const channels = Object.keys(data);
        const traces: any[] = [];

        // Calculate time axis based on the first channel's length
        const nSamples = data[channels[0]].length;
        const timeAxis = Array.from({ length: nSamples }, (_, i) => i / samplingRate);

        channels.forEach((ch, _idx) => {
            // Offset traces for visibility (simple stacking)
            // Or just plot them overlapping. The user asked for "Raw EEG plot".
            // Typically EEG is plotted with offsets.
            // Let's just plot regular lines for now, maybe add offset later if requested.
            // Actually, let's use a simple distinct color and no offset for "Raw" unless requested.
            // Wait, "Raw signal" usually implies offset or subplots if multiple channels.
            // Let's stick to standard overlay for now or separate generic lines.

            traces.push({
                x: timeAxis,
                y: data[ch],
                type: 'scatter',
                mode: 'lines',
                name: ch,
                line: { width: 1.5 }
            });
        });

        return traces;
    }, [data, samplingRate]);

    const layout: Partial<Plotly.Layout> = {
        title: { text: undefined }, // No title to save space
        autosize: true,
        height: 300,
        margin: { l: 50, r: 10, t: 30, b: 40 },
        xaxis: {
            title: { text: 'Time (s)' },
            showgrid: true,
            zeroline: false,
        },
        yaxis: {
            title: { text: 'Amplitude (uV)' },
            showgrid: true,
            zeroline: false,
            // fixedrange: true // user might want to zoom, but real-time usually scrolls
        },
        showlegend: true,
        legend: { orientation: 'h', y: 1.1 }
    };

    return (
        <div className="w-full h-full bg-slate-900 rounded-lg p-2  border border-slate-700">
            <h3 className="text-gray-400 text-sm font-semibold mb-2 ml-2">Raw Data Stream</h3>
            <Plot
                data={plotData}
                layout={layout}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[300px]"
            />
        </div>
    );
};

export default RealTimeChart;
