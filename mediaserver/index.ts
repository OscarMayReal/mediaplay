import http from 'node:http';
import { SsdpAdvertiser, UpnpMediaServer, ROOT_OBJECT_ID } from '@sonn-audio/node-upnp';
import fs from "node:fs"
import getPath from 'platform-folders';


const provider = {
  async browse(objectId, offset, limit) {
    // if (objectId !== ROOT_OBJECT_ID) return { objects: [], total: 0 };
    if (objectId == ROOT_OBJECT_ID) return { objects: [
        {
            id: "music",
            title: "Music",
            upnpClass: "object.container.storageFolder",
            parentId: ROOT_OBJECT_ID,
        },
        {
            id: "video",
            title: "Video",
            upnpClass: "object.container.storageFolder",
            parentId: ROOT_OBJECT_ID,
        },
        {
            id: "podcast",
            title: "Podcast",
            upnpClass: "object.container.storageFolder",
            parentId: ROOT_OBJECT_ID,
        }
    ], total: 3 };
    if (objectId == "music") {
        const mediaPlayLibraryConfig = JSON.parse(fs.readFileSync(getPath('documents') + "/MediaPlay/library.json", "utf-8"))
        const LibraryDb = JSON.parse(fs.readFileSync(mediaPlayLibraryConfig.libraries.find(item => item.type == "music").path + "/MediaPlayDb/db.json", "utf-8"))
      return {
        objects: Object.entries(LibraryDb.metadataStore).map(([key, value]) => {return {
            id: "music/" + key,
            parentId: "music",
            title: value.title,
            artist: value.artist,
            upnpClass: 'object.item.audioItem.musicTrack',
            resources: [{ url: 'http://host/media/1.mp3', protocolInfo: 'http-get:*:audio/mpeg:*' }],
        }}),
        total: Object.entries(LibraryDb.metadataStore).length,
      }
    };
  },
};

const server = new UpnpMediaServer({
  udn: 'uuid:demo-server-0000-0000-000000000001',
  friendlyName: () => 'My Server',
  baseUrl: () => 'http://192.168.5.101:7799/dms',
  provider,
});

// Route requests under your base path to the framework:
const httpServer = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path.startsWith('/dms/')) server.handle(req, res, path.slice('/dms/'.length));
});
httpServer.listen(7799);

const ssdp = new SsdpAdvertiser();
ssdp.addDevice({ udn: server.udn, ...server.deviceTypeAndServices(), location: () => 'http://192.168.5.101:7799/dms/device.xml' });
await ssdp.start();
console.log("started")