import { PdfLogo } from "@/assests/assestsIndex";
import { useScreenSize } from "@/components/Chatbot/hooks/useScreenSize";
import { Download, FileWarning } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type ImageWithFallbackProps = {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  canDownload?: boolean;
  preview?: boolean;
};

// Constants
const FILE_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] as string[],
  video: ["mp4", "webm", "ogg"] as string[],
  audio: ["mp3", "wav", "aac", "flac"] as string[],
  pdf: ["pdf"] as string[],
};

const FALLBACK_ICON = "https://cdn1.iconfinder.com/data/icons/leto-files/64/leto_files-68-128.png";

// Memoized utility function
const getFileType = async (url: string): Promise<string> => {
  if (!url) return "other";

  // fast path: still try extension first
  const extension = url?.split(".")?.pop()?.toLowerCase()?.split("?")[0] || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension)) return "image";
  if (["mp4", "webm", "ogg", "mov"].includes(extension)) return "video";
  if (["mp3", "wav", "aac", "flac"].includes(extension)) return "audio";
  if (["pdf"].includes(extension)) return "pdf";

  // fallback: ask the server what it actually is
  try {
    const res = await fetch(url, { method: "HEAD" });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("video/")) return "video";
    if (contentType.startsWith("audio/")) return "audio";
    if (contentType === "application/pdf") return "pdf";
  } catch {
    // network/CORS error, fall through
  }

  return "other"; // e.g. xlsx, csv, html, zip, etc.
};

// Memoized play button SVG
const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-white mt-1"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// Memoized error component
const ErrorDisplay = () => (
  <div className="w-64 h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700/60 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20 backdrop-blur-sm transition-all text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/40">
    <div className="bg-gray-200/60 dark:bg-gray-700/50 p-3 rounded-full mb-3 ring-4 ring-gray-50 dark:ring-gray-800/50">
      <FileWarning className="w-6 h-6 text-gray-400 dark:text-gray-500" />
    </div>
    <span className="text-sm font-medium">Failed to load media</span>
  </div>
);

// Memoized download button
const DownloadButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="absolute top-2 right-2 p-2 bg-white/70 dark:bg-black/50 backdrop-blur-md text-gray-800 dark:text-gray-200 shadow-md rounded-full md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-white dark:hover:bg-black/80 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 z-10"
  >
    <Download size={16} strokeWidth={2.5} />
  </button>
);

const ImageWithFallback = ({
  src,
  alt = "attachment",
  style,
  canDownload = true,
  preview = false
}: ImageWithFallbackProps) => {
  const [error, setError] = useState(false);
  const { isSmallScreen } = useScreenSize();

  // getFileType is async, so resolve it into state
  const [fileType, setFileType] = useState("");

  useEffect(() => {
    let cancelled = false;
    getFileType(src).then((type) => {
      if (!cancelled) setFileType(type);
    });
    return () => { cancelled = true; };
  }, [src]);

  // Memoized video type for source element
  const videoType = useMemo(() =>
    fileType === "video" ? `video/${src.split('?')[0].split('.').pop()}` : "",
    [fileType, src]
  );

  // Memoized audio type for source element
  const audioType = useMemo(() =>
    fileType === "audio" ? `audio/${src.split('?')[0].split('.').pop()}` : "",
    [fileType, src]
  );

  // Memoized callbacks
  const handleError = useCallback(() => setError(true), []);

  const handleClick = useCallback(() => {
    window.open(src, "_blank");
  }, [src]);

  const downloadFile = useCallback(() => {
    window.parent.postMessage({
      type: "downloadAttachment",
      data: { url: src }
    }, "*");
  }, [src]);

  // Memoized container classes
  const containerClasses = useMemo(() =>
    `flex relative group ${isSmallScreen ? 'max-w-[80%]' : 'max-w-[40%]'} h-auto rounded-2xl cursor-pointer transition-all duration-300`,
    [isSmallScreen]
  );

  const renderContent = useCallback(() => {
    if (error) return <ErrorDisplay />;

    switch (fileType) {
      case "image":
        return (
          <img
            src={src}
            alt={alt}
            onError={handleError}
            onClick={handleClick}
            style={style}
            className="rounded-2xl shadow-sm group-hover:shadow-md transition-all duration-300"
          />
        );

      case "video":
        return preview ? (
          <div
            className="max-w-full rounded-md relative"
            style={style}
            onClick={handleClick}
          >
            <video
              className="w-full h-full object-cover rounded-md"
              onError={handleError}
            >
              <source src={src} type={videoType} />
            </video>
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
              <div className="w-14 h-14 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl border border-white/20 group-hover:scale-110 transition-transform duration-300">
                <PlayIcon />
              </div>
            </div>
          </div>
        ) : (
          <video
            controls
            className="max-w-full rounded-md"
            onError={handleError}
            style={style}
          >
            <source src={src} />
            Your browser does not support the video tag.
          </video>
        );

      case "audio":
        return (
          <div className="w-full min-w-[300px] pr-10 relative">
            <audio
              controls
              onError={handleError}
              className="w-full"
            >
              <source src={src} type={audioType} />
            </audio>
          </div>
        );

      case "pdf":
        return (
          <Image
            src={PdfLogo}
            alt={alt}
            width={100}
            height={100}
            onClick={handleClick}
            style={style}
          />
        );

      default:
        return (
          <img
            src={FALLBACK_ICON}
            alt={alt}
            onError={handleError}
            onClick={handleClick}
            style={style}
          />
        );
    }
  }, [error, fileType, src, alt, style, preview, handleError, handleClick, videoType, audioType]);

  return (
    <div className={containerClasses}>
      {renderContent()}
      {!error && canDownload && <DownloadButton onClick={downloadFile} />}
    </div>
  );
};

export default ImageWithFallback;