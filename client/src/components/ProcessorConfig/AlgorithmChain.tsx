import React, { useState, useEffect } from 'react';
import { ApiService, type Processor } from '../../api/client';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Trash2, Settings, Plus } from 'lucide-react';

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
                    <h3 className="text-lg font-medium mb-4">Algorithm Chain</h3>

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
                                className={`p-3 rounded border cursor-pointer flex items-center justify-between group transition-colors ${selectedNodeId === node.id
                                    ? 'border-purple-500 bg-purple-500/10'
                                    : 'border-gray-700 hover:border-gray-500 bg-gray-800'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-gray-500">{index + 1}</span>
                                    <span className="font-medium text-sm">{node.processor.name}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeProcessor(node.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
                                    title="Remove"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Add Algorithm</label>
                        <select
                            className="w-full mb-2"
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
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-medium flex items-center gap-2">
                            <Settings size={18} />
                            Configuration
                        </h3>
                        {chain.length > 0 && (
                            <button
                                onClick={() => onRun(chain)}
                                disabled={isProcessing}
                                className={`btn btn-primary ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isProcessing ? 'Processing...' : 'Run Analysis'}
                            </button>
                        )}
                    </div>

                    {selectedNode ? (
                        <div className="prose prose-invert max-w-none">
                            <div className="mb-4">
                                <h4 className="text-md font-medium text-purple-400">{selectedNode.processor.name}</h4>
                                <p className="text-sm text-gray-400">{selectedNode.processor.description}</p>
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
