import * as cheerio from "cheerio";
import { Database } from "bun:sqlite";
import path from "node:path"

const DB_FILE = "request_cache.sqlite";
const CACHE_TABLE = "http_cache";

const animes = ["one-piece", "bleach", "naruto-shippuden"];

type Episode = {
  num: number;
  link: string;
};

type Season = {
  num: number;
  link: string;
};

function initializeCacheDB(): Database {
  const db = new Database(DB_FILE);

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
      url TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    `;
  db.run(createTableSql);

  return db;
}

const db = initializeCacheDB();

async function getCachedData(url: string, maxAgeSeconds: number = 3600) {
  const now = Date.now();
  const maxAgeMs = maxAgeSeconds * 1000;

  const selectQuery = db.query(`
    SELECT data, expires_at
    FROM ${CACHE_TABLE}
    WHERE url = ?1;
    `);

  const cachedResult = selectQuery.get(url) as { data: string; expires_at: number } | undefined;

  if (cachedResult) {
    if (now < cachedResult.expires_at) {
      console.log(`✅ Cache hit (fresh) for ${url}`);
      return cachedResult.data;
    } else {
      console.log(`⚠️ Cache hit (stale) for ${url}. Fetching new data...`);
    }
  } else {
    console.log(`❌ Cache miss for ${url}. Fetching...`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await Bun.sleep(1000);

    const rawData = await response.text();

    const inserOrReplaceQuery = db.prepare(`
      INSERT INTO ${CACHE_TABLE} (url, data, cached_at, expires_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(url) DO UPDATE SET
        data = excluded.data,
        cached_at = excluded.cached_at,
        expires_at = excluded.expires_at;
      `);

    inserOrReplaceQuery.run(url, rawData, now, now + maxAgeMs);
    console.log(`💾 Data fetched and stored in SQLite for ${url}.`);

    return rawData;
  } catch (error) {
    console.error(`Error fetching data for ${url}:`, error);

    if (cachedResult) {
      console.log("↩️ Returning stale data due to network error.");
      return cachedResult.data;
    }

    throw error;
  }
}

async function getFile(url: string): Promise<string> {
  return await getCachedData(url);
}

function getNumbersATags($: cheerio.CheerioAPI, ...params: Parameters<cheerio.CheerioAPI>) {
  return $(...params)
    .find($("li:has(a) a"))
    .filter((_, e) => {
      const num = Number.parseInt($(e).html() ?? "", 10);
      return !Number.isNaN(num) && typeof num === "number";
    });
}

type PageInfo = { episodes: Episode[]; seasons: Season[] };
function getPageInfo(page: string): PageInfo {
  const $ = cheerio.load(page);
  const [seasonList, episodeList] = $("#stream ul");

  return {
    seasons: getNumbersATags($, seasonList)
      .map((_, e) => ({ num: Number.parseInt($(e).html()!, 10), link: $(e).attr("href")! }))
      .toArray(),
    episodes: getNumbersATags($, episodeList)
      .map((_, e) => ({ num: Number.parseInt($(e).html()!, 10), link: $(e).attr("href")! }))
      .toArray(),
  };
}

async function getFillerJson(episodesPerSeason: number[], fillerListLink: string) {
  const seasons: number[][] = [];
  for (const i of episodesPerSeason) {
    const startOffset = seasons.at(-1)?.at(-1) ?? 0;
    const episodes = Array.from({ length: i }, (_, i) => startOffset + i + 1);
    seasons.push(episodes);
  }

  const mappedSeasons = new Map<string, { season: number; episode: number }>();
  seasons.forEach((season, index) => {
    for (const episode of season) {
      mappedSeasons.set(episode.toString(), { season: index + 1, episode: season.indexOf(episode) + 1 });
    }
  });

  const file = await getFile(fillerListLink);
  const $ = cheerio.load(file);

  const fillerJson: { id: number; title: string; date: string; isFiller: boolean; episode: number; season: number }[] = [];

  $(".EpisodeList").each((_, el) => {
    $(el)
      .find("tbody")
      .children("tr")
      .each((_, el) => {
        const id = $(el).children("td.Number").text();
        const type = $(el).children("td.Type").text();
        const date = $(el).children("td.Date").text();
        const title = $(el).children("td.Title").text();

        if (mappedSeasons.has(id) === false) {
          console.log(id);
          return;
        }
        const { episode, season } = mappedSeasons.get(id) as { episode: number; season: number };

        const isFiller = type === "Filler";
        fillerJson.push({
          id: Number.parseInt(id, 10),
          title,
          date,
          isFiller,
          episode,
          season,
        });
      });
  });

  return fillerJson;
}

const fillerAnimes = {};

for (const anime of animes) {
  const aniworldLink = `https://aniworld.to/anime/stream/${anime}`;
  const fillerListLink = `https://www.animefillerlist.com/shows/${anime}`;
  const info = getPageInfo(await getFile(aniworldLink));

  const episodesPerSeason = await Promise.all(
    info.seasons.map(async (season) => {
      const file = await getFile(new URL(season.link, aniworldLink).href);
      const info = getPageInfo(file);

      return info.episodes.length;
    }),
  );

  fillerAnimes[anime] = await getFillerJson(episodesPerSeason, fillerListLink);
  console.log(fillerAnimes[anime].length);
}

Bun.write(path.join(__dirname, "fillers.json"), JSON.stringify(fillerAnimes));
