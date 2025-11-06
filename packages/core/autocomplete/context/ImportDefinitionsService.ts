import { IDE, RangeInFileWithContents } from "../../index";
import { PrecalculatedLruCache } from "../../util/LruCache";
import {
  getFullLanguageName,
  getParserForFile,
  getQueryForFile,
} from "../../util/treeSitter";
import { findUriInDirs } from "../../util/uri";

interface FileInfo {
  imports: { [key: string]: RangeInFileWithContents[] };
}

export class ImportDefinitionsService {
  static N = 10;

  private cache: PrecalculatedLruCache<FileInfo> =
    new PrecalculatedLruCache<FileInfo>(
      this._getFileInfo.bind(this),
      ImportDefinitionsService.N,
    );

  constructor(private readonly ide: IDE) {
    ide.onDidChangeActiveTextEditor((filepath) => {
      this.cache
        .initKey(filepath)
        .catch((e) =>
          console.warn(
            `Failed to initialize ImportDefinitionService: ${e.message}`,
          ),
        );
    });
  }

  get(filepath: string): FileInfo | undefined {
    return this.cache.get(filepath);
  }

  private async _getFileInfo(filepath: string): Promise<FileInfo | null> {
    if (filepath.endsWith(".ipynb")) {
      // Commenting out this line was the solution to https://github.com/gourmand/gobi/issues/1463
      return null;
    }

    const parser = await getParserForFile(filepath);
    if (!parser) {
      return {
        imports: {},
      };
    }

    let fileContents: string | undefined = undefined;
    try {
      const { foundInDir } = findUriInDirs(
        filepath,
        await this.ide.getWorkspaceDirs(),
      );
      if (!foundInDir) {
        return null;
      } else {
        fileContents = await this.ide.readFile(filepath);
      }
    } catch (err) {
      // File removed
      return null;
    }

    // Keep the parse call simple to avoid overload signature mismatches
    // across different web-tree-sitter runtime builds. We only need the
    // resulting tree.rootNode for queries below.
    const ast: any = parser.parse(fileContents);
    const language = getFullLanguageName(filepath);
    const query = await getQueryForFile(
      filepath,
      `import-queries/${language}.scm`,
    );
    if (!query) {
      return {
        imports: {},
      };
    }

    const matches: any[] = (query?.matches(ast.rootNode) as any[]) || [];

    const fileInfo: FileInfo = {
      imports: {},
    };
    for (const match of matches) {
      try {
        const firstCapture = match?.captures?.[0];
        if (!firstCapture || !firstCapture.node) continue;
        const startPosition = firstCapture.node.startPosition;
        const defs = await this.ide.gotoDefinition({
          filepath,
          position: {
            line: startPosition.row,
            character: startPosition.column,
          },
        });
        fileInfo.imports[firstCapture.node.text] = await Promise.all(
          defs.map(async (def: any) => ({
            ...def,
            contents: await this.ide.readRangeInFile(def.filepath, def.range),
          })),
        );
      } catch (e) {
        console.warn("ImportDefinitionsService: failed to resolve match", e);
      }
    }

    return fileInfo;
  }
}
