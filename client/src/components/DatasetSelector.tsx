import React, { useEffect, useState } from 'react';
import { ApiService, type Dataset } from '../api/client';
import { FileUp, FileText, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatasetSelectorProps {
    onSelect: (datasetId: string) => void;
    selectedId: string | null;
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({ onSelect, selectedId }) => {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [uploading, setUploading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'upload' | 'recording'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        loadDatasets();
    }, []);

    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filter]);

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

    // Filtered datasets
    const filteredDatasets = datasets.filter(ds => filter === 'all' || ds.type === filter);
    
    // Pagination logic
    const totalPages = Math.ceil(filteredDatasets.length / ITEMS_PER_PAGE);
    const paginatedDatasets = filteredDatasets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${filter === 'all'
                            ? 'bg-accent text-black shadow-md'
                            : 'text-secondary hover:text-primary hover:bg-bg-active'
                        }`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('upload')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${filter === 'upload'
                            ? 'bg-accent text-black shadow-md'
                            : 'text-secondary hover:text-primary hover:bg-bg-active'
                        }`}
                >
                    Uploads
                </button>
                <button
                    onClick={() => setFilter('recording')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-200 ${filter === 'recording'
                            ? 'bg-accent text-black shadow-md'
                            : 'text-secondary hover:text-primary hover:bg-bg-active'
                        }`}
                >
                    Recordings
                </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
                {paginatedDatasets.length === 0 && (
                    <p className="text-base text-muted text-center py-8">No datasets found.</p>
                )}
                {paginatedDatasets.map(ds => (
                    <button
                        key={ds.id}
                        onClick={() => onSelect(ds.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 border-2 ${selectedId === ds.id
                                ? 'bg-accent border-accent font-semibold shadow-lg'
                                : 'bg-gray-100 border-border-dark hover:border-accent hover:shadow-md text-black'
                            }`}
                    >
                        <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                            <span className="truncate text-base font-semibold leading-tight text-black">{ds.filename}</span>
                            <span className={`text-xs font-medium mt-1.5 ${selectedId === ds.id ? 'text-black/60' : 'text-gray-600'}`}>
                                {ds.type === 'recording' ? '🔴 Recording' : '📤 Upload'} • {(ds.size_bytes / 1024).toFixed(1)} KB
                            </span>
                        </div>
                        {selectedId === ds.id && <Check size={22} className="ml-3 flex-shrink-0 text-black" />}
                    </button>
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-border-color">
                    {/* Previous Button */}
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${currentPage === 1
                                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                : 'bg-white border-gray-200 text-black hover:bg-gray-50 hover:border-accent'
                            }`}
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Page Numbers */}
                    {(() => {
                        const pages = [];
                        const maxVisible = 7;
                        if (totalPages <= maxVisible) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                            pages.push(1);
                            let start = Math.max(2, currentPage - 1);
                            let end = Math.min(totalPages - 1, currentPage + 1);
                            
                            if (start > 2) pages.push('...');
                            for (let i = start; i <= end; i++) pages.push(i);
                            if (end < totalPages - 1) pages.push('...');
                            
                            pages.push(totalPages);
                        }

                        return pages.map((page, i) => (
                            page === '...' ? (
                                <span key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center text-gray-400">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page as number)}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-extrabold transition-all shadow-sm border ${currentPage === page
                                            ? 'bg-accent border-accent text-black transform scale-105'
                                            : 'bg-white border-gray-200 text-black hover:bg-gray-50 hover:border-accent'
                                        }`}
                                >
                                    {page}
                                </button>
                            )
                        ));
                    })()}

                    {/* Next Button */}
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${currentPage === totalPages
                                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                : 'bg-white border-gray-200 text-black hover:bg-gray-50 hover:border-accent'
                            }`}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default DatasetSelector;
