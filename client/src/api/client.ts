import axios from 'axios';

// Base URL configuration (assumes proxy or CORS handling)
const API_BASE_URL = 'http://localhost:8000'; // Default, can be env var

export const api = axios.create({
    baseURL: API_BASE_URL,
});

// Types based on API Specification
export interface Dataset {
    id: string;
    filename: string;
    size_bytes: number;
}

export interface Processor {
    name: string;
    description: string;
    result_type: 'classification' | 'spectrum' | string;
}

export interface ProcessorConfig {
    [key: string]: any; // JSON Schema structure
}

export interface AnalysisResult {
    type: string;
    data: {
        // Spectrum
        frequencies?: number[];
        magnitudes?: number[];
        n_channels_averaged?: number;
        // Classification
        best_frequency?: number;
        scores?: Record<string, number>;
        confidence?: number;
        // General
        [key: string]: any;
    };
}

// ... (previous interfaces)

export interface SignalDataResponse {
    dataset_id: string;
    fs: number;
    channels: string[];
    data: number[][];
}

// API Methods
export const ApiService = {
    // Datasets
    getDatasetData: async (datasetId: string): Promise<SignalDataResponse> => {
        const response = await api.get<SignalDataResponse>(`/datasets/${datasetId}/data`);
        return response.data;
    },

    uploadDataset: async (file: File): Promise<Dataset> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<Dataset>('/datasets/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    listDatasets: async (): Promise<Dataset[]> => {
        const response = await api.get<Dataset[]>('/datasets');
        return response.data;
    },

    // Processors
    listProcessors: async (): Promise<Processor[]> => {
        const response = await api.get<Processor[]>('/processors');
        return response.data;
    },

    getProcessorConfig: async (name: string): Promise<any> => {
        const response = await api.get(`/processors/${name}/config`);
        return response.data;
    },

    // Analysis
    runAnalysis: async (datasetId: string, processorName: string, config: any): Promise<AnalysisResult> => {
        const response = await api.post<AnalysisResult>('/analysis/run', {
            dataset_id: datasetId,
            processor_name: processorName,
            config,
        });
        return response.data;
    },

    // Plot Generation
    getPlotImage: async (
        datasetId: string,
        channels: number[],
        timeStart: number,
        timeEnd: number,
        width?: number,
        plotType?: 'time' | 'fft'
    ): Promise<string> => {
        console.log('🌐 API: Requesting plot from backend:', {
            datasetId,
            channels,
            time_start: timeStart,
            time_end: timeEnd,
            duration: timeEnd - timeStart
        });

        const response = await api.post(
            '/datasets/plot',
            {
                dataset_id: datasetId,
                channels,
                time_start: timeStart,
                time_end: timeEnd,
                width: width || 1200, // Default to 1200px if not provided
                plot_type: plotType || 'time', // Default to time-domain
            },
            {
                responseType: 'blob', // Important: receive binary data
            }
        );

        // Convert blob to URL for displaying in img tag
        const imageUrl = URL.createObjectURL(response.data);
        console.log('🌐 API: Plot image received successfully');
        return imageUrl;
    },

    // TMSI Classification Plot
    getClassificationPlot: async (
        datasetId: string,
        channels: number[],
        timeStart: number,
        timeEnd: number,
        processorConfig: {
            frequencies: number[];
            window_sec: number;
            n_harmonics: number;
            [key: string]: any; // Allow other props but filter them out
        },
        targetFrequency?: number | number[]
    ): Promise<{ image: string; metadata: any }> => {
        console.log('🌐 API: Requesting TMSI classification plot:', {
            datasetId,
            channels,
            timeStart,
            timeEnd,
            processorConfig,
            targetFrequency
        });

        // Extract only the fields expected by the backend for processor_config
        const { frequencies, window_sec, n_harmonics } = processorConfig;

        const response = await api.post('/datasets/plot-classification', {
            dataset_id: datasetId,
            channels,
            time_start: timeStart,
            time_end: timeEnd,
            processor_name: 'TMSI Classifier',
            processor_config: {
                frequencies,
                window_sec,
                n_harmonics
            },
            target_frequency: targetFrequency
        });

        console.log('🌐 API: Classification plot received successfully');
        return response.data;
    },
};
