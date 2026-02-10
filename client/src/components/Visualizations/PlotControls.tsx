import React from 'react';
import { ZoomIn, Maximize2 } from 'lucide-react';

interface PlotControlsProps {
    onZoomPreset: (seconds: number | null) => void;
    dataLength: number;
    samplingRate?: number;
}

const PlotControls: React.FC<PlotControlsProps> = ({ onZoomPreset, dataLength, samplingRate = 250 }) => {
    // Calculate available duration
    const totalDuration = dataLength / samplingRate;

    const presets = [
        { label: '1s', seconds: 1 },
        { label: '5s', seconds: 5 },
        { label: '10s', seconds: 10 },
        { label: '30s', seconds: 30 },
    ].filter(p => p.seconds < totalDuration);

    return (
        <div className="flex items-center gap-4 mb-8 bg-slate-900/80 p-3 rounded-2xl border border-slate-700 backdrop-blur-sm px-6 shadow-md">
            <span className="text-sm font-bold text-slate-400 mr-4 uppercase tracking-wider">Quick Zoom:</span>
            {presets.map(preset => (
                <button
                    key={preset.label}
                    onClick={() => onZoomPreset(preset.seconds)}
                    className="btn btn-outline text-xs px-4 py-2 flex items-center gap-2 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-400/50 transition-all font-mono"
                    title={`Show first ${preset.label}`}
                >
                    <ZoomIn size={14} />
                    {preset.label}
                </button>
            ))}
            <button
                onClick={() => onZoomPreset(null)}
                className="btn btn-outline text-sm px-5 py-3 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-all uppercase tracking-wider font-bold ml-auto border-2 rounded-lg"
                title="Show full timeline"
            >
                <Maximize2 size={18} />
                FULL VIEW
            </button>
        </div>
    );
};

export default PlotControls;
