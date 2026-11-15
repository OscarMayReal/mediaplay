"use client"
import { useMediaPlayerContext } from "@/components/mediaPlayerContext"
import { FocusNode } from "@please/lrud"
import { ArrowLeftCircleIcon, FullscreenIcon, ListIcon, MoonIcon, MusicIcon, PauseIcon, PlayIcon, PodcastIcon, SettingsIcon, ShrinkIcon, SkipForwardIcon, SunIcon, VideoIcon, XCircleIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LargeScreenHome() {
    const router = useRouter()
    const mediaPlayerContext = useMediaPlayerContext()
    const theme = useTheme()
    const [selectedItem, setSelectedItem] = useState("theme")
    return <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full w-full">
        <FocusNode orientation="horizontal" className="flex flex-row items-center gap-12 p-12 pb-0">
            <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                router.back()
            }}>
                <ArrowLeftCircleIcon size={30} />
                Settings
            </FocusNode>
        </FocusNode>
        <div className="w-full h-full flex flex-row">
            <FocusNode orientation="vertical" className="flex flex-col gap-6 h-full justify-center p-12">
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    if (theme.theme == "light") {
                        theme.setTheme("dark")
                    } else {
                        theme.setTheme("light")
                    }
                }} onFocused={() => {
                    setSelectedItem("theme")
                }}>
                    {theme.theme == "light" ? <SunIcon size={30} /> : <MoonIcon size={30} />}{theme.theme == "light" ? "Theme: Light" : "Theme: Dark"}
                </FocusNode>
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    if (document.fullscreenElement) {
                        document.exitFullscreen()
                    } else {
                        document.getElementById("root").requestFullscreen()
                    }
                }} onFocused={() => {
                    setSelectedItem("fullscreen")
                }}>
                    {document.fullscreenElement ? <ShrinkIcon size={30} /> : <FullscreenIcon size={30} />}{document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen"}
                </FocusNode>
                <FocusNode className="text-4xl text-muted-foreground [&.isFocused]:text-foreground [&.isFocused]:font-semibold flex flex-row items-center gap-3 animate-all" onSelected={() => {
                    window.close()
                }} onFocused={() => {
                    setSelectedItem("exit")
                }}>
                    <XCircleIcon size={30} />Exit LSM
                </FocusNode>
            </FocusNode>
            <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                {selectedItem == "theme" && <>
                    <h1 className="text-4xl text-center">
                        Theme
                    </h1>
                    <p className="text-2xl max-w-[400px] text-center">
                        Sets the theme (Light or dark). This applies to the main MediaPlay interface as well, not just Large Screen Mode
                    </p>
                </>}
                {selectedItem == "fullscreen" && <>
                    <h1 className="text-4xl text-center">
                        Fullscreen
                    </h1>
                    <p className="text-2xl max-w-[400px] text-center">
                        Makes the Large Screen Mode windows fullscreen or standard
                    </p>
                </>}
                {selectedItem == "exit" && <>
                    <h1 className="text-4xl text-center">
                        Exit LSM
                    </h1>
                    <p className="text-2xl max-w-[400px] text-center">
                        Exits Large Screen Mode. This does not exit MediaPlay fully
                    </p>
                </>}
            </div>
        </div>
    </FocusNode>
}
