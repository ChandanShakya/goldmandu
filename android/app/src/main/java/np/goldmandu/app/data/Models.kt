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

data class History(val points: List<Double>)

object Parser {
  fun parseLatest(raw: String): Latest {
    val o = JSONObject(raw)
    val c = o.optJSONObject("change") ?: JSONObject()
    return Latest(
      bs = o.optString("bs").ifBlank { "${o.optString("day")} ${o.optString("month")} ${o.optString("year")}" },
      day = o.optString("day"),
      month = o.optString("month"),
      year = o.optString("year"),
      fineGoldTola = o.optNum("fine_gold_tola"),
      fineGoldGram = o.optNum("fine_gold_gram"),
      tejabiGoldTola = o.optNum("tejabi_gold_tola"),
      tejabiGoldGram = o.optNum("tejabi_gold_gram"),
      silverTola = o.optNum("silver_tola"),
      silverGram = o.optNum("silver_gram"),
      change = Change(
        fineTola = c.optNum("fine_gold_tola"),
        finePct = c.optNum("fine_gold_tola_pct"),
        tejabiTola = c.optNum("tejabi_gold_tola"),
        tejabiPct = c.optNum("tejabi_gold_tola_pct"),
        silverTola = c.optNum("silver_tola"),
        silverPct = c.optNum("silver_tola_pct"),
      ),
      generatedAt = o.optString("generated_at").ifBlank { null },
    )
  }

  fun parseHistory(raw: String): History {
    val o = JSONObject(raw)
    val arr = o.optJSONArray("points") ?: return History(emptyList())
    val out = ArrayList<Double>(arr.length())
    for (i in 0 until arr.length()) {
      val p = arr.optJSONObject(i) ?: continue
      val ft = p.optNum("ft") ?: continue
      out.add(ft)
    }
    return History(out)
  }

  private fun JSONObject.optNum(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val v = optDouble(key, Double.NaN)
    return if (v.isNaN() || v <= 0) null else v
  }
}
