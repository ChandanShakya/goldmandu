package np.goldmandu.app.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DailyReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    Thread {
      try {
        Notifier.postLatest(context, force = true)
      } finally {
        Scheduler.ensureDaily(context)
        pending.finish()
      }
    }.start()
  }
}
