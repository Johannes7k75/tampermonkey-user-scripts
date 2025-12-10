// ==UserScript==
// @name                  AniWorld Filler highlighter
// @description           Highlights Filler episodes on aniworld in red
// @namespace             https://github.com/Johannes7k75
// @version               1.0.2
// @match                 https://aniworld.to/anime/stream/*
// @updateURL             https://raw.githubusercontent.com/Johannes7k75/tampermonkey-user-scripts/refs/heads/main/Filler-Scraper/FillerHighlighter.js
// @downloadURL           https://raw.githubusercontent.com/Johannes7k75/tampermonkey-user-scripts/refs/heads/main/Filler-Scraper/FillerHighlighter.js
// @resource fillers.json https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/download/AniWorld-Filler/fillers.json
// @grant                 GM_getResourceText
// ==/UserScript==

(function () {
    "use strict";

    let fillerJson = {};

    try {
        fillerJson = JSON.parse(GM_getResourceText("fillers.json"));
    } catch (e) {
        console.warn("Could not parse Json file");
    }

    const anime = location.href.split("/").at(2)
    if (!anime || !(anime in fillerJson)) {
      return
    }
    const fillers = fillerJson[anime]
    const [seasons, episodes] = document.querySelectorAll("#stream ul")
    const activeSeason = seasons.querySelector("li .active")

    const style = document.createElement("style")
    document.head.appendChild(style)

    style.innerHTML = `
  .filler {
      background-color: rgb(161, 74, 64) !important;
      transition: unset !important;
  }

  .filler:hover:not(.anything), .active.filler:not(.anything) {
      color: rgb(161, 74, 64) !important;
      font-weight: bold;
  }
  `

    for (const ep of episodes.children) {
        const activeSeasonNum = Number.parseInt(activeSeason?.innerText)
        const episodeNumber = Number.parseInt(ep.querySelector("a")?.innerText)

        const isSameEpisode = (episode) => episode === episodeNumber
        const isSameSeason = (season) => season === activeSeasonNum

        const episodeData = fillers.find((e) => isSameEpisode(e.episode) && isSameSeason(e.season))

        if (!episodeData) continue;
        if (episodeData.isFiller) {
            ep.firstElementChild.classList.add("filler")
        }
    }
})();
