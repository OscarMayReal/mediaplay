"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { regenerateLibraryDb, type MediaLibraryTags } from "@/lib/libraryDb";
import { usePortableMediaDrive } from "@/lib/useDrives";
import { updateDeviceLastSync } from "@/lib/updateDeviceLastSync";
import { useReadConfigFile, useReadFileJson } from "@/lib/useReadFile";
import { CableIcon, MoreHorizontalIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect } from "react";

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

export default function LibraryPage() {
    const drive = usePortableMediaDrive({autoReload: true})
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
    return <div className="w-full h-full flex flex-col max-h-full">
        <div className="w-full p-6 pb-2 flex flex-row items-center">
            <h1 className="text-2xl font-bold">All Music</h1>
            <div className="flex-1" />
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant={"ghost"} size="icon" className="mr-2"><MoreHorizontalIcon /></Button>} />
                <DropdownMenuContent className="w-auto">
                    <DropdownMenuItem onClick={() => {
                        if (musicPath) regenerateLibraryDb({path: musicPath, extensions: audioExtensions}).then(library.reload)
                    }}><RotateCcwIcon />Rescan Library</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button><PlayIcon />Play All</Button>
        </div>
        <div className="flex flex-col p-0 pt-0 overflow-scroll max-h-full relative">
            {library.data && <Table className="mb-18">
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
                        return <TableRow className={(MediaPlayerContext?.playerMetadata?.path == key ? "bg-foreground/5 hover:bg-foreground/5" : "even:bg-foreground/2") + " border-transparent hover:bg-foreground/5"} key={key} onClick={() => {
                            console.log(value)
                            const player = MediaPlayerContext?.audioPlayerRef.current
                            if (!player || !musicPath) return
                            MediaPlayerContext.setPlayerMetadata({...value, path: key, image: musicPath + "/MediaPlayDb/pictures/" + key.replaceAll("/", "_"), type: "music"})
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
                            <TableCell className="w-5 p-0" onClick={(ev) => {
                                ev.stopPropagation()
                            }}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger render={<Button variant={"ghost"} size={"icon-sm"}><MoreHorizontalIcon /></Button>} />
                                    <DropdownMenuContent className="w-auto">
                                        <DropdownMenuItem disabled={!drive.drive?.mountpoint} onClick={async() => {
                                            const mountpoint = drive.drive?.mountpoint
                                            if (!mountpoint || !musicPath) return
                                            const target = `${mountpoint}/Music/${value.albumartist}/${value.album}/${key.split("/").pop()}`
                                            if (!window.fs.existsSync(target)) {
                                                await window.fsPromises.mkdir(target.slice(0, target.lastIndexOf("/")), {recursive: true})
                                                await window.fsPromises.cp(musicPath + "/" + key, target)
                                                await updateDeviceLastSync(mountpoint)
                                            }
                                        }}>
                                            <CableIcon />Sync to player
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            <TableCell className="w-5">

                            </TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>}
        </div>
    </div>
}
