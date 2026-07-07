"use client";

import Image from "next/image";
import { useState } from "react";
import { getFallbackCoverUrl, getHighQualityCoverUrl } from "@/lib/coverImage";

interface CoverImageProps {
  coverUrl: string;
  alt: string;
  className?: string;
  sizes?: string;
}

export function CoverImage({ coverUrl, alt, className, sizes }: CoverImageProps) {
  const highQualityCoverUrl = getHighQualityCoverUrl(coverUrl) ?? coverUrl;
  const fallbackCoverUrl = getFallbackCoverUrl(coverUrl);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const coverSrc = failedCoverUrl === highQualityCoverUrl && fallbackCoverUrl ? fallbackCoverUrl : highQualityCoverUrl;

  return (
    <Image
      src={coverSrc}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      onError={() => {
        if (fallbackCoverUrl && coverSrc === highQualityCoverUrl) {
          setFailedCoverUrl(highQualityCoverUrl);
        }
      }}
    />
  );
}
