"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { regenerateLibraryDb } from "@/lib/libraryDb";
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile";
import { FastAverageColor } from "fast-average-color";
import { MoreHorizontalIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import type { ICommonTagsResult } from "music-metadata";
import { useEffect, useRef, useState } from "react";

type MusicLibraryDb = {version: string; metadataStore: Record<string, ICommonTagsResult>};

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

export default function LibraryPage() {
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const dbPath = musicPath ? musicPath + "/MediaPlayDb/db.json" : null
    const library = useReadFileJson<MusicLibraryDb>({path: dbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    const [activeAlbum, setActiveAlbum] = useState(null)
    useEffect(() => {
        if (!musicPath || !dbPath || !window.fs) return
        if (!window.fs.existsSync(dbPath)) {
            regenerateLibraryDb({path: musicPath, extensions: audioExtensions}).then(library.reload)
        }
    }, [musicPath, dbPath, library.reload])
    return <div className="w-full h-full flex flex-col max-h-full">
        <div className="w-full p-6 flex flex-row items-center">
            <h1 className="text-2xl font-bold">Albums</h1>
            <div className="flex-1" />
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant={"ghost"} size="icon" className="mr-2"><MoreHorizontalIcon /></Button>} />
                <DropdownMenuContent className="w-auto">
                    <DropdownMenuItem onClick={() => {
                        regenerateLibraryDb({path: musicPath, extensions: audioExtensions}).then(library.reload)
                    }}><RotateCcwIcon />Rescan Library</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button><PlayIcon />Play All</Button>
        </div>
        <div className="flex flex-col p-0 pt-0 overflow-scroll max-h-full relative flex-wrap max-w-full">
            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] justify-start px-6 items-start content-start h-auto relative">
                {new Map(Object.entries(library.data?.metadataStore || {}).map(([key, value]) => {return [value.album, value]})).entries().map(([key, value]) => <AlbumItem key={key} value={value} activeAlbum={activeAlbum} setActiveAlbum={setActiveAlbum} /> )}
            </div>
            {/* {library.data && <Table className="mb-18">
                <TableHeader className="sticky top-0 z-10 bg-background overflow-visible h-[41px] [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                    <TableRow className="hover:bg-background border-b-0" style={{
                        borderBottomWidth: 0,
                        maxHeight: 40,
                        height: 40,
                    }}>
                        <TableHead className="w-5">

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
                        <TableHead className="w-5">

                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(library.data.metadataStore).map(([key, value]) => {
                        return <TableRow className={MediaPlayerContext?.playerMetadata?.path == key ? "bg-foreground/5 hover:bg-foreground/5" : ""} key={key} onClick={() => {
                            console.log(value)
                            const player = MediaPlayerContext?.audioPlayerRef.current
                            if (!player || !musicPath) return
                            MediaPlayerContext.setPlayerMetadata({...value, path: key, image: musicPath + "/MediaPlayDb/pictures/" + key.replaceAll("/", "_")})
                            player.src = window.app.getLocalFileUrl(musicPath, key)
                            void player.play()
                        }}>
                            <TableCell className="w-5">

                            </TableCell>
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
                            <TableCell className="w-5">

                            </TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>} */}
        </div>
    </div>
}

function AlbumItem({value, setActiveAlbum, activeAlbum}: {value: ICommonTagsResult, setActiveAlbum: (data: string) => void, activeAlbum: string}) {
    const albumImageElement = useRef<HTMLImageElement>(null)
    const [averageColor, setAverageColor] = useState("")
    useEffect(() => {
        const fac = new FastAverageColor();
        fac.getColorAsync(window.app.getLocalFileUrl(value.pictureLoc, ""))
            .then(color => {
                setAverageColor(color.hex)
            })
    }, [])
    return <div className="flex flex-col h-fit" onClick={() => {
        setActiveAlbum(value.album)
    }}>
        <div className="flex flex-col relative">
            <img className="min-w-[200px] max-w-[300px] shrink block rounded-md" src={window.app.getLocalFileUrl(value.pictureLoc, "")} ref={albumImageElement} />
            <div className="w-full truncate mt-2">{value.album}</div>
            <div className="w-full truncate mt-0 text-sm text-muted-foreground">{value.albumartist}</div>
            {activeAlbum == value.album && <svg xmlns="http://w3.org" viewBox="0 0 100 100" width="30" height="30" className="absolute -bottom-8 left-[50%] -translate-x-1/2">
                <polygon points="50,15 90,85 10,85" fill={`color-mix(${averageColor} 75%, black 25%`}/>
            </svg>}
        </div>
        {activeAlbum == value.album && <div className="h-[400px] mt-6 col-span-full right-0 left-0">
            <div className="h-[400px] flex flex-row right-0 left-0 absolute p-6 gap-6" style={{width: "calc(100vw - 256px)", backgroundColor: `color-mix(${averageColor} 75%, black 25%`}}>
                <div className="flex flex-col gap-3">
                    <img className="max-w-[200px] max-h-[200px] w-[200px] h-[200px] shrink block rounded-md" src={window.app.getLocalFileUrl(value.pictureLoc, "")}/>
                    <Button variant={"ghost"} className="text-white justify-start hover:bg-black/20 hover:text-white"><PlayIcon />Play Album</Button>
                </div>
                <div className="flex flex-col gap-1 max-w-full min-w-0 w-full">
                    <h1 className="text-3xl text-white font-medium truncate max-w-full shrink-0">{value.album}</h1>
                    <h2 className="text-md text-white truncate max-w-full shrink-0">{value.albumartist}</h2>
                    <AlbumTrackTable albumTitle={value.album} />
                </div>
            </div>
        </div>}
    </div>
}

function AlbumTrackTable({albumTitle}: {albumTitle: string}) {
    const config = useReadConfigFile()
    const musicPath = config.data?.libraries.find(item => item.type === "music")?.path
    const dbPath = musicPath ? musicPath + "/MediaPlayDb/db.json" : null
    const library = useReadFileJson<MusicLibraryDb>({path: dbPath})
    const MediaPlayerContext = useMediaPlayerContext()
    useEffect(() => {
        if (!musicPath || !dbPath || !window.fs) return
        if (!window.fs.existsSync(dbPath)) {
            regenerateLibraryDb({path: musicPath, extensions: audioExtensions}).then(library.reload)
        }
    }, [musicPath, dbPath, library.reload])
    return <>{library.data && <Table className="mb-18 text-white">
        {/* <TableHeader className="sticky top-0 z-10 bg-background overflow-visible h-[41px] [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
            <TableRow className="hover:bg-background border-b-0" style={{
                borderBottomWidth: 0,
                maxHeight: 40,
                height: 40,
            }}>
                <TableHead className="w-5">

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
                <TableHead className="w-5">

                </TableHead>
            </TableRow>
        </TableHeader> */}
        <TableBody>
            {Object.entries(library.data.metadataStore).filter(item => item[1].album == albumTitle).map(([key, value]) => {
                return <TableRow className={(MediaPlayerContext?.playerMetadata?.path == key ? "bg-white/5 hover:bg-white/5" : "even:bg-white/2") + " border-transparent hover:bg-white/5"} key={key} onClick={() => {
                    console.log(value)
                    const player = MediaPlayerContext?.audioPlayerRef.current
                    if (!player || !musicPath) return
                    MediaPlayerContext.setPlayerMetadata({...value, path: key, image: musicPath + "/MediaPlayDb/pictures/" + key.replaceAll("/", "_"), type: "music"})
                    player.src = window.app.getLocalFileUrl(musicPath, key)
                    void player.play()
                }}>
                    {/* <TableCell className="w-5">

                    </TableCell> */}
                    <TableCell className="w-[10px]">
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
                    {/* <TableCell className="w-5">

                    </TableCell> */}
                </TableRow>
            })}
        </TableBody>
    </Table>}</>
}