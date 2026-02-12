import React, { useState } from 'react';

interface TMSIConfigProps {
    onConfigChange: (config: {
        frequencies: number[];
        window_sec: number;
        n_harmonics: number;
        target_frequency: number | number[] | null;
    }) => void;
}

const TMSIConfig: React.FC<TMSIConfigProps> = ({ onConfigChange }) => {
    const [frequenciesInput, setFrequenciesInput] = useState('7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0');
    const [windowSec, setWindowSec] = useState(1.0);
    const [nHarmonics, setNHarmonics] = useState(5);
    const [targetFrequency, setTargetFrequency] = useState<string>('');

    const handleApplyConfig = () => {
        try {
            const frequencies = frequenciesInput
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .map(s => parseFloat(s))
                .filter(n => !isNaN(n));

            // Parse target frequency (single number or comma-separated list)
            let parsedTarget: number | number[] | null = null;
            if (targetFrequency.trim() !== '') {
                if (targetFrequency.includes(',')) {
                    parsedTarget = targetFrequency.split(',')
                        .map(s => parseFloat(s.trim()))
                        .filter(n => !isNaN(n));
                    if (parsedTarget.length === 0) parsedTarget = null;
                } else {
                    const val = parseFloat(targetFrequency);
                    parsedTarget = isNaN(val) ? null : val;
                }
            }

            onConfigChange({
                frequencies,
                window_sec: windowSec,
                n_harmonics: nHarmonics,
                target_frequency: parsedTarget
            });
        } catch (err) {
            console.error('Failed to parse TMSI configuration:', err);
        }
    };

    return (
        <div className="card h-full flex flex-col">
            <h3 className="text-2xl font-bold mb-8 text-white flex items-center gap-3">
                TMSI Configuration
            </h3>

            {/* Frequencies */}
            <div className="mb-6">
                <label className="text-sm font-bold text-slate-400 mb-3 block">
                    Candidate Frequencies (Hz)
                </label>
                <input
                    type="text"
                    value={frequenciesInput}
                    onChange={(e) => setFrequenciesInput(e.target.value)}
                    className="w-full text-base bg-zinc-900/50 border-white/10 focus:border-purple-500 h-12"
                    placeholder="8.0, 9.0, 10.0, 11.0, 12.0"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                    Comma-separated list of frequencies to test
                </p>
            </div>

            {/* Target Frequency */}
            <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                    Target Frequency (Hz)
                </label>
                <input
                    type="text"
                    value={targetFrequency}
                    onChange={(e) => setTargetFrequency(e.target.value)}
                    className="w-full text-base bg-zinc-900/50 border-white/10 focus:border-purple-500 h-12"
                    placeholder="e.g. 10.0 or 8.0, 9.0"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                    Expected frequency(ies). Use comma for multiple targets.
                </p>
            </div>

            {/* Window Size */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                        Window Size (s)
                    </label>
                    <input
                        type="number"
                        value={windowSec}
                        onChange={(e) => setWindowSec(parseFloat(e.target.value) || 1.0)}
                        className="w-full text-base bg-zinc-900/50 border-white/10 focus:border-purple-500 h-12"
                        min="0.1"
                        max="10"
                        step="0.1"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                        Duration of each classification window
                    </p>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                        Harmonics
                    </label>
                    <input
                        type="number"
                        value={nHarmonics}
                        onChange={(e) => setNHarmonics(parseInt(e.target.value) || 5)}
                        className="w-full text-base bg-zinc-900/50 border-white/10 focus:border-purple-500 h-12"
                        min="1"
                        max="10"
                        step="1"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                        Number of harmonics to use for SSVEP detection
                    </p>
                </div>

            </div>


            <button
                onClick={handleApplyConfig}
                className="w-full py-5 px-8 bg-accent text-white rounded-xl text-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all mt-8 uppercase tracking-wide"
                style={{ backgroundColor: 'var(--accent-color)' }}
            >
                APPLY CONFIGURATION
            </button>
        </div >
    );
};

export default TMSIConfig;
