"use client"
import { ButtonGroup } from "./ui/button-group";
import { Button } from "./ui/button";
import { CableIcon, FastForwardIcon, FolderCogIcon, LibraryBigIcon, ListIcon, MusicIcon, PauseIcon, PlayIcon, RewindIcon, SettingsIcon, SquareArrowOutUpRightIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDrives } from "@/lib/useDrives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "./ui/item";
import { useMediaPlayerContext } from "./mediaPlayerContext";
import { Slider } from "./ui/slider";
import { Progress } from "./ui/progress";
import { ManageLibrariesDialog } from "./manageLibrariesDialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function formatTime(seconds: number) {
    const totalSeconds = Math.floor(seconds)
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}

export default function AppHeader() {
    const mediaPlayerContext = useMediaPlayerContext()
    const router = useRouter()
    const drives = useDrives({autoReload: true})
    const pathName = usePathname()
    const [manageLibrariesOpen, setManageLibrariesOpen] = useState(false)
    if (pathName.startsWith("/videoPlayer")) return null
    return (
        <header className="h-[50px] bg-muted border-b-1 w-full flex flex-row items-center titlebar shrink-0 relative">
            <ButtonGroup className="ml-22 nodrag">
                <Button variant="outline" size="icon" aria-label="Rewind 10 seconds" onClick={() => {
                    if (!mediaPlayerContext) return
                    mediaPlayerContext.seek(mediaPlayerContext.playerState.time - 10)
                }}><RewindIcon /></Button>
                <Button variant="outline" size="icon" onClick={() => {
                    if (!mediaPlayerContext) return
                    if (mediaPlayerContext.playerState.paused) {
                        mediaPlayerContext.audioPlayerRef.current?.play()
                    } else {
                        mediaPlayerContext.audioPlayerRef.current?.pause()
                    }
                }}>{mediaPlayerContext?.playerState.paused ? <PlayIcon /> : <PauseIcon />}</Button>
                <Button variant="outline" size="icon" aria-label="Forward 10 seconds" onClick={() => {
                    if (!mediaPlayerContext) return
                    mediaPlayerContext.seek(mediaPlayerContext.playerState.time + 10)
                }}><FastForwardIcon /></Button>
            </ButtonGroup>
            {drives.drives.find(drive => drive.name?.endsWith("_MP")) && <Button variant="outline" size="icon" className="ml-2 nodrag" onClick={() => router.push(pathName !== "/device" ? "/device" : "/library")}>{pathName !== "/device" ? <CableIcon /> : <LibraryBigIcon />}</Button>}
            <HeaderMediaArea />
            <div className="flex-1" />
            {/* <Button variant="outline" size="icon" className="mr-2 nodrag" aria-label="Open this page in a new window" title="Open this page in a new window" onClick={() => void window.app.openWindow(pathName)}><SquareArrowOutUpRightIcon /></Button> */}
            {/* <InputGroup className="w-[250px] mr-2 bg-white nodrag">
                <InputGroupAddon>
                    <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search" />
            </InputGroup> */}
            <ButtonGroup>
                <Popover>
                    <PopoverTrigger render={<Button variant="outline" size="icon" className="nodrag" aria-label="Playlist"><ListIcon /></Button>} />
                    <PopoverContent className="max-h-100 p-0 gap-0">
                        <div className="flex flex-row items-center h-[45px] min-h-[45px] border-b-1">
                            <div className="ml-3.5 text-[16px] font-medium">Queue</div>
                            <div className="flex flex-1" />
                            <Button className="mr-2" size={"sm"} variant={"ghost"} onClick={() => {
                                if (!mediaPlayerContext?.audioPlayerRef.current) return
                                mediaPlayerContext?.setPlaylistPos(0)
                                mediaPlayerContext?.setPlaylist([])
                                mediaPlayerContext?.setPlayerMetadata(null)
                                mediaPlayerContext.audioPlayerRef.current.src = ""
                                mediaPlayerContext.audioPlayerRef.current.currentTime = 0
                                mediaPlayerContext?.audioPlayerRef.current?.pause()
                            }}>
                                <XIcon />Clear
                            </Button>
                        </div>
                        <div className={"flex flex-col flex-1 overflow-y-scroll p-2"}>
                            {mediaPlayerContext?.playlist.length > 0 ? <ItemGroup className="gap-0">
                                {mediaPlayerContext?.playlist.map((item, index) => <Item className={`p-2 ${index == mediaPlayerContext.playlistPos ? "bg-foreground/10" : ""}`} onClick={() => {
                                    if (!mediaPlayerContext.audioPlayerRef.current) return
                                    mediaPlayerContext.audioPlayerRef.current.currentTime = 0
                                    mediaPlayerContext.audioPlayerRef.current.src = mediaPlayerContext.playlist[index].src
                                    mediaPlayerContext.audioPlayerRef.current.play()
                                    mediaPlayerContext.setPlayerMetadata(mediaPlayerContext.playlist[index])
                                    mediaPlayerContext.setPlaylistPos(index)
                                }}>
                                    <ItemMedia variant={"image"}>
                                        <img src={window.app.getLocalFileUrl(item.pictureLoc, "")} />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>{item.title}</ItemTitle>
                                        <ItemDescription>{item.artist}</ItemDescription>
                                    </ItemContent>
                                </Item>)}
                            </ItemGroup> : <div className="text-center p-4 text-muted-foreground">No Media in the Queue</div>}
                        </div>
                    </PopoverContent>
                </Popover>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="mr-2 nodrag" aria-label="Manage libraries"><SettingsIcon /></Button>} />
                    <DropdownMenuContent align="end" className="w-auto">
                        <DropdownMenuItem onClick={() => setManageLibrariesOpen(true)}><FolderCogIcon />Manage libraries</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </ButtonGroup>
            <ManageLibrariesDialog open={manageLibrariesOpen} onOpenChange={setManageLibrariesOpen} />
        </header>
    )
}

