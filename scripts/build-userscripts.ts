type SourceScript = {
  id: string;
  type: "source";
  directory: string;
  source: string;
  asset: string;
};

type ViteScript = {
  id: string;
  type: "vite";
  directory: string;
  output: string;
  asset: string;
};

type Script = SourceScript | ViteScript;

type RawScript = {
  id?: unknown;
  type?: unknown;
  asset?: unknown;
  source?: unknown;
  output?: unknown;
};

const root = `${import.meta.dir}/..`;
const outputDirectory = `${root}/dist`;

function relativePath(path: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

async function readScripts(): Promise<Script[]> {
  const configs = Array.from(
    new Bun.Glob("**/script.json").scanSync({
      cwd: root,
      onlyFiles: true,
      followSymlinks: false,
    }),
  )
    .filter(
      (path) =>
        !path.split("/").some((part) => part === "node_modules" || part.endsWith(".old")),
    )
    .map((path) => `${root}/${path}`);
  const scripts: Script[] = [];

  for (const configPath of configs) {
    const config = (await Bun.file(configPath).json()) as RawScript;
    const directory = configPath.slice(0, configPath.lastIndexOf("/"));

    if (
      typeof config.id !== "string" ||
      (config.type !== "source" && config.type !== "vite") ||
      typeof config.asset !== "string"
    ) {
      throw new Error(`Invalid userscript configuration: ${relativePath(configPath)}`);
    }

    if (config.type === "source" && typeof config.source === "string") {
      scripts.push({
        id: config.id,
        type: config.type,
        directory,
        source: config.source,
        asset: config.asset,
      });
    } else if (config.type === "vite" && typeof config.output === "string") {
      scripts.push({
        id: config.id,
        type: config.type,
        directory,
        output: config.output,
        asset: config.asset,
      });
    } else {
      throw new Error(`Incomplete userscript configuration: ${relativePath(configPath)}`);
    }
  }

  return scripts.sort((left, right) => left.id.localeCompare(right.id));
}

async function runBuild(script: ViteScript): Promise<void> {
  const process = Bun.spawn(["bun", "run", "build"], {
    cwd: script.directory,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;

  if (exitCode !== 0) {
    throw new Error(`Build failed for ${script.id} with exit code ${exitCode}.`);
  }
}

async function copySource(script: SourceScript): Promise<void> {
  const sourcePath = `${script.directory}/${script.source}`;
  if (!(await Bun.file(sourcePath).exists())) {
    throw new Error(`Source file not found for ${script.id}: ${script.source}`);
  }
  await Bun.write(`${outputDirectory}/${script.asset}`, Bun.file(sourcePath));
}

async function copyBuilt(script: ViteScript): Promise<void> {
  const builtPath = `${script.directory}/dist/${script.output}`;
  if (!(await Bun.file(builtPath).exists())) {
    throw new Error(`Build output not found for ${script.id}: ${script.output}`);
  }
  await Bun.write(`${outputDirectory}/${script.asset}`, Bun.file(builtPath));
}

const scripts = await readScripts();
const assets = new Set<string>();
for (const script of scripts) {
  if (assets.has(script.asset)) {
    throw new Error(`Duplicate userscript asset name: ${script.asset}`);
  }
  assets.add(script.asset);
}

await Bun.$`rm -rf ${outputDirectory}`;
await Bun.$`mkdir -p ${outputDirectory}`;

for (const script of scripts) {
  process.stdout.write(`Building ${script.id}...\n`);
  if (script.type === "source") {
    await copySource(script);
  } else {
    await runBuild(script);
    await copyBuilt(script);
  }
}

process.stdout.write(`Built ${scripts.length} userscripts in ${relativePath(outputDirectory)}/\n`);
