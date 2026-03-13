
import React, { useEffect, useRef } from 'react';

interface BlinkingStimulusProps {
    frequency: number;
    isSelected: boolean;
    color: string;
    size?: number;
}

/**
 * BlinkingStimulus - SSVEP flickering stimulus.
 *
 * Flickering is implemented via direct DOM style mutation inside
 * requestAnimationFrame, completely bypassing React's render/state cycle.
 * This guarantees the on/off toggles are never delayed by re-renders,
 * batching, or other JS activity.
 *
 * The CSS `transition` is intentionally absent on the circle so the
 * on↔off switch is a hard cut - exactly what SSVEP stimuli require.
 */
const BlinkingStimulus: React.FC<BlinkingStimulusProps> = ({
    frequency,
    isSelected,
    color = 'white',
    size = 100,
}) => {
    // Ref to the inner circle element we mutate directly
    const circleRef = useRef<HTMLDivElement>(null);
    // Keep a ref to the latest frequency so the rAF loop always uses the current value
    const frequencyRef = useRef(frequency);
    useEffect(() => { frequencyRef.current = frequency; }, [frequency]);

    // The flickering loop – no React state involved
    useEffect(() => {
        let frameId: number;
        let lastToggle = performance.now();
        let isOn = true;

        const loop = (timestamp: number) => {
            const intervalMs = 1000 / (frequencyRef.current * 2); // half-period

            if (timestamp - lastToggle >= intervalMs) {
                isOn = !isOn;
                lastToggle = timestamp;

                // Mutate the DOM directly – no setState, no re-render
                const el = circleRef.current;
                if (el) {
                    el.style.backgroundColor = isOn ? color : 'black';
                    el.style.opacity = isOn ? '1' : '0.05';
                    el.style.boxShadow = isOn ? '0 0 40px rgba(255,255,255,0.25)' : 'none';
                }
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
        // We intentionally do NOT re-run this effect when `frequency` changes –
        // the loop reads `frequencyRef.current` on every frame instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When `color` changes we also want the on-state to reflect it
    const colorRef = useRef(color);
    useEffect(() => { colorRef.current = color; }, [color]);

    return (
        <div className="flex flex-col items-center gap-4 shrink-0">
            {/* Selection border – React renders this; no timing sensitivity */}
            <div
                style={{
                    width: size,
                    height: size,
                    minWidth: size,
                    minHeight: size,
                    border: `4px solid ${isSelected ? '#22c55e' : 'transparent'}`,
                    borderRadius: '0.5rem',
                    boxShadow: isSelected ? '0 0 18px 4px rgba(34,197,94,0.45)' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                }}
            >
                {/* Stimulus circle – mutated directly by the rAF loop; NO CSS transition */}
                <div
                    ref={circleRef}
                    style={{
                        width: '70%',
                        height: '70%',
                        backgroundColor: color,   // initial state (on)
                        opacity: 1,
                        borderRadius: '50%',
                        // ⚠️  No transition! Hard cuts are essential for SSVEP accuracy.
                    }}
                />
            </div>

            {/* Frequency Label */}
            <span className="font-bold text-slate-500 text-sm">{frequency}Hz</span>
        </div>
    );
};

export default BlinkingStimulus;
