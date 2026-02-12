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
    type: 'upload' | 'recording';
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

    // Classification Plot (Generic)
    getClassificationPlot: async (
        datasetId: string,
        channels: number[],
        timeStart: number,
        timeEnd: number,
        processorName: string,
        processorConfig: {
            frequencies: number[];
            window_sec: number;
            n_harmonics: number;
            [key: string]: any; // Allow other props
        },
        targetFrequency?: number | number[]
    ): Promise<{ image: string; metadata: any }> => {
        console.log(`🌐 API: Requesting ${processorName} plot:`, {
            datasetId,
            channels,
            timeStart,
            timeEnd,
            processorConfig,
            targetFrequency
        });

        const response = await api.post('/datasets/plot-classification', {
            dataset_id: datasetId,
            channels,
            time_start: timeStart,
            time_end: timeEnd,
            processor_name: processorName,
            processor_config: processorConfig,
            target_frequency: targetFrequency
        });

        console.log('🌐 API: Classification plot received successfully');
        return response.data;
    },
    // Streaming
    startStream: async (config: {
        window_size?: number;
        update_interval?: number;
        channels?: number[];
        tmsi_config?: {
            frequencies: number[];
            target_frequency?: number | number[] | null;
            n_harmonics?: number;
        };
    } = {}): Promise<{ status: string; message: string }> => {
        const response = await api.post('/stream/start', config);
        return response.data;
    },

    stopStream: async (): Promise<{ status: string; message: string }> => {
        const response = await api.post('/stream/stop');
        return response.data;
    },

    // Recording
    startRecording: async (filename?: string): Promise<{ status: string; message: string; filename?: string }> => {
        const response = await api.post('/stream/record/start', { filename });
        return response.data;
    },

    stopRecording: async (): Promise<{ status: string; message: string }> => {
        const response = await api.post('/stream/record/stop');
        return response.data;
    },

    // WebSocket URL helper
    getStreamWebSocketURL: (): string => {
        // Replace http/https with ws/wss based on API_BASE_URL
        const baseUrl = API_BASE_URL.replace(/^http/, 'ws');
        return `${baseUrl}/ws/stream`;
    },
};
