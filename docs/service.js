// Pages serves the photographs. The existing gallery service owns shared visitor data.
export const galleryService = 'https://i-was-here-photography.shenliwangxu.chatgpt.site';
export const serviceURL = path => new URL('/api/' + path, galleryService);
