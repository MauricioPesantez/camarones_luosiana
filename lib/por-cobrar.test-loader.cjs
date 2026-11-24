const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const {
  transpileModule,
  ModuleKind,
  ScriptTarget,
  JsxEmit,
} = require("typescript");

/** Ejecuta los módulos reales con DB/sesión explícitas, nunca con el .env del negocio. */
exports.loader = function loader(db, usuario) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const js = transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2020,
        jsx: JsxEmit.ReactJSX,
      },
    }).outputText;
    const localRequire = createRequire(file);
    const requireTest = (name) => {
      if (name === "server-only") return {};
      if (name === "next/server")
        return { NextResponse: { json: Response.json } };
      if (name === "next/navigation")
        return {
          redirect: (url) => {
            throw new Error(`REDIRECT:${url}`);
          },
        };
      if (name === "next/link") return { __esModule: true, default: "a" };
      const candidate = name.startsWith("@/")
        ? path.resolve(name.slice(2))
        : name.startsWith(".")
          ? path.resolve(path.dirname(file), name)
          : null;
      if (candidate === path.resolve("lib/db")) return { prisma: db };
      if (candidate === path.resolve("lib/session"))
        return {
          getAuthenticatedUser: async () => usuario(),
          canCollectPayments: (u) =>
            ["admin", "mesero", "digital"].includes(u.rol),
          roleHome: (rol) => `/${rol}`,
          roleOrdersHome: (rol, reason) =>
            `/${rol}?vista=ordenes&cobro=${reason}`,
        };
      if (candidate === path.resolve("lib/storage"))
        return {
          objectExists: async () => true,
          storageConfigurado: () => false,
        };
      if (candidate) {
        const resolved = [".ts", ".tsx", ""]
          .map((ext) => candidate + ext)
          .find(existsSync);
        if (resolved) return load(resolved);
      }
      return localRequire(name);
    };
    new Function("require", "module", "exports", js)(
      requireTest,
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
};
