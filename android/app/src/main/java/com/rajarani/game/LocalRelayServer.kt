package com.rajarani.game

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap

class LocalRelayServer(port: Int) : WebSocketServer(InetSocketAddress(port)) {

    // Cache of latest room state per room code — sent to new joiners on "get"
    private val roomStates = ConcurrentHashMap<String, String>()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {}

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {}

    override fun onMessage(conn: WebSocket, message: String) {
        try {
            val json = JSONObject(message)
            val type = json.optString("type", "")
            val room = json.optString("room", "")

            if (type == "state" && room.isNotEmpty()) {
                roomStates[room] = message
            }

            if (type == "get" && room.isNotEmpty()) {
                roomStates[room]?.let {
                    try { conn.send(it) } catch (e: Exception) { }
                }
                return  // don't broadcast "get" to others
            }
        } catch (e: Exception) { }

        // Broadcast to all other connected clients
        for (client in connections) {
            if (client !== conn && client.isOpen) {
                try { client.send(message) } catch (e: Exception) { }
            }
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {}

    override fun onStart() {
        connectionLostTimeout = 60
    }
}
