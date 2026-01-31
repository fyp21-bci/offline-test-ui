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
                className="btn btn-outline text-sm px-3 py-1.5 flex items-center gap-2 mr-5"
            >
                {allVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                <span className="whitespace-nowrap">{allVisible ? 'Hide All' : 'Show All'}</span>
            </button>

            {channels.map((ch, index) => {
                const color = PLOTLY_COLORS[index % PLOTLY_COLORS.length];
                const isVisible = visible[ch];

                return (
                    <button
                        key={ch}
                        onClick={() => onToggle(ch)}
                        style={isVisible ? {
                            backgroundColor: color,
                            borderColor: color,
                            color: '#FFFFFF'
                        } : {
                            color: color,
                            borderColor: color
                        }}
                        className={`
                            btn btn-outline text-sm px-3 py-1.5 flex items-center gap-2
                            ${!isVisible && 'hover:brightness-110 bg-transparent'}
                        `}
                    >
                        <span className="whitespace-nowrap">{ch}</span>
                        {isVisible ? (
                            <Eye size={14} className="opacity-80" />
                        ) : (
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: color }}
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
