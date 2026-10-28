"use client"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { usePortableMediaDrive } from "@/lib/useDrives"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { CableIcon, SettingsIcon } from "lucide-react"

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
