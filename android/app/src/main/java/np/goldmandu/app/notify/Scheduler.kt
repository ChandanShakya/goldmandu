package np.goldmandu.app.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar
import java.util.TimeZone

/**
 * Daily 02:55 UTC ≈ 08:50 NPT — after the 02:45 UTC scrape.
 * AlarmManager only (no WorkManager) to keep the APK small.
 */
object Scheduler {
  private const val REQ = 1001

  // 02:55 UTC
  private val utcHour = 2
  private val utcMinute = 55

  fun ensureDaily(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pending(context)
    val next = nextUtcTrigger()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
      } else {
        am.setExact(AlarmManager.RTC_WAKEUP, next, pi)
      }
    } catch (_: SecurityException) {
      // Exact alarm permission denied (API 31+) — fall back to inexact.
      am.set(AlarmManager.RTC_WAKEUP, next, pi)
    }
  }

  fun cancel(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(pending(context))
  }

  private fun pending(context: Context): PendingIntent {
    val i = Intent(context, DailyReceiver::class.java)
    return PendingIntent.getBroadcast(
      context,
      REQ,
      i,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  internal fun nextUtcTrigger(): Long {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    cal.set(Calendar.HOUR_OF_DAY, utcHour)
    cal.set(Calendar.MINUTE, utcMinute)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    if (cal.timeInMillis <= System.currentTimeMillis()) {
      cal.add(Calendar.DAY_OF_YEAR, 1)
    }
    return cal.timeInMillis
  }
}
