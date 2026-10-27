import { DriveDataInterface } from "node-drivelist/dist/Interfaces"
import { useEffect, useState } from "react"

export function useDrives({autoReload=false}: {autoReload?: boolean}) {
    function reload() {
        window.drivelist.getDriveList().then(drives => {
            setDrives({loaded: false, drives: drives, reload})
        })
    }
    const [drives, setDrives] = useState<{loaded: boolean, drives: DriveDataInterface[], reload: () => void}>({loaded: false, drives: [], reload})
    useEffect(() => {
        if (!drives.loaded) reload()
        if (autoReload) {
            window.setInterval(() => {
                reload()
            }, 5000)
        }
    }, [])
    return drives
}

export function usePortableMediaDrive({autoReload=false}: {autoReload?: boolean}) {
    function reload() {
        window.drivelist.getDriveList().then(drives => {
            setDrive({loaded: false, drive: drives.find(drive => drive.name?.endsWith("_MP")) || null, reload})
        })
    }
    const [drive, setDrive] = useState<{loaded: boolean, drive: DriveDataInterface | null, reload: () => void}>({loaded: false, drive: null, reload})
    useEffect(() => {
        if (!drive.loaded) reload()
        if (autoReload) {
            window.setInterval(() => {
                reload()
            }, 5000)
        }
    }, [])
    return drive
}