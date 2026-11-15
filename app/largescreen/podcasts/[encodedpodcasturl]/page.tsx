"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { MediaLibraryTags } from "@/lib/libraryDb"
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile"
import { FocusNode } from "@/components/focus"
import { ArrowLeftCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Podcast } from "podparse"
import { Fragment, Usable, use, useEffect, useState } from "react"

type PodcastDb = {version: string; podcasts: Record<string, Podcast>};
type MusicLibraryDb = {version: string; metadataStore: Record<string, MediaLibraryTags>};

function safeFileName(value: string, fallback: string) {
    return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || fallback
}

function episodeExtension(item: Podcast["episodes"][number]) {
    const url = new URL(item.enclosure.url)
    const fromUrl = url.pathname.match(/\.[a-z0-9]{2,5}$/i)?.[0]
    if (fromUrl) return fromUrl
    const type = (item.enclosure.type || "").split(";")[0].toLowerCase()
    return ({"audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/aac": ".aac", "audio/ogg": ".ogg", "audio/opus": ".opus", "audio/wav": ".wav", "audio/flac": ".flac", "audio/x-m4a": ".m4a"} as Record<string, string>)[type] || ".mp3"
}

export default function LargeScreenHome({params}: {params: Promise<{encodedpodcasturl: string}>}) {
    const {encodedpodcasturl} = use(params)
    const [downloading, setDownloading] = useState<Record<string, boolean>>({})
    const [downloaded, setDownloaded] = useState<Record<string, string>>({})
    const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({})
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const podcastdbPath = musicPath ? musicPath + "/MediaPlayDb/podcastdb.json" : null
    const library = useReadFileJson<PodcastDb>({path: podcastdbPath})
    const musicLibraryDb = useReadFileJson<MusicLibraryDb>({path: musicPath ? `${musicPath}/MediaPlayDb/db.json` : null})
    const MediaPlayerContext = useMediaPlayerContext()
    const router = useRouter()
    const show = library.data?.podcasts[decodeURIComponent(encodedpodcasturl)]

    useEffect(() => {
        if (!musicPath || !window.fs) return
        const showName = safeFileName(show?.meta.title || "Podcast", "Podcast")
        const files: Record<string, string> = {}
        const showFolder = window.fs.readdirSync(musicPath, {withFileTypes: true})
            .find(entry => entry.isDirectory() && entry.name.toLowerCase() === showName.toLowerCase())?.name
        if (showFolder) {
            const fileNames = window.fs.readdirSync(`${musicPath}/${showFolder}`)
            for (const item of show?.episodes || []) {
                const key = item.guid || item.enclosure.url
                const title = safeFileName(item.title || "Episode", "Episode")
                const fileName = fileNames.find(name => typeof name === "string" && name.toLowerCase().startsWith(`${title}.`.toLowerCase()))
                if (fileName) files[key] = `${showFolder}/${fileName}`
            }
        }
        setDownloaded(files)
    }, [musicPath, show])

    function playEpisode(item: Podcast["episodes"][number]) {
        if (!musicPath || !MediaPlayerContext || !window.app) return
        const showName = safeFileName(show?.meta.title || "Podcast", "Podcast")
        const title = safeFileName(item.title || "Episode", "Episode")
        const file = downloaded[item.guid || item.enclosure.url] || `${showName}/${title}${episodeExtension(item)}`
        const src = window.app.getLocalFileUrl(musicPath, file)
        const metadata = {
            ...musicLibraryDb.data?.metadataStore[file],
            title: musicLibraryDb.data?.metadataStore[file]?.title || item.title || "Episode",
            artist: musicLibraryDb.data?.metadataStore[file]?.artist || item.author || show?.meta.owner.name,
            album: musicLibraryDb.data?.metadataStore[file]?.album || show?.meta.title,
            path: file,
            image: `${musicPath}/MediaPlayDb/pictures/${file.replaceAll("/", "_")}`,
            type: "music" as const,
            src,
        }
        const player = MediaPlayerContext.audioPlayerRef.current
        if (!player) return
        MediaPlayerContext.setPlayerMetadata(metadata)
        MediaPlayerContext.setPlaylist([metadata])
        MediaPlayerContext.setPlaylistPos(0)
        player.src = src
        void player.play()
    }

    async function downloadEpisode(item: Podcast["episodes"][number]) {
        if (!musicPath || !window.app) return
        const key = item.guid || item.enclosure.url
        setDownloading(current => ({...current, [key]: true}))
        setDownloadErrors(current => ({...current, [key]: ""}))
        try {
            const showName = safeFileName(show?.meta.title || "Podcast", "Podcast")
            const title = safeFileName(item.title || "Episode", "Episode")
            const extension = episodeExtension(item)
            await window.app.downloadFile(item.enclosure.url, `${musicPath}/${showName}/${title}${extension}`)
            setDownloaded(current => ({...current, [key]: `${showName}/${title}${extension}`}))
        } catch (error) {
            setDownloadErrors(current => ({...current, [key]: error instanceof Error ? error.message : "Download failed"}))
        } finally {
            setDownloading(current => ({...current, [key]: false}))
        }
    }

    return <div className="w-full h-full flex flex-row">
        <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full w-full">
            <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pb-0">
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => router.back()}>
                    <ArrowLeftCircleIcon size={30} />
                    {show?.meta.title}
                </FocusNode>
            </FocusNode>
            <FocusNode orientation="vertical" className="flex-1 min-h-0 w-full [&_[data-slot=table-container]]:max-h-full [&_[data-slot=table-container]]:overflow-y-auto">
                {library.data && <Table className="mb-18 w-full">
                    <TableHeader className="bg-background h-[41px] [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                        <TableRow className="hover:bg-background border-b-0 text-xl" style={{borderBottomWidth: 0, maxHeight: 40, height: 40}}>
                            <TableHead className="w-12" />
                            <TableHead>Title</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-50">Downloaded</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {show?.episodes.map((item, index) => {
                            const key = item.guid || item.enclosure.url
                            const file = downloaded[key]
                            const isDownloading = downloading[key]
                            return <Fragment key={key}>
                                <FocusNode elementType="tr" orientation="horizontal" className={(MediaPlayerContext?.playerMetadata?.path === file ? "bg-foreground/5 hover:bg-foreground/5" : "even:bg-foreground/2") + " scroll-mt-[42px] border-transparent hover:bg-foreground/5 text-xl [&.isFocused]:bg-foreground/10"} onSelected={() => {
                                    if (file) playEpisode(item)
                                    else if (!isDownloading) void downloadEpisode(item)
                                }} onFocused={({currentNode}: any) => currentNode.elRef.current?.scrollIntoView({block: "nearest"})}>
                                    <TableHead className="w-12" />
                                    <TableCell className="truncate max-w-0">{item.title || "-"}</TableCell>
                                    <TableCell className="truncate max-w-0">{item.description || "-"}</TableCell>
                                    <TableCell className="truncate max-w-0">
                                        {file ? "Downloaded · select to play" : isDownloading ? "Downloading…" : musicPath ? "Select to download" : "No music library"}
                                        {downloadErrors[key] && <div className="text-destructive text-base">{downloadErrors[key]}</div>}
                                    </TableCell>
                                    <TableHead className="w-12" />
                                </FocusNode>
                            </Fragment>
                        })}
                    </TableBody>
                </Table>}
            </FocusNode>
        </FocusNode>
    </div>
}
