import { createHashRouter, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { ViewPage } from "./pages/ViewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotesPage } from "./pages/NotesPage";
import { SavedNotesPage } from "./pages/SavedNotesPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { ProjectNotesPage } from "./pages/ProjectNotesPage";

const RouteError = () => {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <main className="p-3">
      <section className="panel-card">
        <h1 className="font-heading text-sm">MindSnap Error</h1>
        <p className="mt-2 text-xs text-rose-300">{message}</p>
      </section>
    </main>
  );
};

export const router = createHashRouter([
  { path: "/", element: <DashboardPage />, errorElement: <RouteError /> },
  { path: "/view/:id", element: <ViewPage />, errorElement: <RouteError /> },
  { path: "/notes", element: <SavedNotesPage />, errorElement: <RouteError /> },
  { path: "/notes/:id", element: <NotesPage />, errorElement: <RouteError /> },
  { path: "/projects/:id/notes/:noteId", element: <ProjectNotesPage />, errorElement: <RouteError /> },
  { path: "/knowledge-base", element: <KnowledgeBasePage />, errorElement: <RouteError /> },
  { path: "/settings", element: <SettingsPage />, errorElement: <RouteError /> }
]);

