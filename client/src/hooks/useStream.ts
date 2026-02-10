import { useState, useEffect, useRef, useCallback } from 'react';
import { ApiService } from '../api/client';

export interface StreamPayload {
    type: 'raw' | 'fft' | 'classification' | 'combined'; // Adjust based on actual backend format
    data: any;
    timestamp: number;
}

export const useStream = (autoConnect = false) => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [latestData, setLatestData] = useState<any>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const url = ApiService.getStreamWebSocketURL();
            console.log('🔌 Connecting to WebSocket:', url);
            const socket = new WebSocket(url);

            socket.onopen = () => {
                console.log('✅ WebSocket Connected');
                setIsConnected(true);
                setError(null);
            };

            socket.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    // console.log('📨 WS Message:', parsed); 
                    // Update state with latest payload. 
                    // Note: Ideally, we might want to segregate data (raw vs fft vs class) 
                    // depending on payload structure. For now, assuming raw/mixed.
                    setLatestData(parsed);
                } catch (e) {
                    console.error('❌ Failed to parse WS message:', e);
                }
            };

            socket.onclose = () => {
                console.log('🔌 WebSocket Disconnected');
                setIsConnected(false);
            };

            socket.onerror = (evt) => {
                console.error('❌ WebSocket Error:', evt);
                setError('Connection error');
            };

            wsRef.current = socket;
        } catch (err: any) {
            setError(err.message || 'Failed to connect');
        }
    }, []);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    useEffect(() => {
        if (autoConnect) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    // Triggers backend stream start/stop
    const startStreaming = async (config?: any) => {
        try {
            await ApiService.startStream(config);
            connect(); // Ensure WS is open
        } catch (err: any) {
            setError(err.message || 'Failed to start stream');
        }
    };

    const stopStreaming = async () => {
        try {
            await ApiService.stopStream();
            disconnect();
        } catch (err: any) {
            // setError(err.message); // Don't block on stop error
            console.error(err);
        }
    };

    return {
        isConnected,
        error,
        latestData,
        connect,
        disconnect,
        startStreaming,
        stopStreaming
    };
};
