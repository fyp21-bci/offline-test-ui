import React, { useState, useEffect } from 'react';
import { ApiService, type Processor } from '../../api/client';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Trash2, Settings } from 'lucide-react';

interface AlgorithmNode {
    id: string;
    processor: Processor;
    config: any;
    schema?: any; // internal use
}

interface AlgorithmChainProps {
    onRun: (chain: AlgorithmNode[]) => void;
    isProcessing: boolean;
    initialChain?: AlgorithmNode[];
    onChainChange?: (chain: AlgorithmNode[]) => void;
}

const AlgorithmChain: React.FC<AlgorithmChainProps> = ({ onRun, isProcessing, initialChain, onChainChange }) => {
    const [availableProcessors, setAvailableProcessors] = useState<Processor[]>([]);
    const [chain, setChain] = useState<AlgorithmNode[]>(initialChain || []);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Sync external chain changes
    useEffect(() => {
        if (initialChain) {
            setChain(initialChain);
        }
    }, [initialChain]);

    // Notify parent of chain changes
    useEffect(() => {
        if (onChainChange) {
            onChainChange(chain);
        }
    }, [chain, onChainChange]);

    // Fetch available processors on mount
    useEffect(() => {
        ApiService.listProcessors().then(setAvailableProcessors).catch(console.error);
    }, []);

    const addProcessor = async (processorName: string) => {
        const processor = availableProcessors.find(p => p.name === processorName);
        if (!processor) return;

        try {
            const schema = await ApiService.getProcessorConfig(processorName);
            const newNode: AlgorithmNode = {
                id: crypto.randomUUID(),
                processor,
                config: {},
                schema
            };
            setChain([...chain, newNode]);
            setSelectedNodeId(newNode.id);
        } catch (err) {
            console.error("Failed to load schema for", processorName, err);
        }
    };

    const removeProcessor = (id: string) => {
        setChain(chain.filter(n => n.id !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
    };

    const updateConfig = (id: string, newConfig: any) => {
        setChain(chain.map(n => n.id === id ? { ...n, config: newConfig } : n));
    };

    const selectedNode = chain.find(n => n.id === selectedNodeId);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {/* Left Column: Chain Builder */}
            <div className="md:col-span-1 space-y-4">
                <div className="card h-full flex flex-col">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-primary tracking-tight">
                        Algorithm Chain
                    </h3>

                    <div className="flex-1 space-y-2 overflow-y-auto mb-6">
                        {chain.length === 0 && (
                            <p className="text-sm text-muted text-center py-8 border border-dashed border-border-color rounded-lg">
                                No algorithms added yet
                            </p>
                        )}
                        {chain.map((node, index) => (
                            <div
                                key={node.id}
                                onClick={() => setSelectedNodeId(node.id)}
                                className={`p-4 rounded-lg border cursor-pointer flex items-center justify-between group transition-all duration-200 ${
                                    selectedNodeId === node.id
                                        ? 'border-accent bg-accent/10 shadow-lg'
                                        : 'border-border-color bg-bg-tertiary hover:border-accent hover:bg-bg-active'
                                }`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-black text-xs font-bold flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <span className={`font-semibold truncate ${selectedNodeId === node.id ? 'text-primary' : 'text-secondary'}`}>
                                        {node.processor.name}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeProcessor(node.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-error hover:bg-error/10 rounded-lg transition-all flex-shrink-0 ml-2"
                                    title="Remove"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-border-color">
                        <label className="block text-xs font-bold text-tertiary mb-3 uppercase tracking-wide">Add Algorithm</label>
                        <select
                            className="w-full h-12 text-base bg-bg-tertiary border-border-color hover:border-accent transition-colors rounded-lg px-3"
                            onChange={(e) => {
                                if (e.target.value) {
                                    addProcessor(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                        >
                            <option value="">Select Processor...</option>
                            {availableProcessors.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Right Column: Configuration */}
            <div className="md:col-span-2">
                <div className="card h-full">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-border-color">
                        <h3 className="text-2xl font-bold flex items-center gap-3 text-primary tracking-tight">
                            <Settings size={28} className="text-accent" />
                            Configuration
                        </h3>
                        {chain.length > 0 && (
                            <button
                                onClick={() => onRun(chain)}
                                disabled={isProcessing}
                                className={`btn btn-primary ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isProcessing ? 'PROCESSING...' : 'RUN ANALYSIS'}
                            </button>
                        )}
                    </div>

                    {selectedNode ? (
                        <div className="prose prose-invert max-w-none">
                            <div className="mb-8">
                                <h4 className="text-2xl font-bold text-accent mb-2 tracking-tight">{selectedNode.processor.name}</h4>
                                <p className="text-base text-secondary">{selectedNode.processor.description}</p>
                            </div>

                            <div className="form-container">
                                {/* RJSF Form */}
                                <Form
                                    schema={selectedNode.schema}
                                    uiSchema={{ "ui:submitButtonOptions": { norender: true } }}
                                    formData={selectedNode.config}
                                    onChange={(e) => updateConfig(selectedNode.id, e.formData)}
                                    validator={validator}
                                    className="rjsf-dark-theme"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted">
                            <Settings size={48} className="mb-4 opacity-20" />
                            <p className="text-base">Select an algorithm to configure parameters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlgorithmChain;
