
/* AFI market-data bridge
   Connects and validates historical candles.
   BUY/SELL signals remain blocked until spread
   and economic-calendar checks are connected.
*/

(function () {
  "use strict";

  const API =
    "https://afi-market-data.machariajohnwork.workers.dev/";

  const PAIRS = [
    ["EURUSD", "EUR/USD"],
    ["GBPUSD", "GBP/USD"],
    ["USDJPY", "USD/JPY"],
    ["USDCHF", "USD/CHF"],
    ["AUDUSD", "AUD/USD"],
    ["NZDUSD", "NZD/USD"],
    ["USDCAD", "USD/CAD"],
    ["XAUUSD", "XAU/USD"]
  ];

  async function loadCandles(symbol) {
    const url =
      API +
      "?action=candles&symbol=" +
      encodeURIComponent(symbol) +
      "&interval=5min&outputsize=250";

    const response = await fetch(url, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Market data error");
    }

    if (!Array.isArray(data.candles)) {
      throw new Error("Candle data is missing.");
    }

    const candles = data.candles.map(function (c) {
      return {
        time: c.datetime || c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close)
      };
    });

    if (candles.length < 210) {
      throw new Error(
        "Insufficient candles: " + candles.length
      );
    }

    for (const c of candles) {
      if (
        !c.time ||
        !Number.isFinite(c.open) ||
        !Number.isFinite(c.high) ||
        !Number.isFinite(c.low) ||
        !Number.isFinite(c.close) ||
        c.high < c.low ||
        c.close <= 0
      ) {
        throw new Error("Invalid candle data.");
      }
    }

    return candles;
  }

  window.runAnalysis = async function () {
    const panel = document.getElementById("analysis");

    if (!panel) return;

    document.getElementById("sl").textContent = "--";
    document.getElementById("tp").textContent = "--";
    document.getElementById("rr").textContent = "--";

    panel.textContent =
      "Checking historical candles for all 8 instruments...";

    const results = [];

    for (const pair of PAIRS) {
      try {
        const candles = await loadCandles(pair[1]);

        results.push({
          pair: pair[0],
          success: true,
          count: candles.length
        });

      } catch (error) {
        results.push({
          pair: pair[0],
          success: false,
          error: error.message
        });
      }
    }

    const output = results.map(function (r) {
      if (r.success) {
        return (
          "<p><b>" + r.pair +
          ":</b> <span style='color:#7cdbb2'>" +
          r.count +
          " candles validated</span></p>"
        );
      }

      return (
        "<p><b>" + r.pair +
        ":</b> <span style='color:#ff9b9b'>" +
        "ERROR: " + r.error +
        "</span></p>"
      );
    }).join("");

    const allSuccessful =
      results.every(function (r) {
        return r.success;
      });

    panel.innerHTML =
      "<p class='green'><b>" +
      (allSuccessful
        ? "Historical candle feed connected."
        : "Candle check completed.") +
      "</b></p>" +
      output +
      "<p class='muted'>" +
      "BUY/SELL signals remain disabled until " +
      "live broker spread and economic-calendar " +
      "verification are connected." +
      "</p>";
  };

})();
