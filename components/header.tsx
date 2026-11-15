"use client"
import { ButtonGroup } from "./ui/button-group";
import { Button } from "./ui/button";
import { CableIcon, FastForwardIcon, FolderCogIcon, FullscreenIcon, LibraryBigIcon, ListIcon, MonitorIcon, MoonIcon, MoreHorizontalIcon, MusicIcon, PauseIcon, PlayCircleIcon, PlayIcon, RewindIcon, SettingsIcon, SquareArrowOutUpRightIcon, SunIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDrives } from "@/lib/useDrives";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "./ui/item";
import { useMediaPlayerContext } from "./mediaPlayerContext";
import { Slider } from "./ui/slider";
import { Progress } from "./ui/progress";
import { ManageLibrariesDialog } from "./manageLibrariesDialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useTheme } from "next-themes";
import { getLibraries } from "@/lib/getLibraries";
import { useReadConfigFile } from "@/lib/useReadFile";

function formatTime(seconds: number) {
    const totalSeconds = Math.floor(seconds)
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}

export default function AppHeader() {
    const theme = useTheme()
    const mediaPlayerContext = useMediaPlayerContext()
    const router = useRouter()
    const drives = useDrives({autoReload: true})
    const libraryConfig = useReadConfigFile()
    const mediaServerEnabled = libraryConfig.data?.mediaServerEnabled ?? true
    const pathName = usePathname()
    const [manageLibrariesOpen, setManageLibrariesOpen] = useState(false)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isMacOS, setIsMacOS] = useState(false)
    const [isWindows, setIsWindows] = useState(false)
    const toggleMediaServer = async () => {
        const libraries = getLibraries()
        if (!libraries || !window.fsPromises) return
        const configPath = libraries.documents + "/MediaPlay/library.json"
        let config: Record<string, any> = {}
        try {
            config = JSON.parse(await window.fsPromises.readFile(configPath, "utf8"))
        } catch {}
        config.mediaServerEnabled = !mediaServerEnabled
        await window.fsPromises.writeFile(configPath, JSON.stringify(config, null, 2))
        window.electronAPI?.setMediaServerEnabled(!mediaServerEnabled)
        libraryConfig.reload()
    }
    useEffect(() => {
        setIsMacOS(window.electronAPI?.platform === "darwin")
        setIsWindows(window.electronAPI?.platform === "win32")
        if (!window.electronAPI) return
        return window.electronAPI.onWindowStateChange((state) => {
            if (state === "enter-full-screen") setIsFullScreen(true)
            if (state === "leave-full-screen") setIsFullScreen(false)
        })
    }, [])
    if (pathName.startsWith("/videoPlayer") || pathName.startsWith("/largescreen")) return null
    return (
        <header className={`h-[50px] bg-muted border-b-1 w-full flex flex-row items-center titlebar shrink-0 relative ${!isMacOS ? "pr-12" : ""}`}>
            <ButtonGroup className={`${isFullScreen || !isMacOS ? "ml-2" : "ml-22"} nodrag`}>
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
                            {(mediaPlayerContext?.playlist?.length ?? 0) > 0 ? <ItemGroup className="gap-0">
                                {mediaPlayerContext?.playlist.map((item, index) => <Item className={`p-2 ${index == mediaPlayerContext.playlistPos ? "bg-foreground/10" : ""}`} onClick={() => {
                                    if (!mediaPlayerContext.audioPlayerRef.current) return
                                    mediaPlayerContext.audioPlayerRef.current.currentTime = 0
                                    mediaPlayerContext.audioPlayerRef.current.src = mediaPlayerContext.playlist[index].src
                                    mediaPlayerContext.audioPlayerRef.current.play()
                                    mediaPlayerContext.setPlayerMetadata(mediaPlayerContext.playlist[index])
                                    mediaPlayerContext.setPlaylistPos(index)
                                }}>
                                    <ItemMedia variant={"image"}>
                                        {item.pictureLoc
                                            ? <img src={window.app.getLocalFileUrl(item.pictureLoc, "")} alt="" />
                                            : <MusicIcon size={20} />}
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
                    <DropdownMenuTrigger render={<Button variant="outline" size="icon" className={`${isWindows ? "mr-24" : "mr-2"} nodrag`} aria-label="Manage libraries"><MoreHorizontalIcon /></Button>} />
                    <DropdownMenuContent align="end" className="w-auto">
                        <DropdownMenuItem onClick={() => setManageLibrariesOpen(true)}><FolderCogIcon />Manage libraries</DropdownMenuItem>
                        <DropdownMenuCheckboxItem onClick={() => void toggleMediaServer()} checked={mediaServerEnabled}><CableIcon />Media server</DropdownMenuCheckboxItem>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                {theme.theme == "light" && <><SunIcon />Light Theme</>}
                                {theme.theme == "dark" && <><MoonIcon />Dark Theme</>}
                                {theme.theme == "system" && <><MonitorIcon />System Theme</>}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={theme.theme} onValueChange={theme.setTheme}>
                                    <DropdownMenuRadioItem value={"light"}>
                                        <SunIcon />Light Theme
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value={"dark"}>
                                        <MoonIcon />Dark Theme
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value={"system"}>
                                        <MonitorIcon />System Theme
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => {
                            window.app.openWindow("/largescreen")
                        }}><FullscreenIcon />Large Screen Mode</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => window.electronAPI?.quit()}><XIcon />Quit</DropdownMenuItem>
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
        {mediaPlayerContext?.playerMetadata !== null ? <Item className="flex flex-row w-fit flex-nowrap p-0">
            <ItemMedia className="rounded-md border-1 bg-muted h-[35px] w-[35px] mr-0 ml-2 mt-0 overflow-hidden">
                {!mediaPlayerContext?.playerMetadata.pictureLoc ? <MusicIcon size={20} /> :
                <img src={window.app.getLocalFileUrl(mediaPlayerContext.playerMetadata.pictureLoc, "")} alt="" />}
            </ItemMedia>
            <ItemContent className="gap-0">
                <ItemTitle className="text-nowrap">{mediaPlayerContext?.playerMetadata.title}</ItemTitle>
                <ItemDescription className="text-nowrap">{mediaPlayerContext?.playerMetadata.artist}</ItemDescription>
            </ItemContent>
        </Item> : <PlayCircleIcon className="absolute left-1/2 -translate-x-[50%] text-foreground/50" />}
        {mediaPlayerContext?.playerMetadata && <span className="ml-auto mr-2 shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatTime(time)} / {formatTime(duration)}
        </span>}
        {/* <Progress
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
        /> */}
        {mediaPlayerContext?.playerMetadata && <Slider
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            disabled={duration <= 0}
            value={Math.min(time, Math.max(duration, 1))}
            onValueChange={(value) => {
                if (typeof value === "number") setSeekingTime(value)
            }}
            onValueCommitted={(value) => {
                if (typeof value === "number") mediaPlayerContext?.seek(value)
                setSeekingTime(null)
            }}
            aria-label="Playback position"
            className="w-full absolute bottom-0 rounded-none nodrag"
        />}
    </div>
}
