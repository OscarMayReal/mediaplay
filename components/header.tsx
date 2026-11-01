"use client"
import { ButtonGroup } from "./ui/button-group";
import { Button } from "./ui/button";
import { CableIcon, FastForwardIcon, FolderCogIcon, LibraryBigIcon, MusicIcon, PauseIcon, PlayIcon, RewindIcon, SettingsIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDrives } from "@/lib/useDrives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "./ui/item";
import { useMediaPlayerContext } from "./mediaPlayerContext";
import { Slider } from "./ui/slider";
import { Progress } from "./ui/progress";
import { ManageLibrariesDialog } from "./manageLibrariesDialog";

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
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="mr-2 nodrag" aria-label="Manage libraries"><SettingsIcon /></Button>} />
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setManageLibrariesOpen(true)}><FolderCogIcon />Manage libraries</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
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
