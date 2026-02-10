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
}

const AlgorithmChain: React.FC<AlgorithmChainProps> = ({ onRun, isProcessing }) => {
    const [availableProcessors, setAvailableProcessors] = useState<Processor[]>([]);
    const [chain, setChain] = useState<AlgorithmNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
                    <h3 className="text-2xl font-bold mb-8 flex items-center gap-4 text-white">
                        Algorithm Chain
                    </h3>

                    <div className="flex-1 space-y-2 overflow-y-auto mb-4">
                        {chain.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-700 rounded">
                                No algorithms added. Add one to start.
                            </p>
                        )}
                        {chain.map((node, index) => (
                            <div
                                key={node.id}
                                onClick={() => setSelectedNodeId(node.id)}
                                className={`p-5 rounded-xl border-2 cursor-pointer flex items-center justify-between group transition-all duration-200 mb-3 ${selectedNodeId === node.id
                                    ? 'border-accent bg-slate-700 shadow-lg'
                                    : 'border-transparent bg-slate-800 hover:bg-slate-700'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-600 text-sm font-mono text-slate-300">
                                        {index + 1}
                                    </span>
                                    <span className="font-bold text-xl text-white">{node.processor.name}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeProcessor(node.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Remove"
                                >
                                    <Trash2 size={24} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-slate-700">
                        <label className="block text-sm font-bold text-slate-400 mb-3">ADD ALGORITHM</label>
                        <select
                            className="w-full mb-2 h-16 text-lg bg-slate-800 border-slate-700 hover:border-slate-500 transition-colors rounded-xl px-4"
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
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-700">
                        <h3 className="text-2xl font-bold flex items-center gap-4 text-white">
                            <Settings size={32} />
                            Configuration
                        </h3>
                        {chain.length > 0 && (
                            <button
                                onClick={() => onRun(chain)}
                                disabled={isProcessing}
                                className={`btn btn-primary px-8 py-4 text-xl ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isProcessing ? 'PROCESSING...' : 'RUN ANALYSIS'}
                            </button>
                        )}
                    </div>

                    {selectedNode ? (
                        <div className="prose prose-invert max-w-none">
                            <div className="mb-8">
                                <h4 className="text-2xl font-bold text-accent mb-2">{selectedNode.processor.name}</h4>
                                <p className="text-lg text-slate-400">{selectedNode.processor.description}</p>
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
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <Settings size={48} className="mb-4 opacity-20" />
                            <p>Select an algorithm block to configure parameters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlgorithmChain;
