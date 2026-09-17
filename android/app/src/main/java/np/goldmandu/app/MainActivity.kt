package np.goldmandu.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import np.goldmandu.app.data.Api
import np.goldmandu.app.data.Latest
import np.goldmandu.app.data.Parser
import np.goldmandu.app.notify.Scheduler

class MainActivity : AppCompatActivity() {

  private lateinit var swipe: SwipeRefreshLayout
  private lateinit var compact: LinearLayout
  private lateinit var status: TextView
  private lateinit var bsDate: TextView
  private lateinit var heroPrice: TextView
  private lateinit var heroDelta: TextView
  private lateinit var heroGram: TextView
  private lateinit var alertSwitch: SwitchCompat

  private val notifPermission =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      if (granted) Scheduler.ensureDaily(this)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    swipe = findViewById(R.id.swipe)
    compact = findViewById(R.id.compact)
    status = findViewById(R.id.status)
    bsDate = findViewById(R.id.bsDate)
    heroPrice = findViewById(R.id.heroPrice)
    heroDelta = findViewById(R.id.heroDelta)
    heroGram = findViewById(R.id.heroGram)
    alertSwitch = findViewById(R.id.alertSwitch)

    swipe.setColorSchemeColors(ContextCompat.getColor(this, R.color.accent))
    swipe.setOnRefreshListener { loadLatest() }

    findViewById<View>(R.id.historyLink).setOnClickListener {
      startActivity(Intent(this, HistoryActivity::class.java))
    }

    alertSwitch.isChecked = Prefs.alertsEnabled(this)
    alertSwitch.setOnCheckedChangeListener { _, on ->
      Prefs.setAlertsEnabled(this, on)
      if (on) {
        ensureNotifPermission()
        Scheduler.ensureDaily(this)
      } else {
        Scheduler.cancel(this)
      }
    }

    Prefs.cachedLatest(this)?.let { raw ->
      runCatching { Parser.parseLatest(raw) }.onSuccess { bindLatest(it, fromCache = true) }
    }
    loadLatest()
  }

  private fun ensureNotifPermission() {
    if (Build.VERSION.SDK_INT >= 33) {
      val ok = ContextCompat.checkSelfPermission(
        this,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
      if (!ok) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
  }

  private fun loadLatest() {
    Thread {
      try {
        val raw = Api.fetchLatest()
        val latest = Parser.parseLatest(raw)
        // Keep history cache warm for the chart screen when network is free.
        runCatching {
          val hist = Api.fetchHistory()
          Prefs.cacheJson(this, raw, hist)
        }.onFailure {
          Prefs.cacheJson(this, raw, Prefs.cachedHistory(this) ?: "[]")
        }
        runOnUiThread {
          bindLatest(latest, fromCache = false)
          swipe.isRefreshing = false
        }
      } catch (_: Exception) {
        runOnUiThread {
          status.text = if (Prefs.cachedLatest(this) == null) {
            getString(R.string.error_load)
          } else {
            getString(R.string.offline)
          }
          swipe.isRefreshing = false
        }
      }
    }.start()
  }

  private fun bindLatest(latest: Latest, fromCache: Boolean) {
    bsDate.text = latest.bs
    status.text = if (fromCache) {
      getString(R.string.offline)
    } else {
      getString(R.string.updated_fmt, latest.bs)
    }

    heroPrice.text = "Rs. ${Npr.format(latest.fineGoldTola)}"
    heroGram.text = "Rs. ${Npr.format(latest.fineGoldGram)} ${getString(R.string.per_gram)}"
    bindDelta(heroDelta, latest.change.fineTola, latest.change.finePct)

    compact.removeAllViews()
    addCompact(
      getString(R.string.tejabi_gold),
      latest.tejabiGoldTola,
      latest.tejabiGoldGram,
      latest.change.tejabiTola,
      latest.change.tejabiPct,
      addRule = false,
    )
    addRule()
    addCompact(
      getString(R.string.silver),
      latest.silverTola,
      latest.silverGram,
      latest.change.silverTola,
      latest.change.silverPct,
      addRule = true,
    )
  }

  private fun addRule() {
    val v = View(this)
    val h = (resources.displayMetrics.density + 0.5f).toInt()
    val side = (20 * resources.displayMetrics.density).toInt()
    v.layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      h,
    ).apply {
      marginStart = side
      marginEnd = side
    }
    v.setBackgroundColor(ContextCompat.getColor(this, R.color.hairline))
    compact.addView(v)
  }

  private fun addCompact(
    label: String,
    tola: Double?,
    gram: Double?,
    chg: Double?,
    chgPct: Double?,
    addRule: Boolean,
  ) {
    val row = LayoutInflater.from(this).inflate(R.layout.item_compact, compact, false)
    row.findViewById<TextView>(R.id.metalLabel).text = label
    row.findViewById<TextView>(R.id.priceTola).text = "Rs. ${Npr.format(tola)}"
    row.findViewById<TextView>(R.id.priceGram).text =
      "Rs. ${Npr.format(gram)} ${getString(R.string.per_gram)}"
    bindDelta(row.findViewById(R.id.delta), chg, chgPct)
    compact.addView(row)
  }

  private fun bindDelta(view: TextView, chg: Double?, chgPct: Double?) {
    if (chg == null) {
      view.text = ""
      return
    }
    val arrow = if (chg > 0) "↑" else if (chg < 0) "↓" else "·"
    val pct = chgPct?.let { String.format(" (%.2f%%)", it) } ?: ""
    view.text = "$arrow ${Npr.signed(chg)}$pct"
    val color = when {
      chg > 0 -> R.color.up
      chg < 0 -> R.color.down
      else -> R.color.muted
    }
    view.setTextColor(ContextCompat.getColor(this, color))
    view.typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
  }
}
