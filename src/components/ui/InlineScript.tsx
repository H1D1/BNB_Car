/**
 * Inline <script> that runs during HTML parsing (before first paint). On the client React
 * renders it as text/plain so it never re-executes or warns; suppressHydrationWarning
 * accepts the type difference. See Next docs: "Preventing flash before hydration".
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
