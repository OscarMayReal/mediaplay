import { ICommonTagsResult, parseBlob, selectCover } from "music-metadata";

export type MediaLibraryTags = ICommonTagsResult & {pictureFormat?: string; pictureLoc?: string};

export async function regenerateLibraryDb({path, extensions}: {path: string, extensions: string[]}) {
    if (!window.fs.existsSync(path + "/MediaPlayDb")) {
        window.fs.mkdirSync(path + "/MediaPlayDb")
    }
    if (!window.fs.existsSync(path + "/MediaPlayDb/picture")) {
        window.fs.mkdirSync(path + "/MediaPlayDb/picture")
    }
    const db = {
        version: "1",
        metadataStore: {

        } as Record<string, MediaLibraryTags>
    }
    const allFiles = await window.fsPromises.readdir(path, {recursive: true})
    const files = allFiles.filter(item => {
        for (const extension of extensions) {
            if (item.endsWith(extension)) {
                return true
            }
        }
    });
    for (const file of files) {
        const mediafile = window.fs.readFileSync(path + "/" + file)
        const metadata = await parseBlob(new Blob([mediafile]))
        const common = metadata.common as MediaLibraryTags
        if (metadata.common.picture) {
            const cover = selectCover(metadata.common.picture)
            if (cover) {
                window.fs.writeFileSync(path + "/MediaPlayDb/picture/" + file.replaceAll("/", "_") + "." + cover?.format.split("/")[1], cover?.data)
                common.pictureFormat = cover?.format
                common.pictureLoc = path + "/MediaPlayDb/picture/" + file.replaceAll("/", "_") + "." + cover?.format.split("/")[1]
            }
        }
        metadata.common.picture = undefined
        db.metadataStore[file] = common
    }
    window.fs.writeFileSync(path + "/MediaPlayDb/db.json", JSON.stringify(db))
}
