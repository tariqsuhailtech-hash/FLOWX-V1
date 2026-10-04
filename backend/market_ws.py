from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from hub import hub

router = APIRouter()


@router.websocket("/ws/market")
async def ws_market(ws: WebSocket):
    await ws.accept()
    session = None
    try:
        while True:
            msg = await ws.receive_json()
            action = msg.get("action")
            if action == "subscribe":
                if session:
                    session.clients.pop(ws, None)
                session = await hub.subscribe(
                    ws,
                    msg.get("exchange", "BINANCE"),
                    msg.get("symbol", "BTCUSDT"),
                    msg.get("marketType", "spot"),
                    msg.get("tf", "1m"),
                    int(msg.get("depth", 20)),
                )
                await ws.send_json(session.build_snapshot())
            elif action == "depth" and session:
                session.clients[ws] = int(msg.get("depth", 20))
            elif action == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.remove_client(ws)
