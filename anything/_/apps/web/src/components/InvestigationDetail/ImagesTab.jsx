import { Image as ImageIcon } from "lucide-react";

const getHost = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
};

export function ImagesTab({ investigation, imagesItems, hasImages }) {
  const invId = investigation?.id;
  const downloadHref = invId
    ? `/api/investigations/${invId}/images`
    : undefined;
  const downloadName = invId ? `investigation_${invId}_images.zip` : undefined;

  return (
    <section className="space-y-4">
      <div className="bg-[#2D384E] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <ImageIcon size={16} /> Images Recovered
          </h3>
          <div className="flex items-center gap-3">
            {hasImages && invId && (
              <a
                href={downloadHref}
                className="px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] text-sm"
                download={downloadName}
              >
                Download all (ZIP)
              </a>
            )}
            {(!hasImages || !invId) && (
              <span className="text-slate-400 text-sm">None found</span>
            )}
          </div>
        </div>

        {hasImages && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {imagesItems.map((img, idx) => {
              const url = img?.url;
              const hasExif = !!img?.exif?.has_exif;
              const reverse = img?.reverse_search || {};
              const sourceUrl = img?.source_url;
              const host = sourceUrl ? getHost(sourceUrl) : null;
              const ex = img?.exif || {};
              return (
                <div
                  key={idx}
                  className="border border-[#37425B] rounded overflow-hidden bg-[#283247]"
                >
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Recovered ${idx + 1}`}
                      className="w-full h-[160px] object-cover bg-[#1f2940]"
                      loading="lazy"
                    />
                  </a>
                  <div className="p-2 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D1FF] hover:underline"
                        >
                          {url}
                        </a>
                      </div>
                      {host && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-full bg-[#00D1FF]/10 text-[#00D1FF] whitespace-nowrap"
                          title={sourceUrl}
                        >
                          {host}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          hasExif
                            ? "bg-blue-500/10 text-blue-300"
                            : "bg-slate-500/10 text-slate-300"
                        }`}
                      >
                        {hasExif ? "EXIF" : "No EXIF"}
                      </span>
                      {hasExif && (
                        <>
                          {ex.make && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-300">
                              {ex.make}
                            </span>
                          )}
                          {ex.model && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-300">
                              {ex.model}
                            </span>
                          )}
                          {(ex.date_time_original || ex.date_time) && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-300">
                              {ex.date_time_original || ex.date_time}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {reverse.google && (
                        <a
                          href={reverse.google}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D1FF] hover:underline"
                        >
                          Google
                        </a>
                      )}
                      {reverse.bing && (
                        <a
                          href={reverse.bing}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D1FF] hover:underline"
                        >
                          Bing
                        </a>
                      )}
                      {reverse.yandex && (
                        <a
                          href={reverse.yandex}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D1FF] hover:underline"
                        >
                          Yandex
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
