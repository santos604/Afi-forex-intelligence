
/*
 * AFI FOREX INTELLIGENCE
 * Version: 1.0
 * File: signal-engine.js
 *
 * Independent rule-based signal engine.
 * No automatic trading or broker execution.
 *
 * Required input:
 * {
 *   symbol: "EURUSD",
 *   candles: [{ time, open, high, low, close }, ...],
 *   currentPrice: 1.0950,
 *   spread: 0.0001,
 *   dataVerified: true,
 *   calendar: { status: "clear" }
 * }
 */

(function (root) {
  "use strict";

  const CONFIG = {
    minimumCandles: 210,
    emaFast: 20,
    emaMedium: 50,
    emaSlow: 200,
    rsiPeriod: 14,
    atrPeriod: 14,
    breakoutLookback: 20,
    maximumDataAgeMinutes: 30,
    riskReward: 2,
    stopATRMultiplier: 1.5
  };

  function noSignal(reason, details = {}) {
    return {
      signal: "NO SIGNAL",
      reason,
      details,
      timestamp: new Date().toISOString()
    };
  }

  function normalizeTime(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : NaN;
    }

    // Convert Unix seconds to milliseconds.
    return number < 100000000000 ? number * 1000 : number;
  }

  function validateCandles(candles) {
    if (!Array.isArray(candles)) {
      throw new Error("Candles must be an array.");
    }

    if (candles.length < CONFIG.minimumCandles) {
      throw new Error(
        "Insufficient candle history. At least " +
        CONFIG.minimumCandles + " candles are required."
      );
    }

    const clean = candles.map((candle) => ({
      time: normalizeTime(candle.time),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close)
    }));

    for (const candle of clean) {
      if (
        !Number.isFinite(candle.time) ||
        !Number.isFinite(candle.open) ||
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) ||
        !Number.isFinite(candle.close) ||
        candle.high < candle.low ||
        candle.close <= 0
      ) {
        throw new Error("Invalid candle data.");
      }
    }

    clean.sort((a, b) => a.time - b.time);

    return clean;
  }

  function ema(values, period) {
    if (values.length < period) return null;

    const multiplier = 2 / (period + 1);

    let result = values
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

    for (let i = period; i < values.length; i++) {
      result =
        values[i] * multiplier +
        result * (1 - multiplier);
    }

    return result;
  }

  function rsi(values, period = 14) {
    if (values.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];

      if (change > 0) gains += change;
      if (change < 0) losses -= change;
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      const gain = Math.max(change, 0);
      const loss = Math.max(-change, 0);

      averageGain =
        (averageGain * (period - 1) + gain) / period;

      averageLoss =
        (averageLoss * (period - 1) + loss) / period;
    }

    if (averageLoss === 0) return 100;

    const relativeStrength = averageGain / averageLoss;

    return 100 - 100 / (1 + relativeStrength);
  }

  function atr(candles, period = 14) {
    if (candles.length <= period) return null;

    const ranges = [];

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      ranges.push(
        Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        )
      );
    }

    let result = ranges
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

    for (let i = period; i < ranges.length; i++) {
      result =
        (result * (period - 1) + ranges[i]) / period;
    }

    return result;
  }

  function getPrecision(symbol) {
    return /JPY|XAU/i.test(symbol) ? 3 : 5;
  }

  function evaluate(input) {
    try {
      if (!input || typeof input !== "object") {
        return noSignal("Missing input.");
      }

      if (input.dataVerified !== true) {
        return noSignal("Market data has not been verified.");
      }

      if (!input.calendar || input.calendar.status !== "clear") {
        return noSignal(
          "Economic calendar status is not confirmed clear."
        );
      }

      const candles = validateCandles(input.candles);
      const closes = candles.map(c => c.close);

      const latest = candles[candles.length - 1];
      const now = Date.now();

      const ageMinutes = (now - latest.time) / 60000;

      if (
        !Number.isFinite(ageMinutes) ||
        ageMinutes < -2 ||
        ageMinutes > CONFIG.maximumDataAgeMinutes
      ) {
        return noSignal("Market candle data is stale or has an invalid time.");
      }

      const currentPrice = Number(input.currentPrice);
      const spread = Number(input.spread);

      if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !Number.isFinite(spread) ||
        spread < 0
      ) {
        return noSignal("Invalid current price or spread.");
      }

      const fastEMA = ema(closes, CONFIG.emaFast);
      const mediumEMA = ema(closes, CONFIG.emaMedium);
      const slowEMA = ema(closes, CONFIG.emaSlow);

      const rsiValue = rsi(closes, CONFIG.rsiPeriod);
      const atrValue = atr(candles, CONFIG.atrPeriod);

      if (
        fastEMA === null ||
        mediumEMA === null ||
        slowEMA === null ||
        rsiValue === null ||
        atrValue === null ||
        atrValue <= 0
      ) {
        return noSignal("Indicator calculation failed.");
      }

      if (spread > atrValue * 0.15) {
        return noSignal("Spread is too high relative to volatility.");
      }

      const previousCandles = candles.slice(
        -(CONFIG.breakoutLookback + 1),
        -1
      );

      const previousHigh = Math.max(
        ...previousCandles.map(c => c.high)
      );

      const previousLow = Math.min(
        ...previousCandles.map(c => c.low)
      );

      const bullishTrend =
        fastEMA > mediumEMA &&
        mediumEMA > slowEMA &&
        currentPrice > fastEMA;

      const bearishTrend =
        fastEMA < mediumEMA &&
        mediumEMA < slowEMA &&
        currentPrice < fastEMA;

      const bullishBreakout = currentPrice > previousHigh;
      const bearishBreakout = currentPrice < previousLow;

      let direction = null;
      let reason = "";

      if (
        bullishTrend &&
        bullishBreakout &&
        rsiValue >= 50 &&
        rsiValue <= 70
      ) {
        direction = "BUY";
        reason = "Bullish EMA alignment, breakout and RSI confirmation.";
      }

      if (
        bearishTrend &&
        bearishBreakout &&
        rsiValue >= 30 &&
        rsiValue <= 50
      ) {
        direction = "SELL";
        reason = "Bearish EMA alignment, breakout and RSI confirmation.";
      }

      if (!direction) {
        return noSignal("No complete trading setup.", {
          ema20: fastEMA,
          ema50: mediumEMA,
          ema200: slowEMA,
          rsi: rsiValue,
          atr: atrValue
        });
      }

      const entry = currentPrice;
      const stopDistance = atrValue * CONFIG.stopATRMultiplier;
      const targetDistance = stopDistance * CONFIG.riskReward;

      const stopLoss =
        direction === "BUY"
          ? entry - stopDistance
          : entry + stopDistance;

      const takeProfit =
        direction === "BUY"
          ? entry + targetDistance
          : entry - targetDistance;

      const precision = getPrecision(input.symbol || "");

      return {
        signal: direction,
        symbol: input.symbol || "UNKNOWN",
        strategy: "Trend Breakout",
        entry: Number(entry.toFixed(precision)),
        stopLoss: Number(stopLoss.toFixed(precision)),
        takeProfit: Number(takeProfit.toFixed(precision)),
        riskReward: CONFIG.riskReward,
        indicators: {
          ema20: Number(fastEMA.toFixed(precision)),
          ema50: Number(mediumEMA.toFixed(precision)),
          ema200: Number(slowEMA.toFixed(precision)),
          rsi14: Number(rsiValue.toFixed(2)),
          atr14: Number(atrValue.toFixed(precision))
        },
        reason,
        timestamp: new Date().toISOString(),
        execution: "MANUAL ONLY"
      };

    } catch (error) {
      return noSignal(error.message || "Unknown analysis error.");
    }
  }

  const AFIEngine = {
    version: "1.0",
    evaluate,
    indicators: {
      ema,
      rsi,
      atr
    }
  };

  root.AFIEngine = AFIEngine;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = AFIEngine;
  }

})(typeof globalThis !== "undefined" ? globalThis : this);
