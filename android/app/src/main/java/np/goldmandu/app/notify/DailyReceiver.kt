package np.goldmandu.app.notify

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import np.goldmandu.app.App
import np.goldmandu.app.MainActivity
import np.goldmandu.app.Npr
import np.goldmandu.app.Prefs
import np.goldmandu.app.R
import np.goldmandu.app.data.Api
import np.goldmandu.app.data.Parser

class DailyReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    Thread {
      try {
        maybeNotify(context)
      } finally {
        Scheduler.ensureDaily(context)
        pending.finish()
      }
    }.start()
  }

  private fun maybeNotify(context: Context) {
    if (!Prefs.alertsEnabled(context)) return
    if (Build.VERSION.SDK_INT >= 33) {
      val ok = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
      if (!ok) return
    }

    val latestRaw = try {
      Api.fetchLatest()
    } catch (_: Exception) {
      Prefs.cachedLatest(context) ?: return
    }

    Prefs.cacheJson(context, latestRaw, Prefs.cachedHistory(context) ?: "[]")
    val latest = try {
      Parser.parseLatest(latestRaw)
    } catch (_: Exception) {
      return
    }

    if (latest.bs == Prefs.lastNotifiedBs(context)) return

    val chg = latest.change.fineTola
    val pct = latest.change.finePct
    val arrow = when {
      chg == null -> ""
      chg > 0 -> " ↑"
      chg < 0 -> " ↓"
      else -> ""
    }
    val pctText = if (pct != null) String.format(" (%.2f%%)", pct) else ""
    val body = buildString {
      append("Fine Rs. ")
      append(Npr.format(latest.fineGoldTola))
      append("/tola")
      append(arrow)
      append(Npr.signed(chg ?: 0).let { if (chg != null && chg != 0.0) " " + it else "" })
      append(pctText)
      append(" · Silver Rs. ")
      append(Npr.format(latest.silverTola))
      append("/tola · ")
      append(latest.bs)
    }

    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, App.CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_gold)
      .setContentTitle(context.getString(R.string.notif_title))
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(open)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .build()

    NotificationManagerCompat.from(context).notify(2001, notification)
    Prefs.setLastNotifiedBs(context, latest.bs)
  }
}
