package np.goldmandu.app

import android.graphics.Typeface
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import np.goldmandu.app.data.Api
import np.goldmandu.app.data.History
import np.goldmandu.app.data.HistoryPoint
import np.goldmandu.app.data.Parser
import np.goldmandu.app.ui.MetalSeries
import np.goldmandu.app.ui.SparklineView
import java.util.Locale

class HistoryActivity : AppCompatActivity() {

  private lateinit var spark: SparklineView
  private lateinit var statLow: TextView
  private lateinit var statNow: TextView
  private lateinit var statHigh: TextView
  private lateinit var selDate: TextView
  private lateinit var selFine: TextView
  private lateinit var selTejabi: TextView
  private lateinit var selSilver: TextView
  private lateinit var selFineDelta: TextView
  private lateinit var tabFine: TextView
  private lateinit var tabTejabi: TextView
  private lateinit var tabSilver: TextView

  private var historyPoints: List<HistoryPoint> = emptyList()
  private var series = MetalSeries.FINE

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_history)
    Insets.apply(this, findViewById(android.R.id.content))

    spark = findViewById(R.id.spark)
    statLow = findViewById(R.id.statLow)
    statNow = findViewById(R.id.statNow)
    statHigh = findViewById(R.id.statHigh)
    selDate = findViewById(R.id.selDate)
    selFine = findViewById(R.id.selFine)
    selTejabi = findViewById(R.id.selTejabi)
    selSilver = findViewById(R.id.selSilver)
    selFineDelta = findViewById(R.id.selFineDelta)
    tabFine = findViewById(R.id.tabFine)
    tabTejabi = findViewById(R.id.tabTejabi)
    tabSilver = findViewById(R.id.tabSilver)

    findViewById<TextView>(R.id.subtitle).text = getString(R.string.history_hint)
    findViewById<View>(R.id.back).setOnClickListener { finish() }

    tabFine.setOnClickListener { selectSeries(MetalSeries.FINE) }
    tabTejabi.setOnClickListener { selectSeries(MetalSeries.TEJABI) }
    tabSilver.setOnClickListener { selectSeries(MetalSeries.SILVER) }

    spark.onPointSelected = { idx -> bindSelection(idx) }

    Prefs.cachedHistory(this)?.let { raw ->
      runCatching { Parser.parseHistory(raw) }.onSuccess(::bind) }
    load()
  }

  private fun selectSeries(m: MetalSeries) {
    series = m
    spark.setSeries(m)
    styleTabs()
    bindStats()
    bindSelection(spark.selectedIndex())
  }

  private fun styleTabs() {
    val selectedBg = R.drawable.bg_tab_selected
    val idleBg = R.drawable.bg_tab
    val paper = ContextCompat.getColor(this, R.color.paper)
    val ink = ContextCompat.getColor(this, R.color.ink)
    tabFine.apply {
      setBackgroundResource(if (series == MetalSeries.FINE) selectedBg else idleBg)
      setTextColor(if (series == MetalSeries.FINE) paper else ink)
    }
    tabTejabi.apply {
      setBackgroundResource(if (series == MetalSeries.TEJABI) selectedBg else idleBg)
      setTextColor(if (series == MetalSeries.TEJABI) paper else ink)
    }
    tabSilver.apply {
      setBackgroundResource(if (series == MetalSeries.SILVER) selectedBg else idleBg)
      setTextColor(if (series == MetalSeries.SILVER) paper else ink)
    }
  }

  private fun load() {
    Thread {
      try {
        val raw = Api.fetchHistory()
        Prefs.cacheJson(this, Prefs.cachedLatest(this) ?: "{}", raw)
        val history = Parser.parseHistory(raw)
        runOnUiThread { bind(history) }
      } catch (_: Exception) {
        // Keep cache if present.
      }
    }.start()
  }

  private fun bind(history: History) {
    historyPoints = history.points
    spark.setSeries(series)
    spark.setPoints(historyPoints, selectLast = true)
    styleTabs()
    if (historyPoints.isEmpty()) {
      selDate.text = "—"
      selFine.text = "Rs. —"
      selTejabi.text = "Rs. —"
      selSilver.text = "Rs. —"
      selFineDelta.text = ""
      return
    }
    bindStats()
    bindSelection(historyPoints.lastIndex)
  }

  private fun seriesValues(): List<Double> = historyPoints.map { p ->
    when (series) {
      MetalSeries.FINE -> p.fine
      MetalSeries.TEJABI -> p.tejabi ?: p.fine
      MetalSeries.SILVER -> p.silver ?: 0.0
    }
  }

  private fun bindStats() {
    val vals = seriesValues().filter { it > 0 }
    if (vals.isEmpty()) {
      statLow.text = "Rs. —"
      statHigh.text = "Rs. —"
      statNow.text = "Rs. —"
      return
    }
    statLow.text = "Rs. ${Npr.format(vals.min())}"
    statHigh.text = "Rs. ${Npr.format(vals.max())}"
    statNow.text = "Rs. ${Npr.format(vals.last())}"
  }

  private fun bindSelection(index: Int) {
    if (index !in historyPoints.indices) return
    val p = historyPoints[index]
    val unit = getString(R.string.per_tola)

    selDate.text = p.dateLabel
    selFine.text = "Rs. ${Npr.format(p.fine)} $unit"
    selTejabi.text = p.tejabi?.let { "Rs. ${Npr.format(it)} $unit" } ?: "—"
    selSilver.text = p.silver?.let { "Rs. ${Npr.format(it)} $unit" } ?: "—"

    val curr = when (series) {
      MetalSeries.FINE -> p.fine
      MetalSeries.TEJABI -> p.tejabi ?: p.fine
      MetalSeries.SILVER -> p.silver ?: return
    }
    if (index > 0) {
      val prevP = historyPoints[index - 1]
      val prev = when (series) {
        MetalSeries.FINE -> prevP.fine
        MetalSeries.TEJABI -> prevP.tejabi ?: prevP.fine
        MetalSeries.SILVER -> prevP.silver ?: 0.0
      }
      val chg = curr - prev
      val pct = if (prev > 0) (chg / prev) * 100.0 else null
      val arrow = if (chg > 0.5) "↑" else if (chg < -0.5) "↓" else "·"
      val pctText = pct?.let { String.format(Locale.US, " (%.2f%%)", kotlin.math.abs(it)) } ?: ""
      selFineDelta.text = "$arrow ${Npr.signed(chg)}$pctText"
      val color = when {
        chg > 0.5 -> R.color.up
        chg < -0.5 -> R.color.down
        else -> R.color.muted
      }
      selFineDelta.setTextColor(ContextCompat.getColor(this, color))
      selFineDelta.typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
      selFineDelta.visibility = View.VISIBLE
    } else {
      selFineDelta.visibility = View.GONE
    }
  }
}
