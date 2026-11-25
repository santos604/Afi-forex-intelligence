
/* AFI Market Data Bridge
   Rate-limited historical candle validation.
   No BUY/SELL signals or live trades are enabled.
*/
(function () {
  "use strict";

  const API = "https://afi-market-data.machariajohnwork.workers.dev/";

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

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  let analysisRunning = false;

  // Stop the dashboard's recurring price requests
  // so they do not consume the candle request allowance.
  window.afiRefreshPrices = async function () {
    return;
  };

  async function loadCandles(symbol) {
    const url = API +
      "?action=candles&symbol=" +
      encodeURIComponent(symbol) +
      "&interval=5min&outputsize=250";

    const response = await fetch(url, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Market data request failed");
    }

    if (!Array.isArray(data.candles)) {
      throw new Error("Candle data is missing");
    }

    const candles = data.candles.map(c => ({
      time: c.datetime || c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }));

    if (candles.length < 210) {
      throw new Error(
        "Only " + candles.length + " candles received; 210 required"
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
        throw new Error("Invalid candle data");
      }
    }

    return candles;
  }

  window.runAnalysis = async function () {
    if (analysisRunning) return;

    analysisRunning = true;

    const panel = document.getElementById("analysis");
    const button = document.querySelector(
      'button[onclick="runAnalysis()"]'
    );

    if (!panel) {
      analysisRunning = false;
      return;
    }

    if (button) button.disabled = true;

    document.getElementById("sl").textContent = "--";
    document.getElementById("tp").textContent = "--";
    document.getElementById("rr").textContent = "--";

    const results = [];

    try {
      panel.textContent =
        "Pausing price requests. Waiting 65 seconds for the API limit to reset...";

      await sleep(65000);

      for (let i = 0; i < PAIRS.length; i++) {
        const [pair, symbol] = PAIRS[i];

        panel.textContent =
          "Checking " + pair +
          " (" + (i + 1) + " of 8). Please wait...";

        try {
          const candles = await loadCandles(symbol);

          results.push({
            pair,
            success: true,
            count: candles.length
          });

        } catch (error) {
          results.push({
            pair,
            success: false,
            error: error.message
          });
        }

        // Leave 9 seconds between API requests.
        if (i < PAIRS.length - 1) {
          await sleep(9000);
        }

        panel.innerHTML = results.map(r => {
          const p = document.createElement("p");
          p.textContent = r.success
            ? r.pair + ": " + r.count + " candles validated"
            : r.pair + ": ERROR: " + r.error;
          p.style.color = r.success ? "#7cdbb2" : "#ff9b9b";
          return p.outerHTML;
        }).join("");
      }

      const successful = results.filter(r => r.success).length;

      const summary = document.createElement("p");
      summary.className = "green";
      summary.textContent =
        successful + " of 8 instruments passed candle validation.";

      panel.prepend(summary);

      const note = document.createElement("p");
      note.className = "muted";
      note.textContent =
        "This checks historical data only. BUY/SELL signals remain disabled until broker spread and economic-calendar verification are connected.";

      panel.appendChild(note);

    } finally {
      analysisRunning = false;
      if (button) button.disabled = false;
    }
  };
})();
