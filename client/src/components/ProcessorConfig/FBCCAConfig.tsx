import React, { useState } from 'react';

interface FBCCAConfigProps {
    title?: string;
    initialConfig?: {
        n_harmonics: number;
        n_subbands: number;
    };
    onConfigChange: (config: {
        n_harmonics: number;
        n_subbands: number;
    }) => void;
}

const FBCCAConfig: React.FC<FBCCAConfigProps> = ({ title, initialConfig, onConfigChange }) => {
    const [nHarmonics, setNHarmonics] = useState(initialConfig?.n_harmonics ?? 5);
    const [nSubbands, setNSubbands] = useState(initialConfig?.n_subbands ?? 5);

    // Update state if initialConfig changes
    React.useEffect(() => {
        if (initialConfig) {
            setNHarmonics(initialConfig.n_harmonics);
            setNSubbands(initialConfig.n_subbands);
        }
    }, [initialConfig]);

    const handleApplyConfig = () => {
        onConfigChange({
            n_harmonics: nHarmonics,
            n_subbands: nSubbands
        });
    };

    return (
        <div className="card h-full flex flex-col p-4">
            <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-3">
                {title || 'FBCCA Settings'}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                        Harmonics
                    </label>
                    <input
                        type="number"
                        value={nHarmonics}
                        onChange={(e) => setNHarmonics(parseInt(e.target.value) || 5)}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full text-base bg-zinc-900/50 border border-white/10 focus:border-purple-500 rounded h-12 px-4 text-white"
                        min="1"
                        max="10"
                        step="1"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                        Sub-bands
                    </label>
                    <input
                        type="number"
                        value={nSubbands}
                        onChange={(e) => setNSubbands(parseInt(e.target.value) || 5)}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full text-base bg-zinc-900/50 border border-white/10 focus:border-purple-500 rounded h-12 px-4 text-white"
                        min="1"
                        max="10"
                        step="1"
                    />
                </div>
            </div>

            <button
                onClick={handleApplyConfig}
                className="w-full py-3 px-6 bg-accent text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all mt-auto uppercase tracking-wide"
                style={{ backgroundColor: 'var(--accent-color)' }}
            >
                Apply FBCCA Settings
            </button>
        </div >
    );
};

export default FBCCAConfig;
