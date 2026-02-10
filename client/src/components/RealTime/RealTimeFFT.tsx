import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

interface RealTimeFFTProps {
    frequencies: number[];
    magnitudes: number[];
}

const RealTimeFFT: React.FC<RealTimeFFTProps> = ({ frequencies, magnitudes }) => {

    const plotData = useMemo(() => {
        if (!frequencies || !magnitudes || frequencies.length === 0) return [];
        return [{
            x: frequencies,
            y: magnitudes,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy', // Fill under curve
            fillcolor: 'rgba(14, 165, 233, 0.2)', // Accent color with low opacity
            line: { color: '#0ea5e9', width: 2 }, // Sky blue
            name: 'Spectrum'
        }] as any[];
    }, [frequencies, magnitudes]);

    const layout: Partial<Plotly.Layout> = {
        title: undefined,
        autosize: true,
        height: 250,
        margin: { l: 50, r: 10, t: 20, b: 40 },
        xaxis: {
            title: { text: 'Frequency (Hz)' },
            range: [0, 60], // Focus on EEG range usually
            showgrid: true,
        },
        yaxis: {
            title: { text: 'Magnitude' },
            showgrid: true,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#94a3b8' } // Slate-400
    };

    return (
        <div className="w-full bg-slate-900 rounded-lg p-2 border border-slate-700">
            <h3 className="text-gray-400 text-sm font-semibold mb-2 ml-2">Frequency Spectrum (FFT)</h3>
            <div className="w-full h-[250px]">
                <Plot
                    data={plotData}
                    layout={layout}
                    style={{ width: '100%', height: '100%' }}
                    config={{ responsive: true, displayModeBar: false }}
                />
            </div>
        </div>
    );
};

export default RealTimeFFT;
