package com.rajarani.game

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import java.net.Inet4Address
import java.net.NetworkInterface

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var relayServer: LocalRelayServer? = null
    private val RELAY_PORT = 8765

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.web_view)
        startRelayServer()
        val localIp = getLocalIp()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_NO_CACHE
        }

        webView.addJavascriptInterface(AndroidBridge(localIp, RELAY_PORT), "AndroidBridge")
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        val html = assets.open("index.html").bufferedReader().readText()
        // Use http:// base URL so ws:// relay connections are not treated as mixed content
        webView.loadDataWithBaseURL(
            "http://rajarani.local/",
            html,
            "text/html",
            "UTF-8",
            null
        )

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else finish()
            }
        })
    }

    private fun startRelayServer() {
        try {
            relayServer = LocalRelayServer(RELAY_PORT)
            relayServer?.start()
            Log.i("RajaRani", "Local relay started on port $RELAY_PORT")
        } catch (e: Exception) {
            Log.e("RajaRani", "Failed to start relay server", e)
        }
    }

    private fun getLocalIp(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                val addrs = iface.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (!addr.isLoopbackAddress && addr is Inet4Address)
                        return addr.hostAddress ?: ""
                }
            }
        } catch (e: Exception) { }
        return ""
    }

    override fun onDestroy() {
        super.onDestroy()
        try { relayServer?.stop(100) } catch (e: Exception) { }
    }
}
