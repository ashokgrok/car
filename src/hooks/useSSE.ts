import { useEffect, useState, useRef } from 'react';
import { soundAlerts } from '../utils/audioAlert';

export interface SSEEventPayload {
  type: string;
  payload?: any;
  timestamp?: string;
  event?: any;
}

export function useSSE(onEvent?: (event: SSEEventPayload) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEventPayload | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      try {
        es = new EventSource('/api/v1/stream/events');
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.onmessage = (e) => {
          try {
            const data: SSEEventPayload = JSON.parse(e.data);
            setLastEvent(data);

            // Trigger audio alerts based on event type & severity
            if (data.type === 'EVENT_PUBLISHED' && data.event) {
              const payload = data.event.payload || {};
              if (payload.final_severity === 'CRITICAL' || payload.sla_breach) {
                soundAlerts.playCriticalChime();
                soundAlerts.sendDesktopNotification(
                  'CRITICAL Connection at Risk!',
                  `Connection ${payload.connection_id || ''} has dropped to CRITICAL margin (${payload.connection_margin_minutes ?? ''}m).`
                );
              } else if (payload.final_severity === 'AT_RISK') {
                soundAlerts.playWarningChime();
              }
            } else if (data.type === 'OVERRIDE_APPLIED') {
              soundAlerts.playSuccessChime();
            } else if (data.type === 'CASES_BATCH_UPDATED') {
              soundAlerts.playSuccessChime();
            }

            if (onEventRef.current) {
              onEventRef.current(data);
            }
          } catch (err) {
            // Ignore parse errors (e.g. heartbeat ping)
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es?.close();
          // Auto-reconnect after 4s
          reconnectTimeout = setTimeout(connect, 4000);
        };
      } catch (err) {
        console.error('SSE connection error:', err);
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 4000);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (es) es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { isConnected, lastEvent };
}
