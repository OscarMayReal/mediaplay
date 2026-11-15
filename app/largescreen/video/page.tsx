"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { MediaLibraryTags, regenerateLibraryDb } from "@/lib/libraryDb"
import { updateDeviceLastSync } from "@/lib/updateDeviceLastSync"
import { usePortableMediaDrive } from "@/lib/useDrives"
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile"
import { Button } from "@base-ui/react"
import { FocusNode } from "@/components/focus"
import { AlbumIcon, ArrowLeftCircleIcon, CableIcon, DiscAlbumIcon, ListIcon, MoreHorizontalIcon, MusicIcon, PodcastIcon, SettingsIcon, VideoIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

type MusicLibraryDb = {version: string; metadataStore: Record<string, MediaLibraryTags>};

const videoExtensions = [
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".webmv",
  ".mkv",
  ".3gp",
  ".3g2",
  ".f4v",
];

export default function LargeScreenHome() {
    const drive = usePortableMediaDrive({autoReload: true})
    const config = useReadConfigFile()
    const videoPath = config.data?.libraries.find(item => item.type === "videos")?.path
    const dbPath = videoPath ? videoPath + "/MediaPlayDb/db.json" : null
    const library = useReadFileJson<MusicLibraryDb>({path: dbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    useEffect(() => {
        if (!videoPath || !dbPath || !window.fs) return
        if (!window.fs.existsSync(dbPath)) {
            regenerateLibraryDb({path: videoPath, extensions: videoExtensions}).then(library.reload)
        }
    }, [videoPath, dbPath, library.reload])
    const router = useRouter()
    return <div className="w-full h-full flex flex-row">
        <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full w-full">
            <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pb-0">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                router.back()
            }}>
                <ArrowLeftCircleIcon size={30} />
                Video
            </FocusNode>
        </FocusNode>
            <FocusNode orientation="vertical" className="flex-1 min-h-0 w-full [&_[data-slot=table-container]]:max-h-full [&_[data-slot=table-container]]:overflow-y-auto">
                {library.data && <Table className="mb-18 w-full">
                    <TableHeader className="bg-background h-[41px] [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                        <TableRow className="hover:bg-background border-b-0 text-xl" style={{
                            borderBottomWidth: 0,
                            maxHeight: 40,
                            height: 40,
                        }}>
                            <TableHead className="w-12">

                            </TableHead>
                            <TableHead>
                                Title
                            </TableHead>
                            <TableHead>
                                Artist
                            </TableHead>
                            <TableHead>
                                Genre
                            </TableHead>
                            <TableHead className="w-12">

                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(library.data.metadataStore).map(([key, value]) => {
                            return <Fragment key={key}>
                            <FocusNode elementType="tr" orientation="horizontal" className={(MediaPlayerContext?.playerMetadata?.path == key ? "bg-foreground/5 hover:bg-foreground/5" : "even:bg-foreground/2") + " scroll-mt-[42px] border-transparent hover:bg-foreground/5 text-xl [&.isFocused]:bg-foreground/10"} onSelected={() => {
                                router.push(`/largescreen/video/player/${videoPath!.replaceAll("/", "::slash::")}/${key.replaceAll("/", "::slash::")}`)
                            }} onFocused={({currentNode}: any) => currentNode.elRef.current?.scrollIntoView({block: "nearest"})}>
                                <TableHead className="w-12">
                                </TableHead>
                                <TableCell className="truncate max-w-0">
                                    {value?.title || "-"}
                                </TableCell>
                                <TableCell className="truncate max-w-0">
                                    {value?.artist || "-"}
                                </TableCell>
                                <TableCell className="truncate max-w-0">
                                    {value?.genre || "-"}
                                </TableCell>
                                <TableHead className="w-12">
                                </TableHead>
                            </FocusNode>
                            </Fragment>
                        })}
                    </TableBody>
                </Table>}
            </FocusNode>
        </FocusNode>
    </div>
}
