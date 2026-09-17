package np.goldmandu.app.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import np.goldmandu.app.Prefs

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (
      action == Intent.ACTION_BOOT_COMPLETED ||
      action == Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      if (Prefs.alertsEnabled(context)) {
        Scheduler.ensureDaily(context)
      }
    }
  }
}
