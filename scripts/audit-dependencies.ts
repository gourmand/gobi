import { readFileSync, existsSync, rmSync, mkdirSync, PathLike } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import * as XLSX from "xlsx";

const readJSON = <T>(p: PathLike): T =>
  JSON.parse(readFileSync(p, "utf8")) satisfies T;

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "audit_output");

if (existsSync(OUTPUT_DIR))
  rmSync(OUTPUT_DIR, { force: true, recursive: true });
mkdirSync(OUTPUT_DIR);

const OUTPUT_OVERVIEW = path.join(OUTPUT_DIR, "dependency_overview.xlsx");

type DepMap = Record<string, string>;

interface PackageInfo {
  name: string;
  dir: string;
  deps: DepMap;
  devDeps: DepMap;
  peerDeps: DepMap;
}

type DependencyData = [string, string];

interface Cell {
  c: number;
  r: number;
}

interface MergeRange {
  s: Cell;
  e: Cell;
}

interface TableHeader {
  mergeAdd: MergeRange;
  title: string;
}

interface Table {
  buildHeader: (startCell: Cell) => TableHeader;
  data: DependencyData[];
}

interface SheetLayout {
  data: any[][];
  merges: MergeRange[];
}

const sortEntries = (obj: DepMap = {}): DependencyData[] => {
  return Object.entries(obj).sort((a: DependencyData, b: DependencyData) =>
    a[0].localeCompare(b[0]),
  );
};

const sanitizeSheetName = (name: string | undefined): string => {
  const safe = (name ?? "sheet").replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
  return safe.length ? safe : "sheet";
};

const sanitizeFileBase = (name: string | undefined): string => {
  return (name ?? "package").replace(/[^a-zA-Z0-9._-]/g, "_");
};

const createTable = (title: string, data: DependencyData[]): Table => {
  const buildHeader = (startCell: Cell) => ({
    title,
    mergeAdd: {
      s: startCell,
      e: {
        c: startCell.c + 1,
        r: startCell.r,
      },
    },
  });

  return {
    data,
    buildHeader,
  };
};

const layoutTablesHoriztontally = (tables: Table[]): SheetLayout => {
  const mergeRow = 0;
  let tableAlignColumn = 0;
  const merges: MergeRange[] = [];
  const data = [[]];
  const padColumn = (column: number): void => {
    if (!data[column]) data[column] = [];
    while (data[column].length < tableAlignColumn) data[column].push("");
  };
  for (const table of tables) {
    if (table.data.length === 0) continue;
    const header = table.buildHeader({ c: tableAlignColumn, r: mergeRow });
    data[0].push(header.title, "", "");
    merges.push(header.mergeAdd);
    padColumn(1);
    data[1].push("Package", "Version");
    for (const [index, row] of table.data.entries()) {
      const column = index + 2;
      padColumn(column);
      data[column].push(...row);
    }
    tableAlignColumn += 3;
  }
  return {
    data,
    merges,
  };
};

const createSheetForPackage = (pkgInfo: PackageInfo): XLSX.WorkSheet => {
  const { deps, devDeps, peerDeps } = pkgInfo;
  const tables: Table[] = [
    createTable("dependencies", sortEntries(deps)),
    createTable("devDependencies", sortEntries(devDeps)),
    createTable("peerDependencies", sortEntries(peerDeps)),
  ];
  const layout = layoutTablesHoriztontally(tables);

  const ws = XLSX.utils.aoa_to_sheet(layout.data);
  (ws as any)["!merges"] = [...layout.merges];

  // simple auto column width
  const colWidths: number[] = new Array(tables.length * 3).fill(5);

  for (const row of layout.data) {
    for (let i = 0; i < row.length; i++) {
      const len = String(row[i] ?? "").length;
      colWidths[i] = Math.max(colWidths[i], len + 2);
    }
  }
  (ws as any)["!cols"] = colWidths.map((width) => ({ wch: width }));
  return ws;
};

