export function getLibraries() {
    return {
        music: window.app.getPath('music'),
        videos: window.app.getPath('videos'),
        photos: window.app.getPath('pictures'),
        documents: window.app.getPath('documents'),
        downloads: window.app.getPath('downloads')
    };
}