"use client";
// ─── Antra Flux — single-page application shell ──────────────────────────────
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "@/components/flux/header";
import { Footer } from "@/components/flux/footer";
import { HomeView } from "@/components/flux/home-view";
import { SearchView } from "@/components/flux/search-view";
import { ApiDocsView } from "@/components/flux/api-docs-view";
import { SettingsView } from "@/components/flux/settings-view";
import { AlbumModal } from "@/components/flux/album-modal";
import { PlayerBar } from "@/components/flux/player-bar";
import { useFlux } from "@/lib/store";

export default function Page() {
  const view = useFlux((s) => s.view);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {view === "home" && <HomeView />}
            {view === "search" && <SearchView />}
            {view === "api" && <ApiDocsView />}
            {view === "settings" && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
      <PlayerBar />
      <AlbumModal />
    </div>
  );
}
