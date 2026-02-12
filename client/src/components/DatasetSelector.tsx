import React, { useEffect, useState } from 'react';
import { ApiService, type Dataset } from '../api/client';
import { FileUp, FileText, Check } from 'lucide-react';

interface DatasetSelectorProps {
    onSelect: (datasetId: string) => void;
    selectedId: string | null;
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({ onSelect, selectedId }) => {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [uploading, setUploading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'upload' | 'recording'>('all');

    useEffect(() => {
        loadDatasets();
    }, []);

    const loadDatasets = () => {
        ApiService.listDatasets().then(setDatasets).catch(console.error);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            try {
                await ApiService.uploadDataset(e.target.files[0]);
                loadDatasets();
            } catch (err) {
                console.error("Upload failed", err);
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <div className="card h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold flex items-center gap-4 text-white">
                    <FileText size={32} />
                    Data Files
                </h3>
                <label className={`btn btn-primary px-6 py-3 gap-3 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <FileUp size={24} />
                    {uploading ? 'Uploading...' : 'Upload New'}
                    <input type="file" className="hidden" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} accept=".txt,.csv" />
                </label>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 bg-slate-900/50 p-1 rounded-lg">
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('upload')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${filter === 'upload' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Uploads
                </button>
                <button
                    onClick={() => setFilter('recording')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${filter === 'recording' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Recordings
                </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {datasets
                    .filter(ds => filter === 'all' || ds.type === filter)
                    .length === 0 && (
                        <p className="text-base text-gray-500 text-center py-6">No datasets found.</p>
                    )}
                {datasets
                    .filter(ds => filter === 'all' || ds.type === filter)
                    .map(ds => (
                        <button
                            key={ds.id}
                            onClick={() => onSelect(ds.id)}
                            className={`w-full text-left px-6 py-5 rounded-xl flex items-center justify-between transition-all duration-200 border-2 mb-2 ${selectedId === ds.id
                                ? 'bg-accent border-accent text-black font-bold shadow-[0_0_20px_rgba(14,165,233,0.4)]'
                                : 'bg-transparent border-transparent hover:bg-slate-800/50 text-white opacity-80 hover:opacity-100'
                                }`}
                            style={{
                                backgroundColor: selectedId === ds.id ? 'var(--accent-color)' : 'transparent',
                                color: selectedId === ds.id ? '#000000' : '#ffffff'
                            }}
                        >
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate text-xl font-medium">{ds.filename}</span>
                                <span className="text-xs uppercase font-bold text-slate-400 mt-1 opacity-70">
                                    {ds.type === 'recording' ? 'Recording' : 'Upload'} • {(ds.size_bytes / 1024).toFixed(1)} KB
                                </span>
                            </div>
                            {selectedId === ds.id && <Check size={28} className="text-black" />}
                        </button>
                    ))}
            </div>
        </div>
    );
};

export default DatasetSelector;
