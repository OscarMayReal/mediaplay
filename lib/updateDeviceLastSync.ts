export async function updateDeviceLastSync(mountpoint: string) {
    const configPath = mountpoint + "/.MediaPlay/device.json"
    const config = JSON.parse(await window.fsPromises.readFile(configPath, "utf8"))
    config.lastSyncAt = new Date().toISOString()
    await window.fsPromises.writeFile(configPath, JSON.stringify(config, null, 2))
}
