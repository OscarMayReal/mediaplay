"use client"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { usePortableMediaDrive } from "@/lib/useDrives"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { CableIcon, InfoIcon, MusicIcon, SettingsIcon, Trash2Icon, VideoIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const audioExtensions = new Set([".mp3", ".m4a", ".mp4", ".wav", ".flac", ".ogg", ".oga", ".opus", ".webm", ".aiff", ".aif", ".wma", ".ape"])
const videoExtensions = new Set([".mp4", ".m4v", ".mov", ".webm", ".webmv", ".mkv", ".3gp", ".3g2", ".f4v"])
type DeviceConfig = {
    setupComplete?: boolean
    deviceName?: string
    lastSyncAt?: string | Date
    formatSupport?: {audio?: boolean; video?: boolean}
}

export default function DevicePage() {
    const drive = usePortableMediaDrive({autoReload: true})
    const [config, setConfig] = useState<DeviceConfig | null>(null)
    useEffect(() => {
        if (!drive.drive || !window.fsPromises) return
        let cancelled = false
        window.fsPromises.readFile(drive.drive.mountpoint + "/.MediaPlay/device.json", "utf8")
            .then(contents => {
                if (!cancelled) setConfig(JSON.parse(contents))
            })
            .catch(() => {
                if (!cancelled) setConfig({setupComplete: false})
            })
        return () => { cancelled = true }
    }, [drive.drive?.mountpoint])
    useEffect(() => {
        if (!drive.drive || !window.fsPromises) return
        if (!window.fs.existsSync(drive.drive.mountpoint + "/.MediaPlay/syncindex.json")) {
            window.fs.writeFileSync(drive.drive.mountpoint + "/.MediaPlay/syncindex.json", JSON.stringify({
                syncRules: [],
                index: [],
                manualSyncItems: []
            }))
        }
    }, [drive.drive?.mountpoint])
    if (config !== null && !config.setupComplete) {
        return <DeviceSetupPage config={config} setConfig={setConfig} />
    }
    return <MainDevicePage config={config} supportsVideo={config?.formatSupport?.video === true} />
}

function DeviceSetupPage({config, setConfig}: {config: object, setConfig: (input: any) => void}) {
    const drive = usePortableMediaDrive({autoReload: true})
    const [deviceName, setDeviceName] = useState("")
    const [supportsAudio, setSupportsAudio] = useState(false)
    const [supportsVideo, setSupportsVideo] = useState(false)
    return <Empty className="flex flex-col">
        <EmptyMedia className="border-1" variant={"icon"}>
            <CableIcon />
        </EmptyMedia>
        <EmptyHeader>
            <EmptyTitle>Set Up Your Device</EmptyTitle>
            <EmptyDescription>Click the button below to create a MediaPlay config file on this device. you can then pick media to sync to this device</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
            <Field>
                <FieldTitle>
                    Device Name
                </FieldTitle>
                <FieldContent>
                    <Input placeholder="Device Name" value={deviceName} onChange={event => setDeviceName(event.target.value)} />
                </FieldContent>
            </Field>
            <Field>
                <FieldTitle>
                    Device Capabilities
                </FieldTitle>
                <FieldGroup className="gap-3">
                    <Field orientation="horizontal">
                        <Checkbox checked={supportsAudio} onCheckedChange={setSupportsAudio} /><FieldLabel>Audio (Music/Podcasts)</FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                        <Checkbox checked={supportsVideo} onCheckedChange={setSupportsVideo} /><FieldLabel>Video</FieldLabel>
                    </Field>
                </FieldGroup>
            </Field>
            <Button onClick={async () => {
                const mountpoint = drive.drive?.mountpoint
                if (!mountpoint) return
                if (!window.fs.existsSync(mountpoint + "/.MediaPlay")) {
                    window.fs.mkdirSync(mountpoint + "/.MediaPlay")
                }
                await window.fsPromises.writeFile(mountpoint + "/.MediaPlay/device.json", JSON.stringify({
                    version: "1",
                    setupComplete: true,
                    lastSyncAt: new Date(),
                    deviceName: deviceName,
                    formatSupport: {
                        audio: supportsAudio,
                        video: supportsVideo
                    }
                }))
                setConfig({
                    version: "1",
                    setupComplete: true,
                    lastSyncAt: new Date(),
                    deviceName: deviceName,
                    formatSupport: {
                        audio: supportsAudio,
                        video: supportsVideo
                    }
                })
            }} className="w-full"><SettingsIcon />Set Up</Button>
        </EmptyContent>
    </Empty>
}

function MainDevicePage({config, supportsVideo}: {config: DeviceConfig | null; supportsVideo: boolean}) {
    const drive = usePortableMediaDrive({autoReload: true})
    const [musicFiles, setMusicFiles] = useState<string[]>([])
    const [videoFiles, setVideoFiles] = useState<string[]>([])
    useEffect(() => {
        const musicPath = drive.drive?.mountpoint ? drive.drive.mountpoint + "/Music" : null
        if (!musicPath || !window.fs) {
            setMusicFiles([])
            return
        }

        const files: string[] = []
        const visit = (directory: string) => {
            try {
                for (const entry of window.fs.readdirSync(directory, {withFileTypes: true})) {
                    const path = directory + "/" + entry.name
                    if (entry.isDirectory()) visit(path)
                    else if (audioExtensions.has("." + entry.name.split(".").pop()?.toLowerCase())) files.push(path.slice(musicPath.length + 1))
                }
            } catch {
                // The device may be removed while its contents are being read.
            }
        }

        visit(musicPath)
        setMusicFiles(files.sort((a, b) => a.localeCompare(b)))
    }, [drive.drive?.mountpoint])
    useEffect(() => {
        const videosPath = drive.drive?.mountpoint ? drive.drive.mountpoint + "/Videos" : null
        if (!videosPath || !window.fs || !supportsVideo) {
            setVideoFiles([])
            return
        }

        const files: string[] = []
        const visit = (directory: string) => {
            try {
                for (const entry of window.fs.readdirSync(directory, {withFileTypes: true})) {
                    const path = directory + "/" + entry.name
                    if (entry.isDirectory()) visit(path)
                    else if (videoExtensions.has("." + entry.name.split(".").pop()?.toLowerCase())) files.push(path.slice(videosPath.length + 1))
                }
            } catch {
                // The device may be removed while its contents are being read.
            }
        }

        visit(videosPath)
        setVideoFiles(files.sort((a, b) => a.localeCompare(b)))
    }, [drive.drive?.mountpoint, supportsVideo])
    return <Tabs>
        <div className="w-full border-b-1 py-1 flex flex-row">
            <TabsList className="bg-white gap-1 mx-auto">
                <TabsTrigger value="overview" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><InfoIcon/> Overview</TabsTrigger>
                <TabsTrigger value="music" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><MusicIcon />Music</TabsTrigger>
                {/* Podcasts are hidden until podcast syncing is supported. */}
                {supportsVideo && <TabsTrigger value="videos" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><VideoIcon /> Videos</TabsTrigger>}
            </TabsList>
        </div>
        <TabsContent value="overview">
            <div className="mx-auto grid w-full max-w-3xl gap-4 p-6 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Device</p>
                    <h2 className="mt-1 text-xl font-semibold">{config?.deviceName || drive.drive?.name || "Media player"}</h2>
                    <p className="mt-2 break-all text-sm text-muted-foreground">{drive.drive?.mountpoint || "No player connected"}</p>
                </div>
                <div className="rounded-lg border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Media support</p>
                    <p className="mt-2 font-medium">Music: {config?.formatSupport?.audio ? "Enabled" : "Disabled"}</p>
                    <p className="mt-1 font-medium">Video: {config?.formatSupport?.video ? "Enabled" : "Disabled"}</p>
                </div>
                <div className="rounded-lg border bg-card p-5 sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Last synced</p>
                    <p className="mt-2 font-medium">{config?.lastSyncAt && !Number.isNaN(new Date(config.lastSyncAt).getTime()) ? new Date(config.lastSyncAt).toLocaleString() : "No sync recorded"}</p>
                </div>
            </div>
        </TabsContent>
        {supportsVideo && <TabsContent value="videos" className="overflow-auto px-6">
            {videoFiles.length ? <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow><TableHead>Title</TableHead><TableHead>Location</TableHead><TableHead className="w-12" /></TableRow>
                </TableHeader>
                <TableBody>
                    {videoFiles.map(path => <TableRow key={path}>
                        <TableCell className="truncate max-w-0">{path.split("/").pop()?.replace(/\.[^.]+$/, "")}</TableCell>
                        <TableCell className="truncate max-w-0">{path}</TableCell>
                        <TableCell className="w-12 p-1">
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${path.split("/").pop()} from player`} onClick={async () => {
                                const mountpoint = drive.drive?.mountpoint
                                if (!mountpoint) return
                                try {
                                    await window.fsPromises.unlink(mountpoint + "/Videos/" + path)
                                    setVideoFiles(files => files.filter(file => file !== path))
                                } catch (error) {
                                    console.error("Could not remove video file from player", error)
                                }
                            }}><Trash2Icon /></Button>
                        </TableCell>
                    </TableRow>)}
                </TableBody>
            </Table> : <Empty className="h-full">
                <EmptyMedia variant="icon"><VideoIcon /></EmptyMedia>
                <EmptyHeader><EmptyTitle>No videos found</EmptyTitle><EmptyDescription>Video files in the player’s Videos folder will appear here.</EmptyDescription></EmptyHeader>
            </Empty>}
        </TabsContent>}
        <TabsContent value="music" className="overflow-auto px-6">
            {musicFiles.length ? <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow><TableHead>Title</TableHead><TableHead>Location</TableHead><TableHead className="w-12" /></TableRow>
                </TableHeader>
                <TableBody>
                    {musicFiles.map(path => <TableRow key={path}>
                        <TableCell className="truncate max-w-0">{path.split("/").pop()?.replace(/\.[^.]+$/, "")}</TableCell>
                        <TableCell className="truncate max-w-0">{path}</TableCell>
                        <TableCell className="w-12 p-1">
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${path.split("/").pop()} from player`} onClick={async () => {
                                const mountpoint = drive.drive?.mountpoint
                                if (!mountpoint) return
                                const fullPath = mountpoint + "/Music/" + path
                                try {
                                    await window.fsPromises.unlink(fullPath)
                                    setMusicFiles(files => files.filter(file => file !== path))
                                } catch (error) {
                                    console.error("Could not remove music file from player", error)
                                }
                            }}><Trash2Icon /></Button>
                        </TableCell>
                    </TableRow>)}
                </TableBody>
            </Table> : <Empty className="h-full">
                <EmptyMedia variant="icon"><MusicIcon /></EmptyMedia>
                <EmptyHeader><EmptyTitle>No music found</EmptyTitle><EmptyDescription>Music files in the player’s Music folder will appear here.</EmptyDescription></EmptyHeader>
            </Empty>}
        </TabsContent>
    </Tabs>
}
