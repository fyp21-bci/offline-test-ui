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
        <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-gray-400 mr-2">Quick Zoom:</span>
            {presets.map(preset => (
                <button
                    key={preset.label}
                    onClick={() => onZoomPreset(preset.seconds)}
                    className="btn btn-outline text-sm px-3 py-1.5 flex items-center gap-1.5"
                    title={`Show first ${preset.label}`}
                >
                    <ZoomIn size={14} />
                    {preset.label}
                </button>
            ))}
            <button
                onClick={() => onZoomPreset(null)}
                className="btn btn-outline text-sm px-3 py-1.5 flex items-center gap-1.5"
                title="Show full timeline"
            >
                <Maximize2 size={14} />
                Full
            </button>
        </div>
    );
};

export default PlotControls;
