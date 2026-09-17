package np.goldmandu.app

import android.content.Context
import android.content.SharedPreferences

object Prefs {
  private const val FILE = "goldmandu"

  private fun sp(c: Context): SharedPreferences =
    c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun alertsEnabled(c: Context): Boolean = sp(c).getBoolean("alerts", false)

  fun setAlertsEnabled(c: Context, on: Boolean) {
    sp(c).edit().putBoolean("alerts", on).apply()
  }

  fun lastNotifiedBs(c: Context): String = sp(c).getString("last_bs", "") ?: ""

  fun setLastNotifiedBs(c: Context, bs: String) {
    sp(c).edit().putString("last_bs", bs).apply()
  }

  fun cacheJson(c: Context, latest: String, history: String) {
    sp(c).edit().putString("latest", latest).putString("history", history).apply()
  }

  fun cachedLatest(c: Context): String? = sp(c).getString("latest", null)

  fun cachedHistory(c: Context): String? = sp(c).getString("history", null)
}
