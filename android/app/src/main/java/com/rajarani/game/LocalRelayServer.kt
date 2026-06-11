package com.rajarani.game

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress

/**
 * Minimal Gun.js-compatible relay: broadcasts every incoming message
 * to all other connected peers. No internet required — runs entirely
 * on the local WiFi network.
 */
class LocalRelayServer(port: Int) : WebSocketServer(InetSocketAddress(port)) {

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {}

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {}

    override fun onMessage(conn: WebSocket, message: String) {
        for (client in connections) {
            if (client !== conn && client.isOpen) {
                try { client.send(message) } catch (e: Exception) { /* ignore disconnected client */ }
            }
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {}

    override fun onStart() {
        connectionLostTimeout = 60
    }
}