type PnpmListNode =
  | {
      path?: string;
      name?: string;
      private?: boolean;
      dependencies?: Record<string, PnpmListNode>;
      devDependencies?: Record<string, PnpmListNode>;
      optionalDependencies?: Record<string, PnpmListNode>;
      packages?: PnpmListNode[];
    }
  | PnpmListNode[];

const collectRootAndWorkspacePackages = (): {
  rootInfo: PackageInfo;
  workspacePkgs: PackageInfo[];
} => {
  // Root package.json
  const rootPkgJsonPath = path.join(ROOT_DIR, "package.json");
  if (!existsSync(rootPkgJsonPath)) {
    console.error("No package.json found at repo root.");
    process.exit(1);
  }
  const rootPkg = readJSON<any>(rootPkgJsonPath);
  const rootInfo: PackageInfo = {
    name: rootPkg.name || "(root)",
    dir: ROOT_DIR,
    deps: rootPkg.dependencies || {},
    devDeps: rootPkg.devDependencies || {},
    peerDeps: rootPkg.peerDependencies || {},
  };

  // Discover workspace packages via pnpm
  let listJson: PnpmListNode = [];
  try {
    const out = execSync("pnpm -r list --depth -1 --json", {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
    listJson = JSON.parse(out) as PnpmListNode;
  } catch {
    console.error(
      "Failed to run 'pnpm -r list --depth -1 --json'. Falling back to empty list.",
    );
    listJson = [];
  }

  // Traverse pnpm output to collect unique package paths
  const pkgPaths = new Set<string>();
  const visit = (node: PnpmListNode | undefined): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (node.path && path.resolve(node.path) !== ROOT_DIR) {
      pkgPaths.add(path.resolve(node.path));
    }
    if (node.dependencies) Object.values(node.dependencies).forEach(visit);
    if (node.devDependencies)
      Object.values(node.devDependencies).forEach(visit);
    if (node.optionalDependencies)
      Object.values(node.optionalDependencies).forEach(visit);
    if (node.packages) node.packages.forEach(visit);
  };
  visit(listJson);

  const workspacePkgs: PackageInfo[] = [];
  for (const p of pkgPaths) {
    const pj = path.join(p, "package.json");
    if (!existsSync(pj)) continue;
    const j = readJSON<any>(pj);
    workspacePkgs.push({
      name: j.name || path.basename(p),
      dir: p,
      deps: j.dependencies || {},
      devDeps: j.devDependencies || {},
      peerDeps: j.peerDependencies || {},
    });
  }

  workspacePkgs.sort((a, b) => a.name.localeCompare(b.name));
  return { rootInfo, workspacePkgs };
};

const writeOverviewXlsx = (
  rootInfo: PackageInfo,
  workspacePkgs: PackageInfo[],
): void => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    createSheetForPackage(rootInfo),
    sanitizeSheetName("(root)"),
  );
  for (const pkg of workspacePkgs) {
    XLSX.utils.book_append_sheet(
      wb,
      createSheetForPackage(pkg),
      sanitizeSheetName(pkg.name),
    );
  }
  XLSX.writeFile(wb, OUTPUT_OVERVIEW);
  console.log(`Wrote ${OUTPUT_OVERVIEW}`);
};

const writePerPackageFiles = (workspacePkgs: PackageInfo[]): void => {
  for (const pkg of workspacePkgs) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      createSheetForPackage(pkg),
      sanitizeSheetName(pkg.name),
    );
    const base = sanitizeFileBase(pkg.name);
    const outPath = path.join(OUTPUT_DIR, `${base}-dependencies.xlsx`);
    XLSX.writeFile(wb, outPath);
    console.log(`Wrote ${outPath}`);
  }
};

const main = (): void => {
  const { rootInfo, workspacePkgs } = collectRootAndWorkspacePackages();
  writeOverviewXlsx(rootInfo, workspacePkgs);
  writePerPackageFiles(workspacePkgs);
};

main();
