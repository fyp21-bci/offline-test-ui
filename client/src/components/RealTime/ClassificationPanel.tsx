import React from 'react';

interface ClassificationPanelProps {
    result: {
        predicted_class?: string | number;
        confidence?: number;
        target_label?: string | number;
        is_correct?: boolean;
        timestamp?: number;
    } | null;
    title?: string;
}

const ClassificationPanel: React.FC<ClassificationPanelProps> = ({ result, title }) => {
    if (!result) {
        return (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 flex items-center justify-center h-full min-h-[150px]">
                <span className="text-slate-500 animate-pulse">Waiting for classification...</span>
            </div>
        );
    }

    const { predicted_class, confidence, is_correct } = result;

    // Determine status color
    let statusColor = 'bg-slate-700 border-slate-600';
    let statusText = 'Unknown';

    if (is_correct === true) {
        statusColor = 'bg-green-900/30 border-green-600/50 text-green-400';
        statusText = 'Correct';
    } else if (is_correct === false) {
        statusColor = 'bg-red-900/30 border-red-600/50 text-red-400';
        statusText = 'Incorrect';
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-xl flex-1 flex flex-col items-center justify-center">
                {title && <h4 className="text-slate-500 font-bold uppercase tracking-widest text-sm mb-4">{title}</h4>}
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Predicted Class</span>
                <div className="text-7xl font-mono font-bold text-white tracking-widest my-4 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                    {predicted_class !== undefined ? predicted_class : '--'}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 h-[80px]">
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col items-center">
                    <span className="text-slate-400 text-[10px] font-bold uppercase mb-1">Confidence</span>
                    <span className="text-xl font-bold text-sky-400">
                        {confidence !== undefined ? (confidence * 100).toFixed(1) : '0.0'}%
                    </span>
                </div>

                <div className={`rounded-lg p-3 border flex flex-col items-center ${statusColor}`}>
                    <span className="text-[10px] font-bold uppercase mb-1 opacity-70">Accuracy</span>
                    <span className="text-xl font-bold">
                        {statusText}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ClassificationPanel;
