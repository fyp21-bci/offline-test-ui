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
                <h3 className="text-2xl font-bold flex items-center gap-3 text-primary tracking-tight">
                    <FileText size={28} className="text-accent" />
                    Data Files
                </h3>
                <label className={`btn btn-primary btn-sm gap-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <FileUp size={18} />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input type="file" className="hidden" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} accept=".txt,.csv" />
                </label>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 bg-bg-hover p-1 rounded-lg">
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${
                        filter === 'all' 
                            ? 'bg-accent text-black shadow-md' 
                            : 'text-secondary hover:text-primary hover:bg-bg-active'
                    }`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('upload')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${
                        filter === 'upload' 
                            ? 'bg-accent text-black shadow-md' 
                            : 'text-secondary hover:text-primary hover:bg-bg-active'
                    }`}
                >
                    Uploads
                </button>
                <button
                    onClick={() => setFilter('recording')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${
                        filter === 'recording' 
                            ? 'bg-accent text-black shadow-md' 
                            : 'text-secondary hover:text-primary hover:bg-bg-active'
                    }`}
                >
                    Recordings
                </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {datasets
                    .filter(ds => filter === 'all' || ds.type === filter)
                    .length === 0 && (
                        <p className="text-base text-muted text-center py-8">No datasets found.</p>
                    )}
                {datasets
                    .filter(ds => filter === 'all' || ds.type === filter)
                    .map(ds => (
                        <button
                            key={ds.id}
                            onClick={() => onSelect(ds.id)}
                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 border-2 ${
                                selectedId === ds.id
                                    ? 'bg-accent border-accent text-black font-semibold shadow-lg'
                                    : 'bg-bg-secondary border-border-dark hover:border-accent hover:shadow-md text-primary'
                            }`}
                        >
                            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                                <span className="truncate text-base font-semibold leading-tight">{ds.filename}</span>
                                <span className={`text-xs font-medium mt-1.5 ${selectedId === ds.id ? 'text-black/60' : 'text-secondary'}`}>
                                    {ds.type === 'recording' ? '🔴 Recording' : '📤 Upload'} • {(ds.size_bytes / 1024).toFixed(1)} KB
                                </span>
                            </div>
                            {selectedId === ds.id && <Check size={22} className="ml-3 flex-shrink-0 text-black" />}
                        </button>
                    ))}
            </div>
        </div>
    );
};

export default DatasetSelector;