function HeaderMediaArea() {
    const mediaPlayerContext = useMediaPlayerContext()
    const [seekingTime, setSeekingTime] = useState<number | null>(null)
    const time = seekingTime ?? mediaPlayerContext?.playerState.time ?? 0
    const duration = mediaPlayerContext?.playerState.duration ?? 0
    return <div className="w-[450px] h-full border-x-1 bg-background/50 absolute left-1/2 -translate-x-[50%] flex flex-row items-center">
        {mediaPlayerContext?.playerMetadata !== null && <Item className="flex flex-row w-fit flex-nowrap p-0">
            <ItemMedia className="rounded-md border-1 bg-muted h-[35px] w-[35px] mr-0 ml-2 mt-0 overflow-hidden">
                {!mediaPlayerContext?.playerMetadata.pictureLoc ? <MusicIcon size={20} /> :
                <img src={window.app.getLocalFileUrl(mediaPlayerContext.playerMetadata.pictureLoc, "")} alt="" />}
            </ItemMedia>
            <ItemContent className="gap-0">
                <ItemTitle className="text-nowrap">{mediaPlayerContext?.playerMetadata.title}</ItemTitle>
                <ItemDescription className="text-nowrap">{mediaPlayerContext?.playerMetadata.artist}</ItemDescription>
            </ItemContent>
        </Item>}
        {mediaPlayerContext?.playerMetadata && <span className="ml-auto mr-2 shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatTime(time)} / {formatTime(duration)}
        </span>}
        <Progress
            min={0}
            max={Math.max(duration, 1)}
            // step={1}
            // disabled={duration <= 0}
            value={Math.min(time, Math.max(duration, 1))}
            // onValueChange={(value) => {
            //     if (typeof value === "number") setSeekingTime(value)
            // }}
            // onValueCommitted={(value) => {
            //     if (typeof value === "number") mediaPlayerContext?.seek(value)
            //     setSeekingTime(null)
            // }}
            aria-label="Playback position"
            className="w-full absolute bottom-0 rounded-none nodrag"
        />
    </div>
}
