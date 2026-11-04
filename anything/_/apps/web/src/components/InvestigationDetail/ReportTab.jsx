import { safeReportUrl } from '../../utils/reportSafety.js';

export function ReportTab({ investigation, user }) {
  const isAdminEmail =
    (user?.email || "").toLowerCase() === "glossontravis@gmail.com";
  const isAdmin = user?.role === "admin" || isAdminEmail;
  const isTrial =
    !isAdmin &&
    (!user?.subscription_plan || user?.subscription_plan === "trial");
  const pdfUrl = safeReportUrl(investigation.pdf_url, { allowRelative: true });

  return (
    <section className="space-y-4">
      <div className="bg-[var(--st-panel)] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">HTML Report</h3>
          {pdfUrl && !isTrial && (
            <a
              className="text-[var(--st-accent)] hover:underline"
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
          )}
        </div>
        {isTrial && (
          <div className="text-yellow-300 text-sm mt-2">
            Trial accounts cannot export reports. Please upgrade on the Billing
            page.
          </div>
        )}
        {investigation.html_content ? (
          <iframe
            title="report"
            className="w-full h-[600px] mt-3 bg-white rounded"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={investigation.html_content}
          />
        ) : (
          <div className="text-slate-300 mt-3">Report not generated yet.</div>
        )}
      </div>
    </section>
  );
}
