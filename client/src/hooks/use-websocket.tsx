import { useEffect, useRef, useState } from "react";

export function useWebSocket(onMessage?: (data: any) => void) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<any>(null);
  const onMessageRef = useRef(onMessage);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Attempting WebSocket connection to: ${wsUrl}`);
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("WebSocket connected successfully");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        lastPongRef.current = Date.now(); // Reset pong timestamp
        
        // Restore last message after reconnection
        if (lastMessageRef.current) {
          setLastMessage(lastMessageRef.current);
        }
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Start health check interval - only monitor server pings
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Check if we haven't received a ping from server in the last 120 seconds
            const timeSinceLastPing = Date.now() - lastPongRef.current;
            if (timeSinceLastPing > 120000) {
              console.log("No server ping received for 120 seconds, closing connection");
              wsRef.current.close();
              return;
            }
          }
        }, 30000); // Check health every 30 seconds
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only log non-ping messages to reduce console noise
          if (data.type !== 'ping' && data.type !== 'pong') {
            console.log("WebSocket message received:", data);
          }
          
          // Handle ping messages from server - respond with pong
          if (data.type === 'ping') {
            lastPongRef.current = Date.now(); // Update last ping time
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          }
          
          lastMessageRef.current = data;
          setLastMessage(data);
          // Call onMessage callback immediately for direct processing
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Handle different close codes appropriately
        if (event.code === 1000 || event.code === 1001) {
          console.log("WebSocket closed normally, not attempting to reconnect.");
        } else if (event.code === 1006 || event.code === 1005) {
          // These are common on free hosting platforms like Render.com
          console.log(`WebSocket closed abnormally (code ${event.code}). This is common on free hosting platforms.`);
          
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            // Use more aggressive reconnection for platform-specific issues
            const delay = Math.min(2000 * reconnectAttemptsRef.current, 15000); // Slightly longer delays
            console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.log("Max reconnection attempts reached. The server may be experiencing issues.");
          }
        } else if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Other error codes
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log("Max reconnection attempts reached. Stopping reconnection attempts.");
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
        // Don't immediately try to reconnect on error - let the onclose handler handle it
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnected(false);
      // Only attempt to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        console.log(`Retrying WebSocket connection (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  };

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // Remove dependency on connect to prevent unnecessary reconnections

  return {
    lastMessage,
    isConnected,
    sendMessage: (message: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    }
  };
}
