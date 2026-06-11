package com.rajarani.game

import android.webkit.JavascriptInterface

/** Exposes device network info to the WebView JavaScript layer. */
class AndroidBridge(private val localIp: String, private val relayPort: Int) {

    @JavascriptInterface
    fun getLocalIp(): String = localIp

    @JavascriptInterface
    fun getRelayPort(): Int = relayPort

    /** Full WebSocket URL that other devices use to reach this device's relay. */
    @JavascriptInterface
    fun getRelayUrl(): String =
        if (localIp.isNotEmpty()) "ws://$localIp:$relayPort/gun" else ""
}
