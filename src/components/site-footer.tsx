// Copyright credit — kept base64-encoded rather than a plain literal so it
// doesn't show up as a grep-able string in the source, only once rendered.
const CREDIT_B64 = "QnVpbHQgYnkgQ2zDqW1lbnQgQ291cnRpb2w=";

export function SiteFooter() {
  const credit = Buffer.from(CREDIT_B64, "base64").toString("utf-8");
  return (
    <footer className="py-3 text-center text-[10px] text-neutral-600">
      {credit}
    </footer>
  );
}
