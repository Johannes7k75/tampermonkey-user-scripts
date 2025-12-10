import { GM_getResourceText, GM_getValue, GM_log, GM_setValue } from "$";

import "./style.css";

enum EpisodeState {
  NotWatched,
  Watched,
  Watching,
}

const [seasonList, episodeList]: HTMLUListElement[] = Array.from(document.querySelectorAll<HTMLUListElement>("#stream ul"));

function getNumbersATags(element: HTMLElement) {
  return Array.from(element.querySelectorAll("li:has(a) a")).filter((el) => {
    const num = Number.parseInt(el.innerHTML, 10);
    return !Number.isNaN(num) && typeof num === "number";
  });
}

const seasons = getNumbersATags(seasonList);
const episodes = getNumbersATags(episodeList);

const activeSeason = seasonList.querySelector<HTMLAnchorElement>("li a.active") as HTMLAnchorElement;
const activeEpisode = episodeList.querySelector<HTMLAnchorElement>("li a.active");

const episodesListTable = document.querySelector("tbody");

type WatchListAnimeEpisode = {
  episodeNumber: string;
  watchTime: number;
  watched: boolean;
};

type WatchListAnimeSeason = {
  seasonNumber: string;
  allEpisodesNumber: number;
  watched: boolean;
  episodes: WatchListAnimeEpisode[];
};

type WatchListAnime = {
  title: string;
  link: string;
  allSeasonsNumber: number;
  seasons: WatchListAnimeSeason[];
};

function getAnimeWatchList(): WatchListAnime[] {
  const watchList = GM_getValue<WatchListAnime[]>("animeWatchList", []);
  GM_log("Anime Watch List received", watchList);
  return watchList;
}

function setAnimeWatchList(animeWatchList: WatchListAnime[]) {
  GM_log("Anime Watch List saved", animeWatchList);
  GM_setValue("animeWatchList", animeWatchList);
}
(window as any).resetWatchList = () => setAnimeWatchList([]);

const seasonSelectionParentDiv = document.querySelector(".pageTitle");
if (seasonSelectionParentDiv) {
  seasonSelectionParentDiv.innerHTML += `
<div class="dropDownContainer season">
    <div class="normalDropdownButton" data-active-status="1">Staffel gesehen? <i class="fas fa-chevron-down"></i></div>
        <div class="normalDropdown" style="display: none;">
        <span data-action="true" id="watched" class="clearAllEpisodesFromThisSeason season"><i class="fas fa-eye"></i> Gesehen</span>
        <span data-action="false" id="notWatched" class="clearAllEpisodesFromThisSeason season"><i class="fas fa-eye-slash"></i> Nicht gesehen</span>
    </div>
</div>`;
}

const episodeSelectionParentDiv = document.querySelector(".hosterSectionTitle");
if (episodeSelectionParentDiv) {
  const episodeSelectionDiv = document.createElement("div");
  episodeSelectionDiv.className = "hosterSectionTitle episodeMarker";
  // <div class="hosterSectionTitle episodeMarker" data-action="true">
  episodeSelectionDiv.innerHTML = `
  <i class="fa fa-eye"></i>
  <h3>Folge gesehen</h3>`;

  episodeSelectionParentDiv.after(episodeSelectionDiv);
}

const normalDropdown = document.querySelector<HTMLDivElement>(".normalDropdown") as HTMLDivElement;
const dropDownContainer = document.querySelector<HTMLDivElement>(".dropDownContainer") as HTMLDivElement;
const notWatchedButton = document.querySelector<HTMLSpanElement>("#notWatched") as HTMLSpanElement;
const watchedButton = document.querySelector<HTMLSpanElement>("#watched") as HTMLSpanElement;

const episodeMarker = document.querySelector<HTMLDivElement>(".episodeMarker") as HTMLDivElement;

const titleElement = document.querySelector<HTMLSpanElement>('h1[itemprop="name"] span');

