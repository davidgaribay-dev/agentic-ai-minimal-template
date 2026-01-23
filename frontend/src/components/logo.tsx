import { useTranslation } from "react-i18next";
import { testId } from "@/lib/test-id";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-10 w-10" }: LogoProps) {
  const { t } = useTranslation();
  return (
    <svg
      {...testId("app-logo")}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={t("aria_app_logo")}
    >
      <circle cx="50" cy="50" r="45" fill="currentColor" />
      <path
        d="M25 75L75 25"
        stroke="currentColor"
        strokeWidth="8"
        className="text-background"
      />
      <path
        d="M35 80L85 30"
        stroke="currentColor"
        strokeWidth="8"
        className="text-background"
      />
      <path
        d="M15 70L65 20"
        stroke="currentColor"
        strokeWidth="8"
        className="text-background"
      />
      <path
        d="M45 85L95 35"
        stroke="currentColor"
        strokeWidth="6"
        className="text-background"
      />
      <path
        d="M5 65L55 15"
        stroke="currentColor"
        strokeWidth="6"
        className="text-background"
      />
    </svg>
  );
}
