#!/usr/bin/env node
// Fetches the latest story from a fixed set of major international outlets
// and prints a Markdown digest (title, summary, source) to stdout.
//
// Used by .github/workflows/daily-news-digest.yml to open a daily GitHub
// issue at 10:00 Asia/Taipei time.

import Parser from "rss-parser";

const FEEDS = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml" },
  { name: "DW (Deutsche Welle)", url: "https://rss.dw.com/rdf/rss-en-world" },
];

const parser = new Parser({ timeout: 15000 });

function cleanSummary(text) {
  if (!text) return "（無摘要）";
  const plain = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 280 ? `${plain.slice(0, 280)}...` : plain;
}

function formatDate(pubDate) {
  if (!pubDate) return "未知時間";
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "未知時間";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

async function fetchLatestFromFeed(feed) {
  const result = await parser.parseURL(feed.url);
  const item = result.items?.[0];
  if (!item) throw new Error(`Feed "${feed.name}" returned no items`);
  return {
    source: feed.name,
    title: item.title?.trim() ?? "（無標題）",
    link: item.link,
    summary: cleanSummary(item.contentSnippet || item.summary || item.content),
    pubDate: item.pubDate || item.isoDate,
  };
}

async function main() {
  const results = await Promise.allSettled(FEEDS.map(fetchLatestFromFeed));

  const entries = [];
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      entries.push(result.value);
    } else {
      console.error(`[warn] failed to fetch ${FEEDS[i].name}: ${result.reason}`);
    }
  }

  if (entries.length === 0) {
    throw new Error("All news feeds failed to load; aborting digest.");
  }

  const todayTaipei = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
  }).format(new Date());

  const lines = [`# 每日國際新聞摘要 - ${todayTaipei}`, ""];
  entries.forEach((entry, idx) => {
    lines.push(`${idx + 1}. **${entry.title}**`);
    lines.push(`   - 重點整理：${entry.summary}`);
    lines.push(`   - 出處：[${entry.source}](${entry.link})（發布時間：${formatDate(entry.pubDate)}）`);
    lines.push("");
  });

  console.log(lines.join("\n").trim());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
