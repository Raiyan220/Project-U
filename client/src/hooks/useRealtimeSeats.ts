import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SeatUpdate {
    sectionId: string;
    courseCode: string;
    sectionNumber: string;
    enrolled: number;
    capacity: number;
    available: number;
    status: string;
}

interface SyncComplete {
    timestamp: string;
    totalSections: number;
    updatedSections: number;
}

interface UseRealtimeSeatsOptions {
    onSeatUpdate?: (updates: SeatUpdate[]) => void;
    onSyncComplete?: (stats: SyncComplete) => void;
    onConnectionChange?: (connected: boolean) => void;
}

export function useRealtimeSeats(options: UseRealtimeSeatsOptions = {}) {
    const socketRef = useRef<Socket | null>(null);
    const optionsRef = useRef(options);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Update options ref so we always have the latest callbacks without triggering re-effects
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const connect = useCallback(() => {
        if (socketRef.current?.connected) return;

        const serverUrl = import.meta.env.VITE_API_URL || 'https://uniflow-backend-o9z8.onrender.com';

        socketRef.current = io(`${serverUrl}/courses`, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketRef.current.on('connect', () => {
            console.log('🔌 WebSocket connected for real-time updates');
            setIsConnected(true);
            optionsRef.current.onConnectionChange?.(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔌 WebSocket disconnected');
            setIsConnected(false);
            optionsRef.current.onConnectionChange?.(false);
        });

        socketRef.current.on('seatUpdates', (data: { timestamp: string; updates: SeatUpdate[] }) => {
            console.log(`📊 Received ${data.updates.length} seat updates`);
            setLastUpdate(new Date(data.timestamp));
            optionsRef.current.onSeatUpdate?.(data.updates);
        });

        socketRef.current.on('syncComplete', (data: SyncComplete) => {
            console.log(`✅ Sync complete: ${data.updatedSections} sections updated`);
            setLastUpdate(new Date(data.timestamp));
            optionsRef.current.onSyncComplete?.(data);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });
    }, []); // No dependencies, stable across renders

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        isConnected,
        lastUpdate,
        reconnect: connect,
    };
}
