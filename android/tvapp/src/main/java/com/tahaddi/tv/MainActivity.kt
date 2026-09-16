package com.tahaddi.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

private const val TV_URL = "https://tahaddii.com/tv/"

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var errorView: View
    private lateinit var retryButton: Button
    private var mainFrameLoadFailed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(6, 3, 15))
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    if (!mainFrameLoadFailed && url.startsWith("https://tahaddii.com/")) {
                        showContent()
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    if (request.isForMainFrame) {
                        mainFrameLoadFailed = true
                        showNetworkError()
                    }
                }
            }
        }

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(6, 3, 15))
            addView(webView, matchParentLayoutParams())
        }
        errorView = createErrorView()
        root.addView(errorView, matchParentLayoutParams())
        setContentView(root)

        webView.loadUrl(TV_URL)
        webView.requestFocus()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (errorView.visibility == View.VISIBLE &&
            (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER)) {
            retry()
            return true
        }

        if (keyCode == KeyEvent.KEYCODE_MENU) {
            retry()
            return true
        }

        return super.onKeyDown(keyCode, event)
    }

    @Suppress("DEPRECATION")
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    private fun retry() {
        mainFrameLoadFailed = false
        errorView.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(TV_URL)
        webView.requestFocus()
    }

    private fun showContent() {
        errorView.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.requestFocus()
    }

    private fun showNetworkError() {
        webView.visibility = View.GONE
        errorView.visibility = View.VISIBLE
        retryButton.requestFocus()
    }

    private fun createErrorView(): View {
        val density = resources.displayMetrics.density
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding((48 * density).toInt(), 0, (48 * density).toInt(), 0)
            setBackgroundColor(Color.rgb(6, 3, 15))
        }

        content.addView(TextView(this).apply {
            text = getString(R.string.network_error_title)
            textSize = 32f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        })

        content.addView(TextView(this).apply {
            text = getString(R.string.network_error_message)
            textSize = 20f
            setTextColor(Color.rgb(196, 181, 253))
            gravity = Gravity.CENTER
            setPadding(0, (18 * density).toInt(), 0, (32 * density).toInt())
        })

        retryButton = Button(this).apply {
            text = getString(R.string.retry)
            textSize = 20f
            isFocusable = true
            setOnClickListener { retry() }
        }
        content.addView(
            retryButton,
            LinearLayout.LayoutParams((280 * density).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT),
        )
        content.visibility = View.GONE
        return content
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    private fun matchParentLayoutParams() = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
    )
}