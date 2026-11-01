"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { getLibraries } from "@/lib/getLibraries"
import { useReadConfigFile } from "@/lib/useReadFile"
import { FolderOpenIcon } from "lucide-react"

type LibraryType = "music" | "videos"
const libraryNames: Record<LibraryType, string> = {music: "Music", videos: "Video"}

export function ManageLibrariesDialog({open, onOpenChange}: {open: boolean; onOpenChange: (open: boolean) => void}) {
    const config = useReadConfigFile()
    const defaults = getLibraries()
    const [enabled, setEnabled] = useState<Record<LibraryType, boolean>>({music: false, videos: false})
    const [locations, setLocations] = useState<Record<LibraryType, string>>({music: "", videos: ""})

    useEffect(() => {
        if (open) config.reload()
    }, [open, config.reload])

    useEffect(() => {
        if (!open || !config.data || !defaults) return
        const find = (type: LibraryType) => config.data?.libraries.find(item => item.type === type)
        setEnabled({music: !!find("music"), videos: !!find("videos")})
        setLocations({
            music: config.data.libraryLocations?.music || find("music")?.path || defaults.music,
            videos: config.data.libraryLocations?.videos || find("videos")?.path || defaults.videos,
        })
    }, [open, config.data, defaults?.documents])

    const saveLibrary = async (type: LibraryType, nextEnabled: boolean, location: string) => {
        if (!defaults || !window.fs || !window.fsPromises) return
        const configPath = defaults.documents + "/MediaPlay/library.json"
        let savedConfig: Record<string, any> = {}
        try {
            savedConfig = JSON.parse(await window.fsPromises.readFile(configPath, "utf8"))
        } catch {
            savedConfig = {}
        }
        const libraries = Array.isArray(savedConfig.libraries) ? savedConfig.libraries.filter((item: {type?: string}) => item.type !== type) : []
        if (nextEnabled) libraries.push({type, path: location, name: libraryNames[type]})
        savedConfig.libraries = libraries
        savedConfig.libraryLocations = {...(savedConfig.libraryLocations || {}), [type]: location}
        await window.fsPromises.writeFile(configPath, JSON.stringify(savedConfig, null, 2))
        setEnabled(current => ({...current, [type]: nextEnabled}))
        setLocations(current => ({...current, [type]: location}))
        config.reload()
    }

    const chooseLocation = async (type: LibraryType) => {
        const location = await window.app.selectDirectory()
        if (location) await saveLibrary(type, enabled[type], location)
    }

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Manage Libraries</DialogTitle>
                <DialogDescription>Choose which folders MediaPlay scans for music and videos.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col divide-y rounded-md border">
                {(["music", "videos"] as const).map(type => <div key={type} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">{libraryNames[type]}</span>
                        <Switch aria-label={`Enable ${libraryNames[type]} library`} checked={enabled[type]} onCheckedChange={checked => {
                            void saveLibrary(type, checked, locations[type] || (type === "music" ? defaults?.music : defaults?.videos) || "")
                        }} />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={locations[type]}>{locations[type] || "Choose a folder"}</p>
                        <Button variant="outline" size="sm" onClick={() => void chooseLocation(type)}><FolderOpenIcon />Choose folder</Button>
                    </div>
                </div>)}
            </div>
        </DialogContent>
    </Dialog>
}
