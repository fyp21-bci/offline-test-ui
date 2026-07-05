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

    const { predicted_class } = result;

    const classStr = String(predicted_class !== undefined ? predicted_class : '--');
    const hasHz = classStr.endsWith(' Hz');
    const mainValue = hasHz ? classStr.replace(' Hz', '') : classStr;

    return (
        <div className="w-full h-full p-2">
            <div 
                className="flex flex-col w-full h-full rounded-[2rem] border-4 border-purple-800 items-center justify-center shadow-2xl shadow-purple-900/20"
                style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.05)',
                    transition: 'background-color 0.9s'
                }}
            >
                <span 
                    className="font-bold text-blue-400 leading-none tracking-tight drop-shadow-md"
                    style={{ fontSize: '11rem' }}
                >
                    {mainValue}
                </span>
                {hasHz && (
                    <span 
                        className="font-bold text-blue-500 mt-4"
                        style={{ fontSize: '3.5rem' }}
                    >
                        Hz
                    </span>
                )}
            </div>
        </div>
    );
};

export default ClassificationPanel;
