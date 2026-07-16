import { ExternalLink, MapPin } from 'lucide-react';

interface LocationPreviewProps {
  latitude: number;
  longitude: number;
  compact?: boolean;
}

function LocationPreview({ latitude, longitude, compact = false }: LocationPreviewProps) {
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const embedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 no-underline"
      style={{ width: compact ? 200 : 250 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ height: compact ? 120 : 150, position: 'relative' }}>
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0, pointerEvents: 'none' }}
          loading="lazy"
          allowFullScreen={false}
        />
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800">
        <MapPin size={12} className="shrink-0" />
        <span className="truncate">View on Google Maps</span>
        <ExternalLink size={10} className="shrink-0 ml-auto" />
      </div>
    </a>
  );
}

export default LocationPreview;
