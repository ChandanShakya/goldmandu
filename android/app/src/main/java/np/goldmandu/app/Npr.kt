package np.goldmandu.app

/** South Asian NPR grouping: 301800 → 3,01,800 */
object Npr {
  fun format(n: Number?): String {
    if (n == null) return "—"
    val v = when (n) {
      is Double -> if (n.isNaN()) return "—" else Math.round(n).toInt()
      is Float -> if (n.isNaN()) return "—" else Math.round(n).toInt()
      is Int -> n
      is Long -> n.toInt()
      else -> return "—"
    }
    val s = kotlin.math.abs(v).toString()
    if (s.length <= 3) return (if (v < 0) "-" else "") + s
    val last3 = s.substring(s.length - 3)
    val rest = s.substring(0, s.length - 3)
    val grouped = rest.replace(Regex("\\B(?=(\\d{2})+(?!\\d))"), ",")
    return (if (v < 0) "-" else "") + grouped + "," + last3
  }

  fun signed(n: Number?): String {
    if (n == null) return ""
    val v = n.toInt()
    val sign = if (v > 0) "+" else if (v < 0) "−" else ""
    return sign + format(kotlin.math.abs(v))
  }
}
