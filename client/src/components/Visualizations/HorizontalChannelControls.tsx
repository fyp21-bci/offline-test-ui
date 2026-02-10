import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface HorizontalChannelControlsProps {
    channels: string[];
    visible: Record<string, boolean>;
    onToggle: (channel: string) => void;
    onToggleAll: (visible: boolean) => void;
}

// Default Plotly colors to match the chart lines
const PLOTLY_COLORS = [
    '#636EFA', // 0: blue
    '#EF553B', // 1: red
    '#00CC96', // 2: green
    '#AB63FA', // 3: purple
    '#FFA15A', // 4: orange
    '#19D3F3', // 5: teal
    '#FF6692', // 6: pink
    '#B6E880', // 7: lime
    '#FF97FF', // 8: magenta
    '#FECB52'  // 9: yellow
];

const HorizontalChannelControls: React.FC<HorizontalChannelControlsProps> = ({
    channels,
    visible,
    onToggle,
    onToggleAll
}) => {
    const allVisible = channels.every(ch => visible[ch]);

    return (
        <div className="flex flex-wrap items-center gap-5 mb-4">
            <button
                onClick={() => onToggleAll(!allVisible)}
                className="btn btn-outline text-sm px-5 py-3 flex items-center gap-2 mr-8 hover:bg-slate-700 border-2 rounded-lg font-bold uppercase tracking-wide"
            >
                {allVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                <span className="whitespace-nowrap">{allVisible ? 'HIDE ALL' : 'SHOW ALL'}</span>
            </button>

            {channels.map((ch, index) => {
                const color = PLOTLY_COLORS[index % PLOTLY_COLORS.length];
                const isVisible = visible[ch];

                return (
                    <button
                        key={ch}
                        onClick={() => onToggle(ch)}
                        style={isVisible ? {
                            backgroundColor: `${color}20`, // 20% opacity
                            borderColor: color,
                            color: '#FFFFFF',
                            boxShadow: `0 0 10px ${color}40`
                        } : {
                            color: color,
                            borderColor: `${color}40` // dim border
                        }}
                        className={`
                            btn btn-outline text-sm px-5 py-3 flex items-center gap-2
                            transition-all duration-200 uppercase tracking-widest font-bold border-2 rounded-lg
                            ${!isVisible && 'hover:bg-slate-800 opacity-60 hover:opacity-100'}
                        `}
                    >
                        <span className="whitespace-nowrap">{ch}</span>
                        {isVisible ? (
                            <Eye size={14} className="drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                        ) : (
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}
                                title="Channel Color"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default HorizontalChannelControls;
