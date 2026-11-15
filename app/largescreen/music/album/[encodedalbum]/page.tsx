"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { MediaLibraryTags, regenerateLibraryDb } from "@/lib/libraryDb"
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile"
import { FocusNode } from "@/components/focus"
import { ArrowLeftCircleIcon, ListIcon, PlayIcon } from "lucide-react"
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

export default function AlbumPage({params}: {params: Promise<{encodedalbum: string}>}) {
    const {encodedalbum} = use(params)
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
                {decodeURIComponent(encodedalbum)}
            </FocusNode>
        </FocusNode>
        <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pt-3 pb-1">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                if (!musicPath || !MediaPlayerContext || !MediaPlayerContext.audioPlayerRef.current) return
                const newplaylist = []
                for (const [itemkey, itemvalue] of Object.entries(library.data!.metadataStore).filter(item => item[1].album == decodeURIComponent(encodedalbum))) {
                    newplaylist.push({...itemvalue, path: itemkey, image: musicPath + "/MediaPlayDb/pictures/" + itemkey.replaceAll("/", "_"), type: "music" as const, src: window.app.getLocalFileUrl(musicPath, itemkey)})
                }
                MediaPlayerContext?.setPlaylist(newplaylist)
                MediaPlayerContext?.setPlayerMetadata(newplaylist[0])
                MediaPlayerContext?.setPlaylistPos(0)
                MediaPlayerContext.audioPlayerRef.current.src = newplaylist[0].src
                void MediaPlayerContext.audioPlayerRef.current.play()
            }}>
                <PlayIcon size={30} />
                Play All
            </FocusNode>
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                if (!musicPath || !MediaPlayerContext || !MediaPlayerContext.audioPlayerRef.current) return
                const newplaylist = MediaPlayerContext.playlist
                for (const [itemkey, itemvalue] of Object.entries(library.data!.metadataStore).filter(item => item[1].album == decodeURIComponent(encodedalbum))) {
                    newplaylist.push({...itemvalue, path: itemkey, image: musicPath + "/MediaPlayDb/pictures/" + itemkey.replaceAll("/", "_"), type: "music" as const, src: window.app.getLocalFileUrl(musicPath, itemkey)})
                }
                MediaPlayerContext?.setPlaylist(newplaylist)
                toast.add({
                    title: "Added to Queue"
                })
            }}>
                <ListIcon size={30} />
                Queue All
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
                        <TableHead>
                            Genre
                        </TableHead>
                        <TableHead className="w-12">

                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(library.data!.metadataStore).filter(item => item[1].album == decodeURIComponent(encodedalbum)).map(([key, value]) => {
                        const playTrack = () => {
                            console.log(value)
                            const player = MediaPlayerContext?.audioPlayerRef.current
                            if (!player || !musicPath) return
                            MediaPlayerContext.setPlayerMetadata({...value, path: key, image: musicPath + "/MediaPlayDb/pictures/" + key.replaceAll("/", "_"), type: "music" as const, src: window.app.getLocalFileUrl(musicPath, key)})
                            MediaPlayerContext.setPlaylist([{...value, path: key, image: musicPath + "/MediaPlayDb/pictures/" + key.replaceAll("/", "_"), type: "music" as const, src: window.app.getLocalFileUrl(musicPath, key)}])
                            MediaPlayerContext.setPlaylistPos(0)
                            player.src = window.app.getLocalFileUrl(musicPath, key)
                            void player.play()
                        }
                        const track = {...value, path: key, image: musicPath + "/MediaPlayDb/pictures/" + key.replaceAll("/", "_"), type: "music" as const, src: window.app.getLocalFileUrl(musicPath!, key)}
                        const addToQueue = () => MediaPlayerContext?.setPlaylist([...MediaPlayerContext.playlist, track])
                        const startHold = () => {
                            didLongPress.current = false
                            holdTimer.current = setTimeout(() => {
                                didLongPress.current = true
                                setMenuTrack(key)
                                holdTimer.current = null
                            }, 550)
                        }
                        const cancelHold = () => {
                            if (holdTimer.current) clearTimeout(holdTimer.current)
                            holdTimer.current = null
                        }
                        return <Fragment key={key}>
                        <FocusNode elementType="tr" orientation="horizontal" className={(MediaPlayerContext?.playerMetadata?.path == key ? "bg-foreground/5 hover:bg-foreground/5" : "even:bg-foreground/2") + " scroll-mt-[42px] border-transparent hover:bg-foreground/5 text-xl [&.isFocused]:bg-foreground/10"} onSelected={() => {
                            // LRUD emits select again for repeated Enter keydowns. Ignore those
                            // while the original hold is still down, or they would dismiss the menu.
                            if (menuTrack === key && !heldTrack.current) {
                                addToQueue()
                                setMenuTrack(null)
                            } else if (!heldTrack.current) playTrack()
                        }} onClick={() => { if (!didLongPress.current) playTrack(); didLongPress.current = false }} onPointerDown={startHold} onPointerUp={cancelHold} onPointerLeave={cancelHold} onContextMenu={(event: React.MouseEvent) => { event.preventDefault(); setMenuTrack(key) }} onKey={(event: any) => {
                            if (menuTrack === key) {
                                event.preventDefault()
                                event.stopPropagation()
                                if (event.key === "back") setMenuTrack(null)
                                return
                            }
                            if (event.key !== "select") return
                            event.preventDefault()
                            if (heldTrack.current) return
                            heldTrack.current = {key, play: playTrack}
                            startHold()
                        }} onFocused={({currentNode}: any) => currentNode.elRef.current?.scrollIntoView({block: "nearest"})}>
                            <TableHead className="w-12">
                            </TableHead>
                            <TableCell>
                                {value?.track?.no || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {value?.title || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {value?.artist || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {value?.album || "-"}
                            </TableCell>
                            <TableCell className="truncate max-w-0">
                                {value?.genre || "-"}
                            </TableCell>
                            <TableHead className="w-12">
                            </TableHead>
                        </FocusNode>
                        {menuTrack === key && typeof document !== "undefined" && createPortal(
                            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
                                <div role="menu" className="min-w-80 rounded-lg bg-popover p-2 text-popover-foreground shadow-xl">
                                    <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-md px-5 py-4 text-3xl hover:bg-accent focus:bg-accent" onClick={() => { addToQueue(); setMenuTrack(null) }}><ListIcon className="size-7" />Add to queue</button>
                                </div>
                            </div>, document.body
                        )}
                        </Fragment>
                    })}
                </TableBody>
            </Table>}
        </FocusNode>
    </FocusNode>
}
