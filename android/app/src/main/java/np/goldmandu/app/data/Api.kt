package np.goldmandu.app.data

import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.GZIPInputStream

/**
 * Tiny HTTP client — HttpURLConnection only (no OkHttp).
 * Expected hosts: goldmandu.chandanshakya.com.np (or CF Pages preview).
 */
object Api {
  // Point at the production site; /api/*.json are static assets.
  const val BASE = "https://goldmandu.chandanshakya.com.np"

  fun fetchLatest(): String = get("$BASE/api/latest.json")

  fun fetchHistory(): String = get("$BASE/api/history.json")

  private fun get(urlStr: String): String {
    val conn = URL(urlStr).openConnection() as HttpURLConnection
    try {
      conn.connectTimeout = 12_000
      conn.readTimeout = 12_000
      conn.requestMethod = "GET"
      conn.setRequestProperty("Accept", "application/json")
      conn.setRequestProperty("Accept-Encoding", "gzip")
      conn.setRequestProperty("User-Agent", "GoldMandu-Android/1.0")
      val code = conn.responseCode
      if (code !in 200..299) throw HttpException(code)
      val raw = conn.inputStream
      val stream = if ("gzip".equals(conn.contentEncoding, true)) {
        GZIPInputStream(raw)
      } else {
        raw
      }
      stream.use { input ->
        BufferedReader(InputStreamReader(input, Charsets.UTF_8)).use { br ->
          return br.readText()
        }
      }
    } finally {
      conn.disconnect()
    }
  }

  class HttpException(val code: Int) : Exception("HTTP $code")
}
