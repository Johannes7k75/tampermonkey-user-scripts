import { GM_getValue, GM_setValue } from "$";

// ==========================================
// ⚙️ CUSTOM SETTINGS & NAMING TEMPLATES
// Available tokens:
// {room}  -> Room name extracted from URL
// {date}  -> YYYY-MM-DD
// {time}  -> HH-MM-SS
// {index} -> Sequential number (001, 002...)
// {id}    -> Participant / Video element ID
// ==========================================
export interface AppConfig {
    videoTemplate: string;
    snapTemplate: string;
    imageFormat: "image/png" | "image/jpeg";
    imageExt: "png" | "jpg";
    snapshotSubfolder: string;
    recordingSubfolder: string;
}

export const DEFAULT_CONFIG: AppConfig = {
    videoTemplate: "{room}_{date}_{time}_{index}",
    snapTemplate: "{room}_{date}_{time}_{index}",
    imageFormat: "image/png",
    imageExt: "png",
    snapshotSubfolder: "",
    recordingSubfolder: "",
};

export interface Counters {
    snapshot: number;
    video: number;
}

const DEFAULT_COUNTERS: Counters = { snapshot: 1, video: 1 };

// Single source of truth for filename template tokens. Used by:
//   - resolveTemplate() to substitute {name} → value
//   - settings panel hints + clickable badges
//   - "{...}-autocomplete" dropdown while editing a template
export interface Token {
    name: string;
    description: string;
}

export const TOKENS: readonly Token[] = [
    { name: "room", description: "Room name extracted from the URL" },
    { name: "date", description: "Current date (YYYY-MM-DD)" },
    { name: "time", description: "Current time (HH-MM-SS)" },
    { name: "index", description: "Sequential snapshot or recording number (001, 002, ...)" },
    { name: "id", description: "Participant / video element ID" },
];

const CONFIG_KEY = "jvc_config_v1";
const COUNTERS_KEY = "jvc_counters_v1";

export function loadConfig(): AppConfig {
    return GM_getValue<AppConfig>(CONFIG_KEY, DEFAULT_CONFIG);
}

export function saveConfig(config: AppConfig): void {
    GM_setValue(CONFIG_KEY, config);
}

export function loadCounters(): Counters {
    return GM_getValue<Counters>(COUNTERS_KEY, DEFAULT_COUNTERS);
}

export function saveCounters(counters: Counters): void {
    GM_setValue(COUNTERS_KEY, counters);
}

export function resetCounters(): void {
    saveCounters({ ...DEFAULT_COUNTERS });
}