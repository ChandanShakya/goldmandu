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

  private var historyPoints: List<HistoryPoint> = emptyList()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_history)

    spark = findViewById(R.id.spark)
    statLow = findViewById(R.id.statLow)
    statNow = findViewById(R.id.statNow)
    statHigh = findViewById(R.id.statHigh)
    selDate = findViewById(R.id.selDate)
    selFine = findViewById(R.id.selFine)
    selTejabi = findViewById(R.id.selTejabi)
    selSilver = findViewById(R.id.selSilver)
    selFineDelta = findViewById(R.id.selFineDelta)

    findViewById<TextView>(R.id.subtitle).text = getString(R.string.history_hint)
    findViewById<View>(R.id.back).setOnClickListener { finish() }

    spark.onPointSelected = { idx -> bindSelection(idx) }

    Prefs.cachedHistory(this)?.let { raw ->
      runCatching { Parser.parseHistory(raw) }.onSuccess(::bind) }
    load()
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
    spark.setPoints(historyPoints, selectLast = true)
    if (historyPoints.isEmpty()) {
      selDate.text = "—"
      selFine.text = "Rs. —"
      selTejabi.text = "Rs. —"
      selSilver.text = "Rs. —"
      selFineDelta.text = ""
      return
    }
    val fine = historyPoints.map { it.fine }
    statLow.text = "Rs. ${Npr.format(fine.min())}"
    statHigh.text = "Rs. ${Npr.format(fine.max())}"
    statNow.text = "Rs. ${Npr.format(fine.last())}"
    bindSelection(historyPoints.lastIndex)
  }

  private fun bindSelection(index: Int) {
    if (index !in historyPoints.indices) return
    val p = historyPoints[index]
    val unit = getString(R.string.per_tola)

    selDate.text = p.dateLabel
    selFine.text = "Rs. ${Npr.format(p.fine)} $unit"
    selTejabi.text = p.tejabi?.let { "Rs. ${Npr.format(it)} $unit" } ?: "—"
    selSilver.text = p.silver?.let { "Rs. ${Npr.format(it)} $unit" } ?: "—"

    if (index > 0) {
      val prev = historyPoints[index - 1].fine
      val chg = p.fine - prev
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
