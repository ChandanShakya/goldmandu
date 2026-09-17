package np.goldmandu.app.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar
import java.util.TimeZone

/**
 * Daily 02:55 UTC ≈ 08:50 NPT — after the Fenegosida morning scrape.
 * Uses AlarmManager.setAlarmClock when possible (most reliable across OEMs).
 */
object Scheduler {
  private const val REQ = 1001
  private const val utcHour = 2
  private const val utcMinute = 55

  fun ensureDaily(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pending(context)
    val next = nextUtcTrigger()
    val show = PendingIntent.getActivity(
      context,
      0,
      Intent(context, np.goldmandu.app.MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    try {
      // setAlarmClock is exempt from Doze and is the most reliable exact timer.
      am.setAlarmClock(AlarmManager.AlarmClockInfo(next, show), pi)
    } catch (_: SecurityException) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
        } else {
          am.setExact(AlarmManager.RTC_WAKEUP, next, pi)
        }
      } catch (_: SecurityException) {
        am.set(AlarmManager.RTC_WAKEUP, next, pi)
      }
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
    cal.set(MILLISECOND_ZERO, 0)
    if (cal.timeInMillis <= System.currentTimeMillis()) {
      cal.add(Calendar.DAY_OF_YEAR, 1)
    }
    return cal.timeInMillis
  }

  // Avoid Calendar.MILLISECOND name clash readability
  private const val MILLISECOND_ZERO = Calendar.MILLISECOND
}
