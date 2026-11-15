"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { MediaLibraryTags, regenerateLibraryDb } from "@/lib/libraryDb"
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile"
import { FocusNode } from "@please/lrud"
import { ArrowLeftCircleIcon, ListIcon, PlayIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Fragment, Usable, use, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

type MusicLibraryDb = {version: string; metadataStore: Record<string, MediaLibraryTags>};

const audioExtensions = [
  ".mp3",
  ".m4a",
  ".mp4",
  ".wav",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
  ".webm",
  ".aiff",
  ".aif",
  ".wma",
  ".ape",
];

export default function AlbumPage() {
    const router = useRouter()
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const dbPath = musicPath ? musicPath + "/MediaPlayDb/db.json" : null
    const library = useReadFileJson<MusicLibraryDb>({path: dbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const heldTrack = useRef<{key: string; play: () => void} | null>(null)
    const didLongPress = useRef(false)
    const [menuTrack, setMenuTrack] = useState<string | null>(null)
    useEffect(() => {
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key !== "Enter" || !heldTrack.current) return
            event.preventDefault()
            const track = heldTrack.current
            heldTrack.current = null
            if (holdTimer.current) {
                clearTimeout(holdTimer.current)
                holdTimer.current = null
                track.play()
            }
            didLongPress.current = false
        }
        window.addEventListener("keyup", onKeyUp, true)
        return () => {
            window.removeEventListener("keyup", onKeyUp, true)
            if (holdTimer.current) clearTimeout(holdTimer.current)
        }
    }, [])
    useEffect(() => {
        if (!musicPath || !dbPath || !window.fs) return
        if (!window.fs.existsSync(dbPath)) {
            regenerateLibraryDb({path: musicPath, extensions: audioExtensions}).then(library.reload)
        }
        }, [musicPath, dbPath, library.reload])
    return <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full w-full">
        <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pb-0">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                router.back()
            }}>
                <ArrowLeftCircleIcon size={30} />
                Queue
            </FocusNode>
        </FocusNode>
        <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pt-3 pb-1">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                if (!MediaPlayerContext?.audioPlayerRef.current) return
                MediaPlayerContext?.setPlaylistPos(0)
                MediaPlayerContext?.setPlaylist([])
                MediaPlayerContext?.setPlayerMetadata(null)
                MediaPlayerContext.audioPlayerRef.current.src = ""
                MediaPlayerContext.audioPlayerRef.current.currentTime = 0
                MediaPlayerContext?.audioPlayerRef.current?.pause()
            }}>
                <XIcon size={30} />
                Clear Queue
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
                        <TableHead className="w-[10px]">
                            #
                        </TableHead>
                        <TableHead>
                            Title
                        </TableHead>
                        <TableHead>
                            Artist
                        </TableHead>
                        <TableHead>
                            Album
                        </TableHead>
                        <TableHead className="w-12">

                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {MediaPlayerContext?.playlist.map((item, index) => {
                        const playTrack = () => {
                            if (!MediaPlayerContext.audioPlayerRef.current) return
                            MediaPlayerContext.audioPlayerRef.current.currentTime = 0
                            MediaPlayerContext.audioPlayerRef.current.src = MediaPlayerContext.playlist[index].src
                            MediaPlayerContext.audioPlayerRef.current.play()
                            MediaPlayerContext.setPlayerMetadata(MediaPlayerContext.playlist[index])
                            MediaPlayerContext.setPlaylistPos(index)
                        }
                        const track = {...item, path: item.path, image: musicPath + "/MediaPlayDb/pictures/" + item.path.replaceAll("/", "_"), type: "music" as const, src: window.app.getLocalFileUrl(musicPath!, item.path)}
                        const addToQueue = () => MediaPlayerContext?.setPlaylist([...MediaPlayerContext.playlist, track])
                        const startHold = () => {
                            didLongPress.current = false
                            holdTimer.current = setTimeout(() => {
                                didLongPress.current = true
                                setMenuTrack(item.path)
                                holdTimer.current = null
                            }, 550)
                        }
                        const cancelHold = () => {
                            if (holdTimer.current) clearTimeout(holdTimer.current)
                            holdTimer.current = null
                        }
                        return <Fragment key={item.path}>
                        <FocusNode elementType="tr" orientation="horizontal" className={(MediaPlayerContext?.playerMetadata?.path == item.path ? "bg-foreground/5 hover:bg-foreground/5" : "even:bg-foreground/2") + " scroll-mt-[42px] border-transparent hover:bg-foreground/5 text-xl [&.isFocused]:bg-foreground/10"} onSelected={() => {
                            // LRUD emits select again for repeated Enter keydowns. Ignore those
                            // while the original hold is still down, or they would dismiss the menu.
                            if (menuTrack === item.path && !heldTrack.current) {
                                addToQueue()
                                setMenuTrack(null)
                            } else if (!heldTrack.current) playTrack()
                        }} onClick={() => { if (!didLongPress.current) playTrack(); didLongPress.current = false }} onPointerDown={startHold} onPointerUp={cancelHold} onPointerLeave={cancelHold} onContextMenu={(event) => { event.preventDefault(); setMenuTrack(key) }} onKey={event => {
                            if (menuTrack === item.path) {
                                event.preventDefault()
                                event.stopPropagation()
                                if (event.key === "back") setMenuTrack(null)
                                return
                            }
                            if (event.key !== "select") return
                            event.preventDefault()
                            if (heldTrack.current) return
                            heldTrack.current = {key: item.path, play: playTrack}
                            startHold()
                        }} onFocused={({currentNode}) => currentNode.elRef.current?.scrollIntoView({block: "nearest"})}>
                            <TableHead className="w-12">
                            </TableHead>
                            <TableCell>
                                {index + 1 || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {item?.title || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {item.artist || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {item.album || "-"}
                            </TableCell>
                            <TableHead className="w-12">
                            </TableHead>
                        </FocusNode>
                        {/* {menuTrack === item.path && typeof document !== "undefined" && createPortal(
                            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
                                <div role="menu" className="min-w-80 rounded-lg bg-popover p-2 text-popover-foreground shadow-xl">
                                    <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-md px-5 py-4 text-3xl hover:bg-accent focus:bg-accent" onClick={() => { addToQueue(); setMenuTrack(null) }}><XIcon className="size-7" />Remove from queue</button>
                                </div>
                            </div>, document.body
                        )} */}
                        </Fragment>
                    })}
                </TableBody>
            </Table>}
        </FocusNode>
    </FocusNode>
}
