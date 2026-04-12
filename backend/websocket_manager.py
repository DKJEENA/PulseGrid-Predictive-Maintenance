import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")

class ConnectionManager:
    """Manages active WebSocket connections to broadcast live sensor data."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WS connection. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WS disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        failed_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error sending to WS client: {e}")
                failed_connections.append(connection)

        # Cleanup dead connections
        for conn in failed_connections:
            self.disconnect(conn)

    async def broadcast_json(self, data: dict):
        base_message = json.dumps(data)
        await self.broadcast(base_message)

manager = ConnectionManager()
