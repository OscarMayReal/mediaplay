"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { MediaLibraryTags, regenerateLibraryDb } from "@/lib/libraryDb"
import { updateDeviceLastSync } from "@/lib/updateDeviceLastSync"
import { usePortableMediaDrive } from "@/lib/useDrives"
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile"
import { Button } from "@base-ui/react"
import { FocusNode } from "@please/lrud"
import { AlbumIcon, ArrowLeftCircleIcon, CableIcon, DiscAlbumIcon, ListIcon, MoreHorizontalIcon, MusicIcon, PodcastIcon, SettingsIcon, VideoIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Podcast } from "podparse"
import { Fragment, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

type PodcastDb = {version: string; podcasts: Record<string, Podcast>};

export default function LargeScreenHome() {
    const drive = usePortableMediaDrive({autoReload: true})
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const podcastdbPath = musicPath ? musicPath + "/MediaPlayDb/podcastdb.json" : null
    const library = useReadFileJson<PodcastDb>({path: podcastdbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    const router = useRouter()
    return <div className="w-full h-full flex flex-row">
        <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full w-full">
            <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pb-0">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                router.back()
            }}>
                <ArrowLeftCircleIcon size={30} />
                Podcasts
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
                                Description
                            </TableHead>
                            <TableHead>
                                Owner
                            </TableHead>
                            <TableHead className="w-12">

                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(library.data.podcasts).map(([key, value]) => {
                            return <Fragment key={key}>
                            <FocusNode elementType="tr" orientation="horizontal" className={(MediaPlayerContext?.playerMetadata?.path == key ? "bg-foreground/5 hover:bg-foreground/5" : "even:bg-foreground/2") + " scroll-mt-[42px] border-transparent hover:bg-foreground/5 text-xl [&.isFocused]:bg-foreground/10"} onSelected={() => {
                                router.push(`/largescreen/podcasts/${encodeURIComponent(key)}`)
                            }} onFocused={({currentNode}) => currentNode.elRef.current?.scrollIntoView({block: "nearest"})}>
                                <TableHead className="w-12">
                                </TableHead>
                                <TableCell className="truncate max-w-0">
                                    {value?.meta.title || "-"}
                                </TableCell>
                                <TableCell className="truncate max-w-0">
                                    {value?.meta.description || "-"}
                                </TableCell>
                                <TableCell className="truncate max-w-0">
                                    {value?.meta.owner.name || "-"}
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
