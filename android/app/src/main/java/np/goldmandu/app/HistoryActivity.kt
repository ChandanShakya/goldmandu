package np.goldmandu.app

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import np.goldmandu.app.data.Api
import np.goldmandu.app.data.Parser
import np.goldmandu.app.ui.SparklineView

class HistoryActivity : AppCompatActivity() {

  private lateinit var spark: SparklineView
  private lateinit var statLow: TextView
  private lateinit var statNow: TextView
  private lateinit var statHigh: TextView
  private lateinit var subtitle: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_history)

    spark = findViewById(R.id.spark)
    statLow = findViewById(R.id.statLow)
    statNow = findViewById(R.id.statNow)
    statHigh = findViewById(R.id.statHigh)
    subtitle = findViewById(R.id.subtitle)
    subtitle.text = getString(R.string.history_subtitle)

    findViewById<View>(R.id.back).setOnClickListener { finish() }

    Prefs.cachedHistory(this)?.let { raw ->
      runCatching { Parser.parseHistory(raw) }.onSuccess(::bind)
    }
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
        // Keep cache if present; otherwise stats stay em-dashes.
      }
    }.start()
  }

  private fun bind(history: np.goldmandu.app.data.History) {
    val pts = history.points
    spark.setValues(pts)
    if (pts.isEmpty()) return
    statLow.text = "Rs. ${Npr.format(pts.min())}"
    statHigh.text = "Rs. ${Npr.format(pts.max())}"
    statNow.text = "Rs. ${Npr.format(pts.last())}"
  }
}
