package np.goldmandu.app.notify

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
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
import np.goldmandu.app.data.Latest
import np.goldmandu.app.data.Parser

/** Sticky daily-rate notification (ongoing until user turns alerts off). */
object Notifier {
  const val ID = 2001

  fun cancel(context: Context) {
    NotificationManagerCompat.from(context).cancel(ID)
  }

  fun canPost(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33) {
      return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
    }
    return NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  /** Fetch (or cache) rates and post/update the sticky notification. */
  fun postLatest(context: Context, force: Boolean = false) {
    if (!Prefs.alertsEnabled(context)) return
    if (!canPost(context)) return

    Thread {
      val latest = fetchLatest(context) ?: return@Thread
      if (!force && latest.bs == Prefs.lastNotifiedBs(context) && isPosted(context)) {
        // Already sticky for this BS day — still refresh text.
      }
      val n = build(context, latest)
      try {
        NotificationManagerCompat.from(context).notify(ID, n)
        Prefs.setLastNotifiedBs(context, latest.bs)
      } catch (_: SecurityException) {
        // Permission revoked mid-flight.
      }
    }.start()
  }

  private fun isPosted(context: Context): Boolean = true

  fun fetchLatest(context: Context): Latest? {
    val raw = try {
      Api.fetchLatest()
    } catch (_: Exception) {
      Prefs.cachedLatest(context) ?: return null
    }
    Prefs.cacheJson(context, raw, Prefs.cachedHistory(context) ?: "[]")
    return try {
      Parser.parseLatest(raw)
    } catch (_: Exception) {
      null
    }
  }

  fun build(context: Context, latest: Latest): Notification {
    val chg = latest.change.fineTola
    val pct = latest.change.finePct
    val arrow = when {
      chg == null -> ""
      chg > 0.5 -> " ↑"
      chg < -0.5 -> " ↓"
      else -> ""
    }
    val pctText = if (pct != null && chg != null && kotlin.math.abs(chg) > 0.5) {
      String.format(" (%.2f%%)", kotlin.math.abs(pct))
    } else {
      ""
    }
    val body = buildString {
      append("Fine Rs. ")
      append(Npr.format(latest.fineGoldTola))
      append("/tola")
      append(arrow)
      if (chg != null && kotlin.math.abs(chg) > 0.5) {
        append(' ')
        append(Npr.signed(chg))
      }
      append(pctText)
      append("\nTejabi Rs. ")
      append(Npr.format(latest.tejabiGoldTola))
      append(" · Silver Rs. ")
      append(Npr.format(latest.silverTola))
      append(" · ")
      append(latest.bs)
    }

    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(context, App.CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_gold)
      .setContentTitle(context.getString(R.string.notif_title))
      .setContentText("Fine Rs. ${Npr.format(latest.fineGoldTola)}/tola · ${latest.bs}")
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(open)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .build()
  }
}
