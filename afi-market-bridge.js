
/* AFI coordinated market-data bridge */
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

    const panel = document.getElementById("analysis");
    const button = document.querySelector(
      'button[onclick="runAnalysis()"]'
    );

    if (!panel) return;

    analysisRunning = true;
    window.AFI_ANALYSIS_RUNNING = true;

    if (button) button.disabled = true;

    document.getElementById("sl").textContent = "--";
    document.getElementById("tp").textContent = "--";
    document.getElementById("rr").textContent = "--";

    const results = [];

    try {
      panel.textContent =
        "Pausing price refresh and allowing the API limit to reset. Please wait 65 seconds...";

      await sleep(65000);

      for (let i = 0; i < PAIRS.length; i++) {
        const [pair, symbol] = PAIRS[i];

        panel.textContent =
          "Checking " + pair + " (" + (i + 1) + " of 8)...";

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

        panel.innerHTML = results.map(r => {
          const p = document.createElement("p");
          p.textContent = r.success
            ? r.pair + ": " + r.count + " candles validated"
            : r.pair + ": ERROR: " + r.error;
          p.style.color = r.success ? "#7cdbb2" : "#ff9b9b";
          return p.outerHTML;
        }).join("");

        if (i < PAIRS.length - 1) {
          await sleep(9000);
        }
      }

      const successful =
        results.filter(r => r.success).length;

      const summary = document.createElement("p");
      summary.className = "green";
      summary.textContent =
        successful + " of 8 instruments passed candle validation.";

      panel.prepend(summary);

      const note = document.createElement("p");
      note.className = "muted";
      note.textContent =
        "Historical data validation only. Trading signals and automatic execution remain disabled until all required safety checks are connected.";

      panel.appendChild(note);

    } finally {
      analysisRunning = false;
      window.AFI_ANALYSIS_RUNNING = false;

      if (button) button.disabled = false;
    }
  };
})();
