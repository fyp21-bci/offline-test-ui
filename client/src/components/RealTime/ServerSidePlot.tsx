import React from 'react';

interface ServerSidePlotProps {
    title: string;
    imageBase64: string | null | undefined;
}

const ServerSidePlot: React.FC<ServerSidePlotProps> = ({ title, imageBase64 }) => {
    return (
        <div className="w-full h-full bg-slate-900 rounded-lg p-2 border border-slate-700 flex flex-col">
            <h3 className="text-gray-400 text-sm font-semibold mb-2 ml-2">{title}</h3>
            <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
                {imageBase64 ? (
                    <img
                        src={imageBase64}
                        alt={`${title} Plot`}
                        className="max-w-full max-h-full object-contain"
                    />
                ) : (
                    <div className="text-slate-600 text-sm italic">Waiting for plot data...</div>
                )}
            </div>
        </div>
    );
};

export default ServerSidePlot;
