import { GM_addStyle, GM_getResourceText } from "$";

type Filler = {
  season: number;
  episode: number;
  isFiller: boolean;
};

type FillerList = Record<string, Filler[]>;

const fillerList = loadFillerList();
const anime = location.pathname.split("/")[2];
const fillers = anime ? fillerList[anime] : undefined;

if (fillers) {
  highlightFillers(fillers);
}

function loadFillerList(): FillerList {
  try {
    const parsed: unknown = JSON.parse(GM_getResourceText("fillers.json"));
    if (!isFillerList(parsed)) {
      throw new Error("Resource does not contain a valid filler list.");
    }
    return parsed;
  } catch (error) {
    console.warn("Could not parse fillers.json.", error);
    return {};
  }
}

function isFillerList(value: unknown): value is FillerList {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value).every(
    (fillers) =>
      Array.isArray(fillers) &&
      fillers.every(
        (filler) =>
          filler !== null &&
          typeof filler === "object" &&
          typeof filler.season === "number" &&
          typeof filler.episode === "number" &&
          typeof filler.isFiller === "boolean",
      ),
  );
}

function highlightFillers(fillers: Filler[]): void {
  const [seasonList, episodeList] = document.querySelectorAll<HTMLUListElement>(
    "#stream ul",
  );
  const activeSeason = seasonList?.querySelector(".active");
  const activeSeasonNumber = Number.parseInt(
    activeSeason?.textContent ?? "",
    10,
  );

  if (!episodeList || Number.isNaN(activeSeasonNumber)) {
    return;
  }

  addFillerStyles();

  for (const episode of episodeList.children) {
    const episodeNumber = Number.parseInt(
      episode.querySelector("a")?.textContent ?? "",
      10,
    );
    const episodeData = fillers.find(
      (filler) =>
        filler.season === activeSeasonNumber &&
        filler.episode === episodeNumber,
    );

    if (episodeData?.isFiller) {
      episode.firstElementChild?.classList.add("filler");
    }
  }
}

function addFillerStyles(): void {
  GM_addStyle(`
    .filler {
      background-color: rgb(161, 74, 64) !important;
      transition: unset !important;
    }

    .filler:hover:not(.anything),
    .active.filler:not(.anything) {
      color: rgb(161, 74, 64) !important;
      font-weight: bold;
    }
  `);
}
