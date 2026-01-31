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
        <div className="card h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-medium flex items-center gap-2">
                    <FileText size={20} />
                    Datasets
                </h3>
                <label className={`btn btn-outline text-sm px-3 py-1.5 gap-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <FileUp size={16} />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".txt,.csv" />
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
                        className={`w-full text-left px-4 py-3 rounded flex items-center justify-between transition-colors ${selectedId === ds.id
                            ? 'bg-purple-500/20 border border-purple-500/50 text-purple-200'
                            : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                            }`}
                    >
                        <span className="truncate text-base">{ds.filename}</span>
                        {selectedId === ds.id && <Check size={16} className="text-purple-400" />}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DatasetSelector;
