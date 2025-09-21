import React from "react";
import { Search, Columns, Zap, Hammer, Code, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Footer from "@/components/footer";
import Header from "@/components/header";

// ToolsPage.jsx
// Default-exported React component. TailwindCSS classes are used for styling.
// - Responsive centered grid of tool tiles
// - Search box to filter tools (client-side)
// - Each tile shows an icon, title and short description
// - Props: tools (array) can override default tools

const defaultTools = [
  {
    id: "Safety Stock Calculator",
    title: "Safety Stock Calculator",
    description:
      "Automatically formats code (JS/TS/JSON) to a consistent style.",
    icon: "Code",
    component: "/",
  },
  {
    id: "Supply Chain Planner",
    title: "Supply Chain Planner",
    description: "Compresses JS/CSS/HTML files for faster delivery.",
    icon: "Zap",
    component: "/",
  },
  {
    id: "Min-Max Calculator",
    title: "Min-Max Calculator",
    description:
      "Inspect and replay HTTP requests with detailed headers and body.",
    icon: "Columns",
    component: "<home/>",
  },
  {
    id: "builder",
    title: "Static Builder",
    description: "Build static bundles for production with smart caching.",
    icon: "Hammer",
    component: "<home/>",
  },
  {
    id: "settings",
    title: "Feature Flags",
    description: "Toggle features per-environment and target audience.",
    icon: "Settings",
    component: "<home/>",
  },
  {
    id: "searcher",
    title: "Site Search",
    description: "Index and search content with fuzzy matching and filters.",
    icon: "Search",
    component: "<home/>",
  },
];

const IconMap = {
  Search,
  Columns,
  Zap,
  Hammer,
  Code,
  Settings,
};

export default function Tools({ tools = defaultTools }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.id && t.id.toLowerCase().includes(q))
    );
  }, [query, tools]);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl">
          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-800">
              Tools
            </h1>
            <p className="text-slate-500 mt-1">
              Quickly access the tools you use most.
            </p>
          </header>

          <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools, e.g. 'formatter', 'search'..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={() => setQuery("")}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:brightness-95"
              >
                Reset
              </button>
            </div>
          </div>

          <main>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-500">
                Showing <strong>{filtered.length}</strong> tools
              </p>
              <div className="text-xs text-slate-400">
                Tip: click a tile to open a tool (hook up navigation where
                needed).
              </div>
            </div>

            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 place-items-stretch">
              {filtered.map((tool, idx) => {
                const Icon = IconMap[tool.icon] ?? IconMap.Code;

                return (
                  <motion.button
                    key={tool.id || idx}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left bg-white rounded-2xl p-5 shadow-sm hover:shadow-md border border-transparent hover:border-slate-100 transition-all"
                    onClick={() => {
                      // Placeholder: integrate your router or onOpen callback
                      // Example: navigate(`/tools/${tool.id}`)
                      console.log("Open tool", tool.id);
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-3 rounded-xl bg-slate-100">
                        <Icon className="w-6 h-6 text-slate-700" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-slate-800">
                          {tool.title}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {tool.description}
                        </p>
                        <div className="mt-3 text-xs text-slate-400">
                          ID: {tool.id}
                        </div>
                        <Link to={tool.component}>{tool.title}</Link>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </section>

            {filtered.length === 0 && (
              <div className="mt-8 text-center text-slate-500">
                No tools match your search. Try different keywords.
              </div>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
}