function updateButtons() {
  function getExistingAnime(animeName?: string): WatchListAnime {
    let anime = animeWatchList.find((anime) => anime.title === (animeName ?? title));
    if (anime) return anime;

    let allSeasonsNumber = seasonList.children.length - 1;
    if (seasonList.children[1].children[0].innerHTML === "Filme") {
      allSeasonsNumber = seasonList.children.length - 2;
    }

    anime = {
      title: title,
      link: "",
      allSeasonsNumber: allSeasonsNumber,
      seasons: [],
    };

    animeWatchList.push(anime);

    // anime.seasons.push(getExistingSeason(activeSeason.innerHTML))
    const existingAnime = animeWatchList[animeWatchList.length - 1];
    setAnimeWatchList(animeWatchList);
    return existingAnime;
  }

  function getExistingSeason(seasonNumber: string): WatchListAnimeSeason {
    const existingAnime = getExistingAnime(title);
    let season = existingAnime.seasons.find((season) => season.seasonNumber === seasonNumber);
    if (season) return season;

    season = {
      watched: false,
      seasonNumber: seasonNumber,
      allEpisodesNumber: episodes.length,
      episodes: episodes.map((episode) => ({
        watched: false,
        watchTime: 0,
        episodeNumber: episode.innerHTML,
      })),
    };

    existingAnime.seasons.push(season);
    return existingAnime.seasons[existingAnime.seasons.length - 1];
  }

  function getExistingEpisode(episodeNumber: string, seasonNumber?: string): WatchListAnimeEpisode {
    const existingSeason = getExistingSeason(seasonNumber ?? activeSeason.innerHTML);
    let episode = existingSeason.episodes.find((episode) => episode.episodeNumber === episodeNumber);
    if (episode) return episode;

    episode = {
      episodeNumber: episodeNumber,
      watched: false,
      watchTime: 0,
    };

    existingSeason.episodes.push(episode);
    return existingSeason.episodes[existingSeason.episodes.length - 1];
  }

  const animeWatchList = getAnimeWatchList();
  const title = titleElement?.textContent ?? "undefined";
  const existingAnime = getExistingAnime(title);

  type Filler = {
    id: number;
    title: string;
    date: string;
    isFiller: boolean;
    episode: number;
    season: number;
  };

  const fillerList = JSON.parse(GM_getResourceText("fillers.json")) as Record<string, Filler[]>;

  if (episodesListTable) {
    if (activeSeason) {
      const existingSeason = existingAnime?.seasons.find((season) => season.seasonNumber === activeSeason.innerHTML);

      Array.from(episodesListTable.children).forEach((episodeListButton) => {
        const episodeNumber = episodeListButton.querySelector<HTMLMetaElement>("meta[itemprop='episodeNumber']")!.content;
        const existingEpisode = existingSeason?.episodes.find((episode) => episode.episodeNumber === episodeNumber);

        let episodeState = EpisodeState.NotWatched;
        if (existingEpisode?.watched) {
          episodeState = EpisodeState.Watched;
        }

        const eye = document.createElement("i");
        eye.id = `${EpisodeState[episodeState]}-episode-${episodeNumber}`;
        eye.className = `fa ${episodeState === EpisodeState.Watched ? "fa-eye-slash" : "fa-eye"}`;
        eye.addEventListener("click", () => {
          const anime = getExistingAnime(title);
          const season = getExistingSeason(activeSeason.innerHTML);
          const episode = getExistingEpisode(episodeNumber, activeSeason.innerHTML);

          episode.watched = !episode.watched;
          season.watched = season.episodes.filter((episode) => episode.watched && episode.watchTime === 100).length === season.allEpisodesNumber;

          setAnimeWatchList(animeWatchList);
          doFancyStuff(anime);
        });
        episodeListButton.children[0].insertBefore(eye, episodeListButton.children[0].children[0]);
      });
    }
  }

  if (dropDownContainer) {
    if (normalDropdown) {
      dropDownContainer.addEventListener("click", () => {
        if (normalDropdown.style.display === "none") {
          normalDropdown.style.display = "block";
        } else {
          normalDropdown.style.display = "none";
        }
      });
    }

    watchedButton.addEventListener("click", () => {
      const anime = getExistingAnime();

      if (watchedButton.classList.contains("season")) {
        const season = getExistingSeason(activeSeason.innerHTML);
        season.episodes.forEach((episode) => {
          episode.watched = true;
        });
        season.watched = true;
      } else if (watchedButton.classList.contains("episode")) {
        const episode = getExistingEpisode(activeEpisode!.innerHTML, activeSeason.innerHTML);
        episode.watched = true;
      }
      setAnimeWatchList(animeWatchList);
      doFancyStuff(anime);
    });

    notWatchedButton.addEventListener("click", () => {
      const anime = getExistingAnime();

      if (watchedButton.classList.contains("season")) {
        const season = getExistingSeason(activeSeason.innerHTML);
        season.episodes.forEach((episode) => {
          episode.watched = false;
        });
        season.watched = false;
      } else if (watchedButton.classList.contains("episode")) {
        const episode = getExistingEpisode(activeEpisode!.innerHTML, activeSeason.innerHTML);
        episode.watched = false;
      }
      setAnimeWatchList(animeWatchList);
      doFancyStuff(anime);
    });
  }

  if (episodeMarker) {
    const existingSeason = existingAnime?.seasons.find((season) => season.seasonNumber === activeSeason.innerHTML);

    const episodeNumber = activeEpisode?.innerHTML;
    const header = episodeMarker.querySelector("h3") as HTMLElement;
    if (episodeNumber) {
      const existingEpisode = existingSeason?.episodes.find((episode) => episode.episodeNumber === episodeNumber);
      const watchedEpisode = existingEpisode?.watched ?? false;

      const eye = episodeMarker.querySelector("i") as HTMLElement;
      if (eye) {
        eye.id = `${EpisodeState[watchedEpisode ? EpisodeState.Watched : EpisodeState.NotWatched]}-episode-${episodeNumber}`;
      }

      if (watchedEpisode) {
        header.innerHTML = "Folge gesehen";
        eye.className = "fa fa-eye-slash";
      } else {
        header.innerHTML = "Folge nicht gesehen";
        eye.className = "fa fa-eye";
      }

      episodeMarker.addEventListener("click", () => {
        const anime = getExistingAnime();
        const existingEpisode = getExistingEpisode(episodeNumber);

        existingEpisode.watched = !existingEpisode.watched;
        setAnimeWatchList(animeWatchList);
        doFancyStuff(anime);

        if (existingEpisode.watched) {
          header.innerHTML = "Folge gesehen";
          eye.className = "fa fa-eye-slash";
        } else {
          header.innerHTML = "Folge nicht gesehen";
          eye.className = "fa fa-eye";
        }
      });
    }
  }

  function markEpisodeAsWatched(episodeNumber: string, episodeState: EpisodeState) {
    const episodeButtonId = episodeNumber;
    const listEpisode = episodes[Number.parseInt(episodeButtonId, 10) - 1];

    const tableEpisode = episodesListTable?.querySelector<HTMLTableRowElement>(`[data-episode-season-id='${episodeNumber}']`);

    if (episodeState === EpisodeState.NotWatched) {
      listEpisode.classList.remove("watched");
      listEpisode.classList.remove("watching");
      if (tableEpisode) {
        tableEpisode.style.cssText = "";
        tableEpisode.classList.remove("watched");
        tableEpisode.classList.remove("watching");
      }
    } else if (episodeState === EpisodeState.Watched) {
      listEpisode.classList.remove("watching");
      listEpisode.classList.add("watched");
      if (tableEpisode) {
        tableEpisode.style.cssText = "";
        tableEpisode.classList.remove("watching");
        tableEpisode.classList.add("watched");
      }
    } else if (episodeState === EpisodeState.Watching) {
      const watchedAnimeEpisode = getExistingEpisode(episodeButtonId, activeSeason.innerHTML);
      const progress = watchedAnimeEpisode.watchTime;
      if (!progress) return;

      listEpisode.classList.remove("watched");
      listEpisode.classList.add("watching");
      if (tableEpisode) {
        tableEpisode.classList.add("watching");
        tableEpisode.style.setProperty("--progress", `${progress}%`);
      }
    }
  }

  function markSeasonAsWatched(seasonNumber: string, seasonState: EpisodeState) {
    const season = seasons.find((season) => season.innerHTML === seasonNumber);

    if (seasonState === EpisodeState.NotWatched) {
      season?.classList.remove("watching");
      season?.classList.remove("watched");
    } else if (seasonState === EpisodeState.Watched) {
      season?.classList.remove("watching");
      season?.classList.add("watched");
    } else if (seasonState === EpisodeState.Watching) {
      season?.classList.remove("watched");
      season?.classList.add("watching");
    }
  }

  function markEpisodeAsFiller(episodeNumber: string, isFiller: boolean) {
    const listEpisode = episodes[Number.parseInt(episodeNumber, 10) - 1] as HTMLAnchorElement;
    const tableEpisode = episodesListTable?.querySelector<HTMLTableRowElement>(`[data-episode-season-id='${episodeNumber}']`);

    if (isFiller) {
      listEpisode.classList.add("filler");
      if (tableEpisode) {
        tableEpisode.classList.add("filler");
      }
    } else {
      listEpisode.classList.remove("filler");
      if (tableEpisode) {
        tableEpisode.classList.remove("filler");
      }
    }
  }

  function doFancyStuff(anime: WatchListAnime) {
    const title = location.pathname.split("/").at(3);
    if (title && title in fillerList) {
      const fillers = fillerList[title].filter((filler) => filler.season.toString() === activeSeason.innerHTML && filler.isFiller);
      for (const filler of fillers) {
        markEpisodeAsFiller(filler.episode.toString(), filler.isFiller);
      }
    }

    for (const season of anime.seasons) {
      const watchedEpisodes = season.episodes.filter((episode) => episode.watched || episode.watchTime === 100);
      const watchingEpisodes = season.episodes.filter((episode) => !episode.watched && episode.watchTime < 100);

      const isSeasonWatched = season.watched || season.allEpisodesNumber === watchedEpisodes.length;
      const isSeasonWatching = !isSeasonWatched && watchingEpisodes.length > 0 && watchingEpisodes.length < season.allEpisodesNumber;

      if (isSeasonWatched) {
        markSeasonAsWatched(season.seasonNumber, EpisodeState.Watched);
      } else if (isSeasonWatching) {
        markSeasonAsWatched(season.seasonNumber, EpisodeState.Watching);
      } else {
        markSeasonAsWatched(season.seasonNumber, EpisodeState.NotWatched);
      }

      if (season.seasonNumber !== activeSeason.innerHTML) continue;
      for (const episode of season.episodes) {
        const isEpisodeWatched = episode.watched || episode.watchTime === 100;
        const isEpisodeWatching = !episode.watched && episode.watchTime > 0 && episode.watchTime < 100;

        if (isEpisodeWatched) {
          markEpisodeAsWatched(episode.episodeNumber, EpisodeState.Watched);
        } else if (isEpisodeWatching) {
          markEpisodeAsWatched(episode.episodeNumber, EpisodeState.Watching);
        } else {
          markEpisodeAsWatched(episode.episodeNumber, EpisodeState.NotWatched);
        }
      }
    }
  }

  doFancyStuff(existingAnime as WatchListAnime);
}

updateButtons();
