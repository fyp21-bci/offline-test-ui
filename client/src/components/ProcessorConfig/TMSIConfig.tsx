import React, { useState } from 'react';

interface TMSIConfigProps {
    initialConfig?: {
        n_harmonics: number;
    };
    onConfigChange: (config: {
        n_harmonics: number;
    }) => void;
}

const TMSIConfig: React.FC<TMSIConfigProps> = ({ initialConfig, onConfigChange }) => {
    const [nHarmonics, setNHarmonics] = useState(initialConfig?.n_harmonics ?? 5);

    // Update nHarmonics if initialConfig changes (e.g., when "Use Last Used" is clicked)
    React.useEffect(() => {
        if (initialConfig) {
            setNHarmonics(initialConfig.n_harmonics);
        }
    }, [initialConfig]);

    const handleApplyConfig = () => {
        onConfigChange({
            n_harmonics: nHarmonics
        });
    };

    return (
        <div className="card h-full flex flex-col p-4">
            <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-3">
                TMSI Settings
            </h3>

            <div className="mb-6">
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
                <p className="text-[10px] text-gray-500 mt-1">
                    Number of harmonics to use for SSVEP detection
                </p>
            </div>

            <button
                onClick={handleApplyConfig}
                className="w-full py-3 px-6 bg-accent text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all mt-auto uppercase tracking-wide"
                style={{ backgroundColor: 'var(--accent-color)' }}
            >
                Apply TMSI Settings
            </button>
        </div >
    );
};

export default TMSIConfig;
