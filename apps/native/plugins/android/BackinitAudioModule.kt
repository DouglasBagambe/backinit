package live.backinit.player

import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper

/** Mutes one complete browser surface, including its cross-origin frames. */
class BackinitAudioModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "BackinitAudio"

  @ReactMethod
  fun setMuted(reactTag: Int, muted: Boolean, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val manager = UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, reactTag)
        val webView = findWebView(manager?.resolveView(reactTag))
        if (webView == null) {
          promise.reject("PLAYER_NOT_READY", "The player view is not mounted")
          return@runOnUiThread
        }
        val supported = WebViewFeature.isFeatureSupported(WebViewFeature.MUTE_AUDIO)
        val result = Arguments.createMap()
        result.putBoolean("supported", supported)
        if (supported) {
          WebViewCompat.setAudioMuted(webView, muted)
          val actual = WebViewCompat.isAudioMuted(webView)
          result.putBoolean("muted", actual)
          Log.i("backinitAudio", "view=$reactTag muted=$actual supported=true")
        }
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("PLAYER_AUDIO_FAILED", error.message, error)
      }
    }
  }

  private fun findWebView(view: View?): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        findWebView(view.getChildAt(index))?.let { return it }
      }
    }
    return null
  }
}
