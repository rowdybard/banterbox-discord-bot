import { useEffect, useRef, useState } from "react";

export function useWebSocket(onMessage?: (data: any) => void) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<any>(null);
  const onMessageRef = useRef(onMessage);

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        // Restore last message after reconnection
        if (lastMessageRef.current) {
          setLastMessage(lastMessageRef.current);
        }
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data);
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
      
      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect WebSocket...");
          connect();
        }, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      // Attempt to reconnect after 5 seconds on connection error
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Retrying WebSocket connection...");
        connect();
      }, 5000);
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
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

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
