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

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {datasets.length === 0 && (
                    <p className="text-base text-gray-500 text-center py-6">No datasets found.</p>
                )}
                {datasets.map(ds => (
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
                        <span className="truncate text-xl font-medium">{ds.filename}</span>
                        {selectedId === ds.id && <Check size={28} className="text-black" />}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DatasetSelector;
