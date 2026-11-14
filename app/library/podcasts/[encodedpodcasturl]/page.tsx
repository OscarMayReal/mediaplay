"use client"
import { ExpandableText } from "@/components/expandabletext";
import { useMediaPlayerContext } from "@/components/mediaPlayerContext";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { usePortableMediaDrive } from "@/lib/useDrives";
import type { MediaLibraryTags } from "@/lib/libraryDb";
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile";
import { DownloadIcon, PlayIcon, PodcastIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Podcast } from "podparse";
import { Usable, use, useEffect, useState } from "react";

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

export default function EmptyPage({params}: {params: Usable<{encodedpodcasturl: string}>}) {
    const {encodedpodcasturl} = use(params)
    const [podcast, setPodcast] = useState("")
    const [downloading, setDownloading] = useState<Record<string, boolean>>({})
    const [downloaded, setDownloaded] = useState<Record<string, string>>({})
    const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({})
    const drive = usePortableMediaDrive({autoReload: true})
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const podcastdbPath = musicPath ? musicPath + "/MediaPlayDb/podcastdb.json" : null
    const library = useReadFileJson<PodcastDb>({path: podcastdbPath})
    const musicLibraryDb = useReadFileJson<MusicLibraryDb>({path: musicPath ? `${musicPath}/MediaPlayDb/db.json` : null})
    const MediaPlayerContext = useMediaPlayerContext()
    const router = useRouter()
    const pathname = usePathname()
    const show = library.data?.podcasts[decodeURIComponent(encodedpodcasturl)]

    useEffect(() => {
        if (!musicPath || !window.fs) return
        const showName = safeFileName(show?.meta.title || "Podcast", "Podcast")
        const files: Record<string, string> = {}
        const showFolder = window.fs.readdirSync(musicPath, {withFileTypes: true})
            .find(entry => entry.isDirectory() && entry.name.toLowerCase() === showName.toLowerCase())?.name
        if (showFolder) {
            const folderPath = `${musicPath}/${showFolder}`
            const fileNames = window.fs.readdirSync(folderPath)
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
            const folder = `${musicPath}/${showName}`
            await window.app.downloadFile(item.enclosure.url, `${folder}/${title}${extension}`)
            setDownloaded(current => ({...current, [key]: `${showName}/${title}${extension}`}))
        } catch (error) {
            setDownloadErrors(current => ({...current, [key]: error instanceof Error ? error.message : "Download failed"}))
        } finally {
            setDownloading(current => ({...current, [key]: false}))
        }
    }
    return <div className="flex min-w-0 flex-col w-full h-full overflow-hidden">
        <div className="flex flex-col p-2 border-b-1">
            <Item>
                <ItemMedia variant={"image"}>
                    <img src={show?.meta.image.url} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                    <ItemTitle className="w-full min-w-0 truncate">
                        {show?.meta.title}
                    </ItemTitle>
                    <ItemDescription className="w-full min-w-0 truncate">
                        {show?.meta.owner.name}
                    </ItemDescription>
                </ItemContent>
            </Item>
        </div>
        <div className="min-w-0 h-full overflow-x-hidden overflow-y-scroll">
            <div className="flex flex-col p-6 pt-4 border-b-1">
                <h2 className="text-lg font-medium pb-2">Description</h2>
                <ExpandableText text={show?.meta.description} />
            </div>
            <div className="flex flex-col p-4 pt-4 ">
                <h2 className="text-lg font-medium pb-3 pl-2 pt-2">Episodes</h2>
                <ItemGroup className="min-w-0 gap-0 rounded-xl border-1">
                    {show?.episodes.map((item, index) => {
                        return <div key={index} className="min-w-0 max-w-full overflow-hidden">
                            {index !== 0 && <Separator />}
                            <Item className="min-w-0 max-w-full flex-nowrap overflow-hidden">
                                <ItemMedia variant={"image"}>
                                    <img src={item.image?.url || library.data?.podcasts[decodeURIComponent(encodedpodcasturl)].meta.image.url} />
                                </ItemMedia>
                                <ItemContent className="min-w-0 flex-1 relative">
                                    {downloaded[item.guid || item.enclosure.url] ? (
                                        <Button className="absolute right-2 top-1" onClick={() => playEpisode(item)}>
                                            <PlayIcon />Play
                                        </Button>
                                    ) : (
                                        <Button className="absolute right-2 top-1" disabled={!musicPath || downloading[item.guid || item.enclosure.url]} onClick={() => void downloadEpisode(item)}>
                                            <DownloadIcon />
                                            {downloading[item.guid || item.enclosure.url] ? "Downloading…" : "Download"}
                                        </Button>
                                    )}
                                    <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium leading-snug">
                                        {item.title}
                                    </div>
                                    <ItemDescription>
                                        {new Date(item.pubDate).toLocaleDateString()}
                                    </ItemDescription>
                                    {downloadErrors[item.guid || item.enclosure.url] && <ItemDescription className="text-destructive pr-24">{downloadErrors[item.guid || item.enclosure.url]}</ItemDescription>}
                                    <ItemFooter>
                                        <ExpandableText text={item.description} />
                                    </ItemFooter>
                                </ItemContent>
                            </Item>
                        </div>
                    })}
                </ItemGroup>
            </div>
            <div className="w-full h-[50px]" />
        </div>
    </div>
}
