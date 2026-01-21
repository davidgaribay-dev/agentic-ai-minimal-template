import { useTranslation } from "react-i18next";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { SearchConversations } from "@/components/search-conversations";

export const Route = createFileRoute("/team/$teamId/search")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
  },
  component: TeamSearchPage,
});

function TeamSearchPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 md:py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">
          {t("search_page_title")}
        </h1>
      </div>
      <SearchConversations />
    </div>
  );
}
