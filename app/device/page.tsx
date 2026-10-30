"use client"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { usePortableMediaDrive } from "@/lib/useDrives"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { CableIcon, InfoIcon, MusicIcon, PodcastIcon, SettingsIcon, VideoIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DevicePage() {
    const drive = usePortableMediaDrive({autoReload: true})
    const [config, setConfig] = useState<{setupComplete?: boolean} | null>(null)
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
    return <MainDevicePage />
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
                    <Input placeholder="Device Name" value={deviceName} onValueChange={setDeviceName} />
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
                if (!window.fs.existsSync(drive.drive.mountpoint + "/.MediaPlay")) {
                    window.fs.mkdirSync(drive.drive.mountpoint + "/.MediaPlay")
                }
                await window.fsPromises.writeFile(drive.drive.mountpoint + "/.MediaPlay/device.json", JSON.stringify({
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

function MainDevicePage() {
    return <Tabs>
        <div className="w-full border-b-1 py-1 flex flex-row">
            <TabsList className="bg-white gap-1 mx-auto">
                <TabsTrigger value="overview" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><InfoIcon/> Overview</TabsTrigger>
                <TabsTrigger value="music" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><MusicIcon />Music</TabsTrigger>
                <TabsTrigger value="podcasts" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><PodcastIcon />Podcasts</TabsTrigger>
                <TabsTrigger value="videos" className="aria-selected:bg-primary shadow-none! aria-selected:text-background"><VideoIcon /> Videos</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="overview">

        </TabsContent>
    </Tabs>
}