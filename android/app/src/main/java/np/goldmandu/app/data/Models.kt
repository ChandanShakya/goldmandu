package np.goldmandu.app.data

import org.json.JSONObject

data class Change(
  val fineTola: Double?,
  val finePct: Double?,
  val tejabiTola: Double?,
  val tejabiPct: Double?,
  val silverTola: Double?,
  val silverPct: Double?,
)

data class Latest(
  val bs: String,
  val day: String,
  val month: String,
  val year: String,
  val fineGoldTola: Double?,
  val fineGoldGram: Double?,
  val tejabiGoldTola: Double?,
  val tejabiGoldGram: Double?,
  val silverTola: Double?,
  val silverGram: Double?,
  val change: Change,
  val generatedAt: String?,
)

/** One trading day on the history chart. */
data class HistoryPoint(
  val dateRaw: String,
  val dateLabel: String,
  val fine: Double,
  val tejabi: Double?,
  val silver: Double?,
)

data class History(val points: List<HistoryPoint>)

object Parser {
  fun parseLatest(raw: String): Latest {
    val o = JSONObject(raw)
    val c = o.optJSONObject("change") ?: JSONObject()
    return Latest(
      bs = o.optString("bs").ifBlank {
        "${o.optString("day")} ${o.optString("month")} ${o.optString("year")}"
      },
      day = o.optString("day"),
      month = o.optString("month"),
      year = o.optString("year"),
      fineGoldTola = o.optPrice("fine_gold_tola"),
      fineGoldGram = o.optPrice("fine_gold_gram"),
      tejabiGoldTola = o.optPrice("tejabi_gold_tola"),
      tejabiGoldGram = o.optPrice("tejabi_gold_gram"),
      silverTola = o.optPrice("silver_tola"),
      silverGram = o.optPrice("silver_gram"),
      change = Change(
        fineTola = c.optDelta("fine_gold_tola"),
        finePct = c.optDelta("fine_gold_tola_pct"),
        tejabiTola = c.optDelta("tejabi_gold_tola"),
        tejabiPct = c.optDelta("tejabi_gold_tola_pct"),
        silverTola = c.optDelta("silver_tola"),
        silverPct = c.optDelta("silver_tola_pct"),
      ),
      generatedAt = o.optString("generated_at").ifBlank { null },
    )
  }

  fun parseHistory(raw: String): History {
    val o = JSONObject(raw)
    val arr = o.optJSONArray("points") ?: return History(emptyList())
    val out = ArrayList<HistoryPoint>(arr.length())
    for (i in 0 until arr.length()) {
      val p = arr.optJSONObject(i) ?: continue
      val fine = p.optPrice("ft") ?: continue
      val dateRaw = p.optString("d")
      out.add(
        HistoryPoint(
          dateRaw = dateRaw,
          dateLabel = formatDateLabel(dateRaw),
          fine = fine,
          tejabi = p.optPrice("tt"),
          silver = p.optPrice("st"),
        ),
      )
    }
    return History(out)
  }

  /** "2083-Bhadra-31" → "31 Bhadra 2083" */
  fun formatDateLabel(raw: String): String {
    if (raw.isBlank()) return "—"
    val parts = raw.split('-')
    if (parts.size != 3) return raw
    return "${parts[2]} ${parts[1]} ${parts[0]}"
  }

  private fun JSONObject.optPrice(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val v = optDouble(key, Double.NaN)
    return if (v.isNaN() || v <= 0.0) null else v
  }

  private fun JSONObject.optDelta(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val v = optDouble(key, Double.NaN)
    return if (v.isNaN()) null else v
  }
}
