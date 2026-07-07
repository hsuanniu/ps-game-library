const IGDB_IMAGE_HOST = "images.igdb.com/igdb/image/upload";
const IGDB_COVER_SIZE = "t_cover_big";
const IGDB_RETINA_COVER_SIZE = "t_cover_big_2x";

export function getHighQualityCoverUrl(coverUrl?: string) {
  if (!coverUrl || !isIgdbImageUrl(coverUrl)) {
    return coverUrl;
  }

  return coverUrl.replace(`/${IGDB_COVER_SIZE}/`, `/${IGDB_RETINA_COVER_SIZE}/`);
}

export function getFallbackCoverUrl(coverUrl?: string) {
  if (!coverUrl || !isIgdbImageUrl(coverUrl)) {
    return undefined;
  }

  return coverUrl.replace(`/${IGDB_RETINA_COVER_SIZE}/`, `/${IGDB_COVER_SIZE}/`);
}

function isIgdbImageUrl(coverUrl: string) {
  return coverUrl.includes(IGDB_IMAGE_HOST);
}
