package np.goldmandu.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import np.goldmandu.app.notify.Scheduler

class App : Application() {
  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    if (Prefs.alertsEnabled(this)) {
      Scheduler.ensureDaily(this)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL,
      getString(R.string.channel_rates),
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = getString(R.string.tagline)
      setShowBadge(false)
    }
    mgr.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL = "rates"
  }
}
