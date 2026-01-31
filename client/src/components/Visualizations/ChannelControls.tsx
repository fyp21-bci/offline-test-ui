import React from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';

interface ChannelControlsProps {
    channels: string[];
    visible: Record<string, boolean>;
    onToggle: (channel: string) => void;
    onToggleAll: (visible: boolean) => void;
}

const ChannelControls: React.FC<ChannelControlsProps> = ({
    channels,
    visible,
    onToggle,
    onToggleAll
}) => {
    const allVisible = channels.every(ch => visible[ch]);

    return (
        <div className="card p-3 flex flex-col gap-2 max-h-[250px] overflow-hidden">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400 pb-2 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Layers size={14} />
                    <span>Channels</span>
                </div>
                <button
                    onClick={() => onToggleAll(!allVisible)}
                    className="hover:text-white transition-colors flex items-center gap-1"
                >
                    {allVisible ? 'Hide All' : 'Show All'}
                </button>
            </div>

            <div className="overflow-y-auto space-y-1 flex-1 pr-1">
                {channels.map(ch => (
                    <button
                        key={ch}
                        onClick={() => onToggle(ch)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${visible[ch]
                                ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                : 'text-gray-500 hover:text-gray-400'
                            }`}
                    >
                        <span>{ch}</span>
                        {visible[ch] ? <Eye size={12} className="text-purple-400" /> : <EyeOff size={12} />}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ChannelControls;
