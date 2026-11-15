import http from 'node:http';
import { SsdpAdvertiser, UpnpMediaServer, ROOT_OBJECT_ID, type ContentProvider } from '@sonn-audio/node-upnp';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type LibraryEntry = { type: string; path: string };
type LibraryConfig = { libraries?: LibraryEntry[] };
type TrackTags = { title?: string; artist?: string; album?: string; [key: string]: unknown };
type IndexedTrack = { libraryPath: string; relativePath: string; tags: TrackTags };

const configPath = path.join(os.homedir(), 'Documents', 'MediaPlay', 'library.json');
const host = process.env.MEDIAPLAY_SERVER_HOST ?? '0.0.0.0';
const advertisedHost = process.env.MEDIAPLAY_SERVER_ADVERTISE_HOST ?? getLanAddress();
const port = Number(process.env.MEDIAPLAY_SERVER_PORT ?? 7799);
const baseUrl = `http://${advertisedHost}:${port}/dms`;

function getLanAddress() {
  const addresses = Object.values(os.networkInterfaces()).flatMap(items => items ?? []);
  return addresses.find(address => address.family === 'IPv4' && !address.internal)?.address ?? '127.0.0.1';
}

function readConfig(): LibraryConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as LibraryConfig;
  } catch {
    return {};
  }
}

function loadLibrary(type: 'music' | 'videos'): IndexedTrack[] {
  const library = readConfig().libraries?.find(item => item.type === type);
  if (!library?.path) return [];
  try {
    const dbPath = path.join(library.path, 'MediaPlayDb', 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as { metadataStore?: Record<string, TrackTags> };
    return Object.entries(db.metadataStore ?? {}).map(([relativePath, tags]) => ({
      libraryPath: path.resolve(library.path),
      relativePath,
      tags,
    }));
  } catch {
    return [];
  }
}

function mimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
    '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.wma': 'audio/x-ms-wma',
    '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.wmv': 'video/x-ms-wmv',
  };
  return types[extension] ?? 'application/octet-stream';
}

const provider: ContentProvider = {
  async browse(objectId, offset, limit) {
    if (objectId === ROOT_OBJECT_ID) {
      const configured = readConfig().libraries ?? [];
      const objects = (['music', 'videos'] as const)
        .filter(type => configured.some(item => item.type === type))
        .map(type => ({
          id: type,
          title: type === 'music' ? 'Music' : 'Video',
          upnpClass: 'object.container.storageFolder',
          parentId: ROOT_OBJECT_ID,
        }));
      return { objects, total: objects.length };
    }

    if (objectId !== 'music' && objectId !== 'videos') return { objects: [], total: 0 };
    const tracks = loadLibrary(objectId);
    return {
      objects: tracks.slice(offset, limit > 0 ? offset + limit : undefined).map(({ libraryPath, relativePath, tags }) => {
        const filePath = path.resolve(libraryPath, relativePath);
        const id = `${objectId}/${encodeURIComponent(relativePath)}`;
        return {
          id,
          parentId: objectId,
          title: tags.title || path.basename(relativePath),
          artist: tags.artist,
          album: tags.album,
          upnpClass: objectId === 'music' ? 'object.item.audioItem.musicTrack' : 'object.item.videoItem',
          resources: [{
            url: `${baseUrl}/media/${objectId}/${relativePath.split('/').map(encodeURIComponent).join('/')}`,
            protocolInfo: `http-get:*:${mimeType(filePath)}:*`,
          }],
        };
      }),
      total: tracks.length,
    };
  },
};

const server = new UpnpMediaServer({
  udn: 'uuid:mediaplay-server-0000-000000000001',
  friendlyName: () => os.hostname() + " (MediaPlay)",
  baseUrl: () => baseUrl,
  provider,
});

function streamMedia(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
  const match = pathname.match(/^\/media\/(music|videos)\/(.+)$/);
  if (!match) {
    res.writeHead(404).end('Not found');
    return;
  }
  let relativePath: string;
  try {
    // Encode each path segment separately so directory separators remain route separators.
    relativePath = match[2].split('/').map(decodeURIComponent).join('/');
  } catch {
    res.writeHead(400).end('Bad path');
    return;
  }
  const track = loadLibrary(match[1] as 'music' | 'videos').find(item => item.relativePath === relativePath);
  if (!track) {
    res.writeHead(404).end('Media not found');
    return;
  }
  const filePath = path.resolve(track.libraryPath, relativePath);
  if (!filePath.startsWith(track.libraryPath + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fsp.stat(filePath).then(stat => {
    if (!stat.isFile()) {
      res.writeHead(404).end('Media not found');
      return;
    }
    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': mimeType(filePath),
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`,
    };
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
      const end = range[2] && range[1] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start >= stat.size || end < start) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      headers['Content-Length'] = end - start + 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  }).catch(() => res.writeHead(404).end('Media not found'));
}

const httpServer = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname.startsWith('/dms/')) {
    if (pathname.startsWith('/dms/media/')) {
      streamMedia(req, res, pathname.slice('/dms'.length));
      return;
    }
    void server.handle(req, res, pathname.slice('/dms/'.length));
    return;
  }
  if (pathname.startsWith('/media/')) {
    streamMedia(req, res, pathname);
    return;
  }
  res.writeHead(404).end('Not found');
});

httpServer.listen(port, host);

const ssdp = new SsdpAdvertiser();
ssdp.addDevice({ udn: server.udn, ...server.deviceTypeAndServices(), location: () => `${baseUrl}/device.xml` });
await ssdp.start();
console.log(`MediaPlay server listening at ${baseUrl}`);
