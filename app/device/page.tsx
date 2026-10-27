"use client"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { usePortableMediaDrive } from "@/lib/useDrives"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { CableIcon, SettingsIcon } from "lucide-react"

export default function DevicePage() {
    const drive = usePortableMediaDrive({autoReload: true})
    const [config, setConfig] = useState<object | null>(null)
    useEffect(() => {
        if (drive.drive) {
            if (config == null && window.fs.existsSync(drive.drive.mountpoint + "/.MediaPlay/device.json")) {
                setConfig(JSON.parse(window.fs.readFileSync(drive.drive.mountpoint + "/.MediaPlay/device.json", "utf8")))
            } else if (config == null && !window.fs.existsSync(drive.drive.mountpoint + "/.MediaPlay/device.json")) {
                setConfig({
                    setupComplete: false
                })
            }
        }
    }, [drive])
    if (config !== null && !config.setupComplete) {
        return <DeviceSetupPage />
    }
    return null
}

function DeviceSetupPage() {
    return <Empty>
        <EmptyMedia className="border-1" variant={"icon"}>
            <CableIcon />
        </EmptyMedia>
        <EmptyHeader>
            <EmptyTitle>Set Up Your Device</EmptyTitle>
            <EmptyDescription>Click the button below to create a MediaPlay config file on this device. you can then pick media to sync to this device</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
            <Button><SettingsIcon />Set Up</Button>
        </EmptyContent>
    </Empty>
}