// mediaserver/index.ts
import http3 from "node:http";
// node_modules/@sonn-audio/node-upnp/dist/esm/ssdp/advertiser.js
import dgram from "node:dgram";
var SSDP_ADDRESS = "239.255.255.250";
var SSDP_PORT = 1900;
var ADVERTISE_INTERVAL_MS = 30000;
var MAX_AGE_SECONDS = 1800;

class SsdpAdvertiser {
  socket;
  timer;
  running = false;
  devices = new Map;
  serverHeaderValue;
  log;
  constructor(options = {}) {
    this.serverHeaderValue = options.serverHeader ?? "Linux/5 UPnP/1.0 node-upnp/1.0";
    this.log = options.logger;
  }
  addDevice(device) {
    this.devices.set(device.udn, device);
    if (this.running) {
      this.sendAliveFor(device);
    }
  }
  removeDevice(udn) {
    const device = this.devices.get(udn);
    if (!device) {
      return;
    }
    this.devices.delete(udn);
    if (this.running) {
      this.sendByebyeFor(device);
    }
  }
  hasDevices() {
    return this.devices.size > 0;
  }
  async start() {
    if (this.running) {
      return;
    }
    this.running = true;
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.socket = socket;
    socket.on("message", (msg, rinfo) => this.handleMessage(msg, rinfo));
    const bound = await new Promise((resolve) => {
      const onBindError = (error) => {
        this.log?.warn?.("ssdp bind failed; advertiser disabled", {
          message: error.message
        });
        resolve(false);
      };
      socket.once("error", onBindError);
      socket.bind(SSDP_PORT, () => {
        socket.removeListener("error", onBindError);
        try {
          socket.addMembership(SSDP_ADDRESS);
        } catch (error) {
          this.log?.warn?.("ssdp addMembership failed", {
            message: error instanceof Error ? error.message : String(error)
          });
        }
        resolve(true);
      });
    });
    if (!bound) {
      socket.on("error", () => {});
      this.running = false;
      this.socket = undefined;
      try {
        socket.close();
      } catch {}
      return;
    }
    socket.on("error", (error) => {
      this.log?.warn?.("ssdp socket error", { message: error.message });
    });
    this.sendAlive();
    this.timer = setInterval(() => this.sendAlive(), ADVERTISE_INTERVAL_MS);
    this.timer.unref?.();
    this.log?.info?.("ssdp advertiser started", { devices: this.devices.size });
  }
  async stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    try {
      this.sendByebye();
    } catch {}
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      await new Promise((resolve) => {
        try {
          socket.close(() => resolve());
        } catch {
          resolve();
        }
      });
    }
  }
  notificationTypes(device) {
    return [
      { nt: "upnp:rootdevice", usnSuffix: "::upnp:rootdevice" },
      { nt: device.udn, usnSuffix: "" },
      { nt: device.deviceType, usnSuffix: `::${device.deviceType}` },
      ...device.serviceTypes.map((svc) => ({ nt: svc, usnSuffix: `::${svc}` }))
    ];
  }
  sendAlive() {
    for (const device of this.devices.values()) {
      this.sendAliveFor(device);
    }
  }
  sendAliveFor(device) {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    const location = device.location();
    for (const { nt, usnSuffix } of this.notificationTypes(device)) {
      const usn = `${device.udn}${usnSuffix}`;
      const message = `NOTIFY * HTTP/1.1\r
` + `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r
` + `CACHE-CONTROL: max-age=${MAX_AGE_SECONDS}\r
` + `LOCATION: ${location}\r
` + `NTS: ssdp:alive\r
` + `NT: ${nt}\r
` + `SERVER: ${this.serverHeaderValue}\r
` + `USN: ${usn}\r
` + `\r
`;
      const buf = Buffer.from(message, "ascii");
      socket.send(buf, 0, buf.length, SSDP_PORT, SSDP_ADDRESS);
    }
  }
  sendByebye() {
    for (const device of this.devices.values()) {
      this.sendByebyeFor(device);
    }
  }
  sendByebyeFor(device) {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    for (const { nt, usnSuffix } of this.notificationTypes(device)) {
      const usn = `${device.udn}${usnSuffix}`;
      const message = `NOTIFY * HTTP/1.1\r
` + `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r
` + `NTS: ssdp:byebye\r
` + `NT: ${nt}\r
` + `USN: ${usn}\r
` + `\r
`;
      const buf = Buffer.from(message, "ascii");
      socket.send(buf, 0, buf.length, SSDP_PORT, SSDP_ADDRESS);
    }
  }
  handleMessage(msg, rinfo) {
    const text = msg.toString("ascii");
    if (!text.startsWith("M-SEARCH")) {
      return;
    }
    const headers = parseHeaders(text);
    if ((headers.man ?? "").replace(/"/g, "") !== "ssdp:discover") {
      return;
    }
    const st = (headers.st ?? "").trim();
    for (const device of this.devices.values()) {
      for (const { nt, usnSuffix } of this.matchingTargets(device, st)) {
        this.sendSearchResponse(device, nt, usnSuffix, rinfo);
      }
    }
  }
  matchingTargets(device, st) {
    const all = this.notificationTypes(device);
    if (st === "ssdp:all") {
      return all;
    }
    return all.filter((t) => t.nt === st);
  }
  sendSearchResponse(device, nt, usnSuffix, rinfo) {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    const usn = `${device.udn}${usnSuffix}`;
    const message = `HTTP/1.1 200 OK\r
` + `CACHE-CONTROL: max-age=${MAX_AGE_SECONDS}\r
` + `EXT:\r
` + `LOCATION: ${device.location()}\r
` + `SERVER: ${this.serverHeaderValue}\r
` + `ST: ${nt}\r
` + `USN: ${usn}\r
` + `\r
`;
    const buf = Buffer.from(message, "ascii");
    socket.send(buf, 0, buf.length, rinfo.port, rinfo.address);
  }
}
function parseHeaders(text) {
  const headers = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key) {
      headers[key] = value;
    }
  }
  return headers;
}
// node_modules/@sonn-audio/node-upnp/dist/esm/renderer/mediaRenderer.js
import http from "node:http";

// node_modules/@sonn-audio/node-upnp/dist/esm/soap/soap.js
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function unescapeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, "&");
}
function parseSoapAction(header) {
  const raw = Array.isArray(header) ? header[0] ?? "" : header ?? "";
  const cleaned = raw.replace(/"/g, "").trim();
  const hash = cleaned.lastIndexOf("#");
  return hash >= 0 ? cleaned.slice(hash + 1) : cleaned;
}
function extractTag(xml, tag) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "i");
  const match = re.exec(xml);
  if (!match) {
    return null;
  }
  return unescapeXml(match[1] ?? "").trim();
}
function buildSoapResponse(serviceType, action, args = {}) {
  const body = Object.entries(args).map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`).join("");
  return '<?xml version="1.0" encoding="utf-8"?>' + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' + 's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' + "<s:Body>" + `<u:${action}Response xmlns:u="${serviceType}">${body}</u:${action}Response>` + "</s:Body></s:Envelope>";
}
function buildSoapFault(message, errorCode = 401) {
  return '<?xml version="1.0" encoding="utf-8"?>' + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' + 's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' + "<s:Body><s:Fault><faultcode>s:Client</faultcode>" + "<faultstring>UPnPError</faultstring><detail>" + `<UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>${errorCode}</errorCode>` + `<errorDescription>${escapeXml(message)}</errorDescription></UPnPError>` + "</detail></s:Fault></s:Body></s:Envelope>";
}
function extractFaultCode(xml) {
  return /<errorCode>\s*(\d+)\s*<\/errorCode>/i.exec(xml)?.[1] ?? null;
}

// node_modules/@sonn-audio/node-upnp/dist/esm/didl/didl.js
var DIDL_OPEN = '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ' + 'xmlns:dc="http://purl.org/dc/elements/1.1/" ' + 'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">';
var DIDL_CLOSE = "</DIDL-Lite>";
function buildContainerElement(container) {
  const childCountAttr = typeof container.childCount === "number" ? ` childCount="${container.childCount}"` : "";
  const parts = [
    `<container id="${escapeXml(container.id)}" parentID="${escapeXml(container.parentId)}" ` + `restricted="1"${childCountAttr}>`,
    `<dc:title>${escapeXml(container.title)}</dc:title>`
  ];
  const creator = container.creator ?? container.artist;
  if (creator) {
    parts.push(`<dc:creator>${escapeXml(creator)}</dc:creator>`);
  }
  if (container.artist) {
    parts.push(`<upnp:artist>${escapeXml(container.artist)}</upnp:artist>`);
  }
  if (container.genre) {
    parts.push(`<upnp:genre>${escapeXml(container.genre)}</upnp:genre>`);
  }
  if (container.albumArtUri) {
    parts.push(`<upnp:albumArtURI>${escapeXml(container.albumArtUri)}</upnp:albumArtURI>`);
  }
  parts.push(`<upnp:class>${escapeXml(container.upnpClass ?? "object.container.storageFolder")}</upnp:class>`, "</container>");
  return parts.join("");
}
function buildItemElement(item) {
  const parts = [
    `<item id="${escapeXml(item.id)}" parentID="${escapeXml(item.parentId)}" restricted="1">`,
    `<dc:title>${escapeXml(item.title)}</dc:title>`
  ];
  const creator = item.creator ?? item.artist;
  if (creator) {
    parts.push(`<dc:creator>${escapeXml(creator)}</dc:creator>`);
  }
  if (item.artist) {
    parts.push(`<upnp:artist>${escapeXml(item.artist)}</upnp:artist>`);
  }
  if (item.album) {
    parts.push(`<upnp:album>${escapeXml(item.album)}</upnp:album>`);
  }
  if (item.albumArtUri) {
    parts.push(`<upnp:albumArtURI>${escapeXml(item.albumArtUri)}</upnp:albumArtURI>`);
  }
  parts.push(`<upnp:class>${escapeXml(item.upnpClass ?? "object.item.audioItem.musicTrack")}</upnp:class>`);
  for (const res of item.resources ?? []) {
    parts.push(buildResElement(res));
  }
  parts.push("</item>");
  return parts.join("");
}
function buildResElement(res) {
  const attrs = [];
  if (res.duration)
    attrs.push(`duration="${escapeXml(res.duration)}"`);
  if (res.size)
    attrs.push(`size="${res.size}"`);
  if (res.bitrate)
    attrs.push(`bitrate="${res.bitrate}"`);
  if (res.sampleFrequency)
    attrs.push(`sampleFrequency="${res.sampleFrequency}"`);
  if (res.nrAudioChannels)
    attrs.push(`nrAudioChannels="${res.nrAudioChannels}"`);
  const attrStr = attrs.length ? ` ${attrs.join(" ")}` : "";
  return `<res${attrStr} protocolInfo="${escapeXml(res.protocolInfo)}">${escapeXml(res.url)}</res>`;
}
function wrapDidl(elements) {
  return `${DIDL_OPEN}${elements.join("")}${DIDL_CLOSE}`;
}
function unescape(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, "&");
}
function fieldRegex(tag) {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
}
function readDidlDuration(metadata) {
  const didl = unescape(metadata);
  const m = /duration="([^"]+)"/i.exec(didl);
  return m?.[1] ?? null;
}
function parseDidlObject(metadata) {
  const didl = unescape(metadata);
  const isItem = /<item[\s>]/i.test(didl);
  const isContainer = /<container[\s>]/i.test(didl);
  if (!isItem && !isContainer) {
    return null;
  }
  const field = (tag) => {
    const m = fieldRegex(tag).exec(didl);
    return m ? unescape(m[1] ?? "").trim() : undefined;
  };
  const idMatch = /<(?:item|container)[^>]*\bid="([^"]*)"/i.exec(didl);
  const parentMatch = /<(?:item|container)[^>]*\bparentID="([^"]*)"/i.exec(didl);
  const resMatch = /<res[^>]*>([\s\S]*?)<\/res>/i.exec(didl);
  return {
    kind: isItem ? "item" : "container",
    id: idMatch?.[1] ?? "",
    parentId: parentMatch?.[1] ?? "",
    title: field("dc:title") ?? "",
    artist: field("upnp:artist") ?? field("dc:creator"),
    album: field("upnp:album"),
    albumArtUri: field("upnp:albumArtURI"),
    upnpClass: field("upnp:class"),
    duration: readDidlDuration(metadata) ?? undefined,
    res: resMatch ? unescape(resMatch[1] ?? "").trim() : undefined
  };
}

// node_modules/@sonn-audio/node-upnp/dist/esm/description/deviceDescription.js
var DEFAULTS = {
  manufacturer: "node-upnp",
  manufacturerUrl: "https://www.npmjs.com/package/@sonn-audio/node-upnp",
  modelName: "node-upnp",
  modelNumber: "1",
  modelDescription: "node-upnp device"
};
function buildDeviceDescription(params) {
  const { deviceType, identity, services, urlBase, dlnaDoc } = params;
  const id = { ...DEFAULTS, ...identity };
  const urlBaseEl = urlBase ? `<URLBase>${escapeXml(urlBase)}</URLBase>` : "";
  const dlnaEl = dlnaDoc ? `<dlna:X_DLNADOC xmlns:dlna="urn:schemas-dlna-org:device-1-0">${escapeXml(dlnaDoc)}</dlna:X_DLNADOC>` : "";
  const serviceList = services.map(serviceElement).join("");
  return '<?xml version="1.0" encoding="utf-8"?>' + '<root xmlns="urn:schemas-upnp-org:device-1-0">' + "<specVersion><major>1</major><minor>0</minor></specVersion>" + urlBaseEl + "<device>" + `<deviceType>${escapeXml(deviceType)}</deviceType>` + `<friendlyName>${escapeXml(id.friendlyName)}</friendlyName>` + `<manufacturer>${escapeXml(id.manufacturer)}</manufacturer>` + `<manufacturerURL>${escapeXml(id.manufacturerUrl)}</manufacturerURL>` + `<modelDescription>${escapeXml(id.modelDescription)}</modelDescription>` + `<modelName>${escapeXml(id.modelName)}</modelName>` + `<modelNumber>${escapeXml(id.modelNumber)}</modelNumber>` + `<UDN>${escapeXml(id.udn)}</UDN>` + dlnaEl + `<serviceList>${serviceList}</serviceList>` + "</device>" + "</root>";
}
function serviceElement(s) {
  return "<service>" + `<serviceType>${escapeXml(s.serviceType)}</serviceType>` + `<serviceId>${escapeXml(s.serviceId)}</serviceId>` + `<SCPDURL>${escapeXml(s.scpdUrl)}</SCPDURL>` + `<controlURL>${escapeXml(s.controlUrl)}</controlURL>` + `<eventSubURL>${escapeXml(s.eventSubUrl)}</eventSubURL>` + "</service>";
}
var SERVICE_TYPES = {
  contentDirectory: "urn:schemas-upnp-org:service:ContentDirectory:1",
  connectionManager: "urn:schemas-upnp-org:service:ConnectionManager:1",
  avTransport: "urn:schemas-upnp-org:service:AVTransport:1",
  renderingControl: "urn:schemas-upnp-org:service:RenderingControl:1"
};
var DEVICE_TYPES = {
  mediaServer: "urn:schemas-upnp-org:device:MediaServer:1",
  mediaRenderer: "urn:schemas-upnp-org:device:MediaRenderer:1"
};

// node_modules/@sonn-audio/node-upnp/dist/esm/description/scpd.js
var CONTENT_DIRECTORY_SCPD = `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action>
      <name>Browse</name>
      <argumentList>
        <argument><name>ObjectID</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_ObjectID</relatedStateVariable></argument>
        <argument><name>BrowseFlag</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_BrowseFlag</relatedStateVariable></argument>
        <argument><name>Filter</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_Filter</relatedStateVariable></argument>
        <argument><name>StartingIndex</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_Index</relatedStateVariable></argument>
        <argument><name>RequestedCount</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>SortCriteria</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_SortCriteria</relatedStateVariable></argument>
        <argument><name>Result</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_Result</relatedStateVariable></argument>
        <argument><name>NumberReturned</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>TotalMatches</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>UpdateID</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_UpdateID</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>Search</name>
      <argumentList>
        <argument><name>ContainerID</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_ObjectID</relatedStateVariable></argument>
        <argument><name>SearchCriteria</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_SearchCriteria</relatedStateVariable></argument>
        <argument><name>Filter</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_Filter</relatedStateVariable></argument>
        <argument><name>StartingIndex</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_Index</relatedStateVariable></argument>
        <argument><name>RequestedCount</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>SortCriteria</name><direction>in</direction>
          <relatedStateVariable>A_ARG_TYPE_SortCriteria</relatedStateVariable></argument>
        <argument><name>Result</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_Result</relatedStateVariable></argument>
        <argument><name>NumberReturned</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>TotalMatches</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable></argument>
        <argument><name>UpdateID</name><direction>out</direction>
          <relatedStateVariable>A_ARG_TYPE_UpdateID</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>GetSystemUpdateID</name>
      <argumentList>
        <argument><name>Id</name><direction>out</direction>
          <relatedStateVariable>SystemUpdateID</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>GetSearchCapabilities</name>
      <argumentList>
        <argument><name>SearchCaps</name><direction>out</direction>
          <relatedStateVariable>SearchCapabilities</relatedStateVariable></argument>
      </argumentList>
    </action>
    <action>
      <name>GetSortCapabilities</name>
      <argumentList>
        <argument><name>SortCaps</name><direction>out</direction>
          <relatedStateVariable>SortCapabilities</relatedStateVariable></argument>
      </argumentList>
    </action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_ObjectID</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Result</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_BrowseFlag</name><dataType>string</dataType>
      <allowedValueList><allowedValue>BrowseMetadata</allowedValue><allowedValue>BrowseDirectChildren</allowedValue></allowedValueList>
    </stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Filter</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_SortCriteria</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_SearchCriteria</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Index</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Count</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_UpdateID</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>SystemUpdateID</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>SearchCapabilities</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>SortCapabilities</name><dataType>string</dataType></stateVariable>
  </serviceStateTable>
</scpd>`;
var CONNECTION_MANAGER_SCPD = `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action>
      <name>GetProtocolInfo</name>
      <argumentList>
        <argument><name>Source</name><direction>out</direction><relatedStateVariable>SourceProtocolInfo</relatedStateVariable></argument>
        <argument><name>Sink</name><direction>out</direction><relatedStateVariable>SinkProtocolInfo</relatedStateVariable></argument>
      </argumentList>
    </action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="yes"><name>SourceProtocolInfo</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>SinkProtocolInfo</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>CurrentConnectionIDs</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_ConnectionID</name><dataType>i4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_ProtocolInfo</name><dataType>string</dataType></stateVariable>
  </serviceStateTable>
</scpd>`;
var AV_TRANSPORT_SCPD = `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action><name>SetAVTransportURI</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>CurrentURI</name><direction>in</direction>
        <relatedStateVariable>AVTransportURI</relatedStateVariable></argument>
      <argument><name>CurrentURIMetaData</name><direction>in</direction>
        <relatedStateVariable>AVTransportURIMetaData</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>SetNextAVTransportURI</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>NextURI</name><direction>in</direction>
        <relatedStateVariable>NextAVTransportURI</relatedStateVariable></argument>
      <argument><name>NextURIMetaData</name><direction>in</direction>
        <relatedStateVariable>NextAVTransportURIMetaData</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>Play</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Speed</name><direction>in</direction>
        <relatedStateVariable>TransportPlaySpeed</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>Pause</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>Stop</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>Seek</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Unit</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_SeekMode</relatedStateVariable></argument>
      <argument><name>Target</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_SeekTarget</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>GetTransportInfo</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>CurrentTransportState</name><direction>out</direction>
        <relatedStateVariable>TransportState</relatedStateVariable></argument>
      <argument><name>CurrentTransportStatus</name><direction>out</direction>
        <relatedStateVariable>TransportStatus</relatedStateVariable></argument>
      <argument><name>CurrentSpeed</name><direction>out</direction>
        <relatedStateVariable>TransportPlaySpeed</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>GetPositionInfo</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Track</name><direction>out</direction>
        <relatedStateVariable>CurrentTrack</relatedStateVariable></argument>
      <argument><name>TrackDuration</name><direction>out</direction>
        <relatedStateVariable>CurrentTrackDuration</relatedStateVariable></argument>
      <argument><name>TrackMetaData</name><direction>out</direction>
        <relatedStateVariable>CurrentTrackMetaData</relatedStateVariable></argument>
      <argument><name>TrackURI</name><direction>out</direction>
        <relatedStateVariable>CurrentTrackURI</relatedStateVariable></argument>
      <argument><name>RelTime</name><direction>out</direction>
        <relatedStateVariable>RelativeTimePosition</relatedStateVariable></argument>
      <argument><name>AbsTime</name><direction>out</direction>
        <relatedStateVariable>AbsoluteTimePosition</relatedStateVariable></argument>
      <argument><name>RelCount</name><direction>out</direction>
        <relatedStateVariable>RelativeCounterPosition</relatedStateVariable></argument>
      <argument><name>AbsCount</name><direction>out</direction>
        <relatedStateVariable>AbsoluteCounterPosition</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>GetMediaInfo</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>NrTracks</name><direction>out</direction>
        <relatedStateVariable>NumberOfTracks</relatedStateVariable></argument>
      <argument><name>MediaDuration</name><direction>out</direction>
        <relatedStateVariable>CurrentMediaDuration</relatedStateVariable></argument>
      <argument><name>CurrentURI</name><direction>out</direction>
        <relatedStateVariable>AVTransportURI</relatedStateVariable></argument>
      <argument><name>CurrentURIMetaData</name><direction>out</direction>
        <relatedStateVariable>AVTransportURIMetaData</relatedStateVariable></argument>
      <argument><name>NextURI</name><direction>out</direction>
        <relatedStateVariable>NextAVTransportURI</relatedStateVariable></argument>
      <argument><name>NextURIMetaData</name><direction>out</direction>
        <relatedStateVariable>NextAVTransportURIMetaData</relatedStateVariable></argument>
      <argument><name>PlayMedium</name><direction>out</direction>
        <relatedStateVariable>PlaybackStorageMedium</relatedStateVariable></argument>
      <argument><name>RecordMedium</name><direction>out</direction>
        <relatedStateVariable>RecordStorageMedium</relatedStateVariable></argument>
      <argument><name>WriteStatus</name><direction>out</direction>
        <relatedStateVariable>RecordMediumWriteStatus</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>GetTransportSettings</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>PlayMode</name><direction>out</direction>
        <relatedStateVariable>CurrentPlayMode</relatedStateVariable></argument>
      <argument><name>RecQualityMode</name><direction>out</direction>
        <relatedStateVariable>CurrentRecordQualityMode</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>GetDeviceCapabilities</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>PlayMedia</name><direction>out</direction>
        <relatedStateVariable>PossiblePlaybackStorageMedia</relatedStateVariable></argument>
      <argument><name>RecMedia</name><direction>out</direction>
        <relatedStateVariable>PossibleRecordStorageMedia</relatedStateVariable></argument>
      <argument><name>RecQualityModes</name><direction>out</direction>
        <relatedStateVariable>PossibleRecordQualityModes</relatedStateVariable></argument>
    </argumentList></action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="yes"><name>LastChange</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>TransportState</name><dataType>string</dataType>
      <allowedValueList><allowedValue>STOPPED</allowedValue><allowedValue>PLAYING</allowedValue>
      <allowedValue>PAUSED_PLAYBACK</allowedValue><allowedValue>TRANSITIONING</allowedValue>
      <allowedValue>NO_MEDIA_PRESENT</allowedValue></allowedValueList></stateVariable>
    <stateVariable sendEvents="no"><name>TransportStatus</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>TransportPlaySpeed</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>NumberOfTracks</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentTrack</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentTrackDuration</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentMediaDuration</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentTrackMetaData</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentTrackURI</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>AVTransportURI</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>AVTransportURIMetaData</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>NextAVTransportURI</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>NextAVTransportURIMetaData</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>RelativeTimePosition</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>AbsoluteTimePosition</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>RelativeCounterPosition</name><dataType>i4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>AbsoluteCounterPosition</name><dataType>i4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>PlaybackStorageMedium</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>RecordStorageMedium</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>RecordMediumWriteStatus</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>PossiblePlaybackStorageMedia</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>PossibleRecordStorageMedia</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentPlayMode</name><dataType>string</dataType>
      <defaultValue>NORMAL</defaultValue></stateVariable>
    <stateVariable sendEvents="no"><name>PossibleRecordQualityModes</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>CurrentRecordQualityMode</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_InstanceID</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_SeekMode</name><dataType>string</dataType>
      <allowedValueList><allowedValue>REL_TIME</allowedValue><allowedValue>ABS_TIME</allowedValue></allowedValueList></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_SeekTarget</name><dataType>string</dataType></stateVariable>
  </serviceStateTable>
</scpd>`;
var RENDERING_CONTROL_SCPD = `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action><name>GetVolume</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Channel</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_Channel</relatedStateVariable></argument>
      <argument><name>CurrentVolume</name><direction>out</direction>
        <relatedStateVariable>Volume</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>SetVolume</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Channel</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_Channel</relatedStateVariable></argument>
      <argument><name>DesiredVolume</name><direction>in</direction>
        <relatedStateVariable>Volume</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>GetMute</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Channel</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_Channel</relatedStateVariable></argument>
      <argument><name>CurrentMute</name><direction>out</direction>
        <relatedStateVariable>Mute</relatedStateVariable></argument>
    </argumentList></action>
    <action><name>SetMute</name><argumentList>
      <argument><name>InstanceID</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_InstanceID</relatedStateVariable></argument>
      <argument><name>Channel</name><direction>in</direction>
        <relatedStateVariable>A_ARG_TYPE_Channel</relatedStateVariable></argument>
      <argument><name>DesiredMute</name><direction>in</direction>
        <relatedStateVariable>Mute</relatedStateVariable></argument>
    </argumentList></action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="yes"><name>LastChange</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>Volume</name><dataType>ui2</dataType>
      <allowedValueRange><minimum>0</minimum><maximum>100</maximum><step>1</step></allowedValueRange></stateVariable>
    <stateVariable sendEvents="no"><name>Mute</name><dataType>boolean</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_InstanceID</name><dataType>ui4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_Channel</name><dataType>string</dataType>
      <allowedValueList><allowedValue>Master</allowedValue></allowedValueList></stateVariable>
  </serviceStateTable>
</scpd>`;
var CONNECTION_MANAGER_SINK_SCPD = `<?xml version="1.0" encoding="utf-8"?>
<scpd xmlns="urn:schemas-upnp-org:service-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <actionList>
    <action><name>GetProtocolInfo</name><argumentList>
      <argument><name>Source</name><direction>out</direction>
        <relatedStateVariable>SourceProtocolInfo</relatedStateVariable></argument>
      <argument><name>Sink</name><direction>out</direction>
        <relatedStateVariable>SinkProtocolInfo</relatedStateVariable></argument>
    </argumentList></action>
  </actionList>
  <serviceStateTable>
    <stateVariable sendEvents="yes"><name>SourceProtocolInfo</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>SinkProtocolInfo</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="yes"><name>CurrentConnectionIDs</name><dataType>string</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_ConnectionID</name><dataType>i4</dataType></stateVariable>
    <stateVariable sendEvents="no"><name>A_ARG_TYPE_ProtocolInfo</name><dataType>string</dataType></stateVariable>
  </serviceStateTable>
</scpd>`;

// node_modules/@sonn-audio/node-upnp/dist/esm/renderer/mediaRenderer.js
var RENDERER_PATHS = {
  device: "device.xml",
  avtScpd: "avt/scpd.xml",
  rcScpd: "rc/scpd.xml",
  cmScpd: "cm/scpd.xml",
  avtControl: "avt/control",
  rcControl: "rc/control",
  cmControl: "cm/control",
  avtEvent: "avt/event",
  rcEvent: "rc/event"
};
var AVT_NS = SERVICE_TYPES.avTransport;
var RC_NS = SERVICE_TYPES.renderingControl;
var CM_NS = SERVICE_TYPES.connectionManager;
var SINK_PROTOCOL_INFO = [
  "audio/mpeg",
  "audio/x-mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  "audio/wav",
  "audio/L16",
  "application/ogg"
].map((mime) => `http-get:*:${mime}:*`).join(",");

class UpnpMediaRenderer {
  opts;
  transportState = "NO_MEDIA_PRESENT";
  currentUri = "";
  currentUriMetaData = "";
  nextUri = "";
  nextUriMetaData = "";
  durationSec = 0;
  volume = 100;
  muted = false;
  startedAtMs = 0;
  pausedElapsedSec = 0;
  subscriptions = new Map;
  renewTimer;
  log;
  constructor(opts) {
    this.opts = opts;
    this.log = opts.logger;
    this.renewTimer = setInterval(() => this.pruneSubscriptions(), 30000);
    this.renewTimer.unref?.();
  }
  get udn() {
    return this.opts.udn;
  }
  deviceTypeAndServices() {
    return {
      deviceType: DEVICE_TYPES.mediaRenderer,
      serviceTypes: [AVT_NS, RC_NS, CM_NS]
    };
  }
  dispose() {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = undefined;
    }
    this.subscriptions.clear();
  }
  reflectVolume(percent) {
    this.volume = clampVolume(percent);
  }
  reflectTransportState(state) {
    this.setState(state);
  }
  async handle(req, res, sub) {
    const method = (req.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      if (sub === RENDERER_PATHS.device) {
        return this.sendXml(res, this.deviceXml());
      }
      if (sub === RENDERER_PATHS.avtScpd) {
        return this.sendXml(res, AV_TRANSPORT_SCPD);
      }
      if (sub === RENDERER_PATHS.rcScpd) {
        return this.sendXml(res, RENDERING_CONTROL_SCPD);
      }
      if (sub === RENDERER_PATHS.cmScpd) {
        return this.sendXml(res, CONNECTION_MANAGER_SINK_SCPD);
      }
      return this.notFound(res);
    }
    if (method === "SUBSCRIBE" || method === "UNSUBSCRIBE") {
      return this.handleGena(req, res, sub, method);
    }
    if (method === "POST") {
      if (sub === RENDERER_PATHS.avtControl)
        return this.handleAvtControl(req, res);
      if (sub === RENDERER_PATHS.rcControl)
        return this.handleRcControl(req, res);
      if (sub === RENDERER_PATHS.cmControl)
        return this.handleCmControl(req, res);
      return this.notFound(res);
    }
    return this.notFound(res);
  }
  deviceXml() {
    const base = this.opts.baseUrl();
    const svc = (name) => `${base}/${RENDERER_PATHS[name]}`;
    return buildDeviceDescription({
      deviceType: DEVICE_TYPES.mediaRenderer,
      dlnaDoc: "DMR-1.50",
      identity: {
        udn: this.opts.udn,
        friendlyName: this.opts.friendlyName(),
        ...this.opts.identity
      },
      services: [
        {
          serviceType: AVT_NS,
          serviceId: "urn:upnp-org:serviceId:AVTransport",
          scpdUrl: svc("avtScpd"),
          controlUrl: svc("avtControl"),
          eventSubUrl: svc("avtEvent")
        },
        {
          serviceType: RC_NS,
          serviceId: "urn:upnp-org:serviceId:RenderingControl",
          scpdUrl: svc("rcScpd"),
          controlUrl: svc("rcControl"),
          eventSubUrl: svc("rcEvent")
        },
        {
          serviceType: CM_NS,
          serviceId: "urn:upnp-org:serviceId:ConnectionManager",
          scpdUrl: svc("cmScpd"),
          controlUrl: svc("cmControl"),
          eventSubUrl: `${base}/cm/event`
        }
      ]
    });
  }
  async handleAvtControl(req, res) {
    const action = parseSoapAction(req.headers["soapaction"]);
    const body = await readBody(req);
    try {
      switch (action) {
        case "SetAVTransportURI":
          return this.actSetUri(res, body);
        case "SetNextAVTransportURI":
          return this.actSetNextUri(res, body);
        case "Play":
          return this.actPlay(res);
        case "Pause":
          return this.actPause(res);
        case "Stop":
          return this.actStop(res);
        case "Seek":
          return this.actSeek(res, body);
        case "GetTransportInfo":
          return this.actGetTransportInfo(res);
        case "GetPositionInfo":
          return this.actGetPositionInfo(res);
        case "GetMediaInfo":
          return this.actGetMediaInfo(res);
        case "GetTransportSettings":
          return this.sendSoap(res, AVT_NS, "GetTransportSettings", {
            PlayMode: "NORMAL",
            RecQualityMode: "NOT_IMPLEMENTED"
          });
        case "GetDeviceCapabilities":
          return this.sendSoap(res, AVT_NS, "GetDeviceCapabilities", {
            PlayMedia: "NETWORK,HDD",
            RecMedia: "NOT_IMPLEMENTED",
            RecQualityModes: "NOT_IMPLEMENTED"
          });
        default:
          return this.sendFault(res, "Unsupported action");
      }
    } catch (error) {
      this.log?.warn?.("avt control failed", {
        action,
        message: error instanceof Error ? error.message : String(error)
      });
      return this.sendFault(res, "Action failed");
    }
  }
  actSetUri(res, body) {
    const uri = extractTag(body, "CurrentURI") ?? "";
    const meta = extractTag(body, "CurrentURIMetaData") ?? "";
    this.currentUri = uri;
    this.currentUriMetaData = meta;
    this.durationSec = parseClock(readDidlDuration(meta) ?? "") ?? 0;
    this.pausedElapsedSec = 0;
    this.setState(uri ? "STOPPED" : "NO_MEDIA_PRESENT");
    this.opts.handler.onSetUri?.(uri, meta ? parseDidlObject(meta) : null);
    this.sendSoap(res, AVT_NS, "SetAVTransportURI", {});
  }
  actSetNextUri(res, body) {
    this.nextUri = extractTag(body, "NextURI") ?? "";
    this.nextUriMetaData = extractTag(body, "NextURIMetaData") ?? "";
    this.sendSoap(res, AVT_NS, "SetNextAVTransportURI", {});
  }
  actPlay(res) {
    if (!this.currentUri) {
      return this.sendFault(res, "No media", 701);
    }
    if (this.transportState === "PAUSED_PLAYBACK") {
      this.opts.handler.onResume?.();
      this.startedAtMs = Date.now() - this.pausedElapsedSec * 1000;
      this.setState("PLAYING");
      return this.sendSoap(res, AVT_NS, "Play", {});
    }
    this.startedAtMs = Date.now();
    this.pausedElapsedSec = 0;
    this.opts.handler.onPlay(this.currentUri);
    this.setState("PLAYING");
    this.sendSoap(res, AVT_NS, "Play", {});
  }
  actPause(res) {
    this.opts.handler.onPause?.();
    this.pausedElapsedSec = this.elapsedSec();
    this.setState("PAUSED_PLAYBACK");
    this.sendSoap(res, AVT_NS, "Pause", {});
  }
  actStop(res) {
    this.opts.handler.onStop?.();
    this.pausedElapsedSec = 0;
    this.setState("STOPPED");
    this.sendSoap(res, AVT_NS, "Stop", {});
  }
  actSeek(res, body) {
    const unit = extractTag(body, "Unit") ?? "";
    const target = extractTag(body, "Target") ?? "";
    if (unit === "REL_TIME" || unit === "ABS_TIME") {
      const seconds = parseClock(target);
      if (seconds !== null && this.currentUri) {
        this.opts.handler.onSeek?.(seconds);
        this.opts.handler.onPlay(this.currentUri, seconds);
        this.startedAtMs = Date.now() - seconds * 1000;
        this.pausedElapsedSec = 0;
        this.setState("PLAYING");
      }
    }
    this.sendSoap(res, AVT_NS, "Seek", {});
  }
  actGetTransportInfo(res) {
    this.sendSoap(res, AVT_NS, "GetTransportInfo", {
      CurrentTransportState: this.transportState,
      CurrentTransportStatus: "OK",
      CurrentSpeed: "1"
    });
  }
  actGetPositionInfo(res) {
    const pos = this.opts.handler.getPosition?.();
    const elapsed = pos ? pos.elapsed : this.elapsedSec();
    const duration = pos ? pos.duration : this.durationSec;
    const rel = formatClock(elapsed);
    this.sendSoap(res, AVT_NS, "GetPositionInfo", {
      Track: "1",
      TrackDuration: formatClock(duration),
      TrackMetaData: this.currentUriMetaData,
      TrackURI: this.currentUri,
      RelTime: rel,
      AbsTime: rel,
      RelCount: "2147483647",
      AbsCount: "2147483647"
    });
  }
  actGetMediaInfo(res) {
    this.sendSoap(res, AVT_NS, "GetMediaInfo", {
      NrTracks: this.currentUri ? "1" : "0",
      MediaDuration: formatClock(this.durationSec),
      CurrentURI: this.currentUri,
      CurrentURIMetaData: this.currentUriMetaData,
      NextURI: this.nextUri,
      NextURIMetaData: this.nextUriMetaData,
      PlayMedium: this.currentUri ? "NETWORK" : "NONE",
      RecordMedium: "NOT_IMPLEMENTED",
      WriteStatus: "NOT_IMPLEMENTED"
    });
  }
  async handleRcControl(req, res) {
    const action = parseSoapAction(req.headers["soapaction"]);
    const body = await readBody(req);
    switch (action) {
      case "GetVolume":
        return this.sendSoap(res, RC_NS, "GetVolume", { CurrentVolume: String(this.volume) });
      case "SetVolume": {
        const desired = Number(extractTag(body, "DesiredVolume") ?? "");
        if (Number.isFinite(desired)) {
          this.volume = clampVolume(desired);
          this.opts.handler.onVolume?.(this.volume);
        }
        return this.sendSoap(res, RC_NS, "SetVolume", {});
      }
      case "GetMute":
        return this.sendSoap(res, RC_NS, "GetMute", { CurrentMute: this.muted ? "1" : "0" });
      case "SetMute": {
        const desired = (extractTag(body, "DesiredMute") ?? "").trim();
        this.muted = desired === "1" || desired.toLowerCase() === "true";
        this.opts.handler.onMute?.(this.muted);
        return this.sendSoap(res, RC_NS, "SetMute", {});
      }
      default:
        return this.sendFault(res, "Unsupported action");
    }
  }
  async handleCmControl(req, res) {
    const action = parseSoapAction(req.headers["soapaction"]);
    await readBody(req);
    if (action === "GetProtocolInfo") {
      return this.sendSoap(res, CM_NS, "GetProtocolInfo", {
        Source: "",
        Sink: SINK_PROTOCOL_INFO
      });
    }
    return this.sendFault(res, "Unsupported action");
  }
  async handleGena(req, res, sub, method) {
    const service = sub === RENDERER_PATHS.avtEvent ? "AVTransport" : sub === RENDERER_PATHS.rcEvent ? "RenderingControl" : null;
    if (!service) {
      return this.notFound(res);
    }
    if (method === "UNSUBSCRIBE") {
      const sid2 = String(req.headers["sid"] ?? "");
      this.subscriptions.delete(sid2);
      res.writeHead(200);
      res.end();
      return;
    }
    const existingSid = String(req.headers["sid"] ?? "");
    const timeout = 1800;
    if (existingSid && this.subscriptions.has(existingSid)) {
      const s = this.subscriptions.get(existingSid);
      s.expiresAt = Date.now() + timeout * 1000;
      res.writeHead(200, { SID: existingSid, TIMEOUT: `Second-${timeout}` });
      res.end();
      return;
    }
    const callbackUrl = firstCallback(String(req.headers["callback"] ?? ""));
    const sid = `uuid:${this.opts.udn.slice(5)}-${service}-${this.subscriptions.size + 1}`;
    if (callbackUrl) {
      this.subscriptions.set(sid, {
        sid,
        callbackUrl,
        expiresAt: Date.now() + timeout * 1000,
        seq: 0,
        service
      });
    }
    res.writeHead(200, { SID: sid, TIMEOUT: `Second-${timeout}` });
    res.end();
    if (callbackUrl) {
      this.notifySubscriber(this.subscriptions.get(sid));
    }
  }
  setState(state) {
    if (this.transportState === state) {
      return;
    }
    this.transportState = state;
    for (const s of this.subscriptions.values()) {
      if (s.service === "AVTransport") {
        this.notifySubscriber(s);
      }
    }
  }
  buildAvtLastChange() {
    const inner = `<TransportState val="${escapeXml(this.transportState)}"/>` + `<CurrentTrackURI val="${escapeXml(this.currentUri)}"/>` + `<CurrentTrackDuration val="${escapeXml(formatClock(this.durationSec))}"/>` + `<CurrentTrackMetaData val="${escapeXml(this.currentUriMetaData)}"/>` + `<AVTransportURI val="${escapeXml(this.currentUri)}"/>`;
    return `<Event xmlns="urn:schemas-upnp-org:metadata-1-0/AVT/"><InstanceID val="0">${inner}</InstanceID></Event>`;
  }
  buildRcLastChange() {
    const inner = `<Volume channel="Master" val="${this.volume}"/>` + `<Mute channel="Master" val="${this.muted ? 1 : 0}"/>`;
    return `<Event xmlns="urn:schemas-upnp-org:metadata-1-0/RCS/"><InstanceID val="0">${inner}</InstanceID></Event>`;
  }
  notifySubscriber(sub) {
    const lastChange = sub.service === "AVTransport" ? this.buildAvtLastChange() : this.buildRcLastChange();
    const propertyset = '<?xml version="1.0" encoding="utf-8"?>' + '<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">' + `<e:property><LastChange>${escapeXml(lastChange)}</LastChange></e:property>` + "</e:propertyset>";
    let url;
    try {
      url = new URL(sub.callbackUrl);
    } catch {
      return;
    }
    const seq = sub.seq;
    sub.seq += 1;
    const reqOptions = {
      method: "NOTIFY",
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": 'text/xml; charset="utf-8"',
        NT: "upnp:event",
        NTS: "upnp:propchange",
        SID: sub.sid,
        SEQ: String(seq),
        "Content-Length": Buffer.byteLength(propertyset)
      }
    };
    const clientReq = http.request(reqOptions, (r) => r.resume());
    clientReq.on("error", () => {});
    clientReq.end(propertyset);
  }
  pruneSubscriptions() {
    const now = Date.now();
    for (const [sid, s] of this.subscriptions) {
      if (s.expiresAt <= now) {
        this.subscriptions.delete(sid);
      }
    }
  }
  elapsedSec() {
    if (this.transportState === "PAUSED_PLAYBACK") {
      return this.pausedElapsedSec;
    }
    if (this.transportState !== "PLAYING" || !this.startedAtMs) {
      return 0;
    }
    const e = Math.floor((Date.now() - this.startedAtMs) / 1000);
    return this.durationSec > 0 ? Math.min(e, this.durationSec) : e;
  }
  sendXml(res, xml) {
    res.writeHead(200, { "Content-Type": 'text/xml; charset="utf-8"', "Cache-Control": "no-cache" });
    res.end(xml);
  }
  sendSoap(res, ns, action, args) {
    res.writeHead(200, { "Content-Type": 'text/xml; charset="utf-8"', EXT: "" });
    res.end(buildSoapResponse(ns, action, args));
  }
  sendFault(res, message, code = 401) {
    res.writeHead(500, { "Content-Type": 'text/xml; charset="utf-8"' });
    res.end(buildSoapFault(message, code));
  }
  notFound(res) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not-found");
  }
}
function clampVolume(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}
function firstCallback(header) {
  const m = /<([^>]+)>/.exec(header);
  return m?.[1] ?? header.trim();
}
async function readBody(req) {
  const MAX = 512 * 1024;
  const chunks = [];
  let total = 0;
  return new Promise((resolve) => {
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX)
        return;
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
function parseClock(value) {
  const t = value.trim();
  if (!t)
    return null;
  const parts = t.split(":").map((p) => parseFloat(p));
  if (parts.some((n) => !Number.isFinite(n)))
    return null;
  let sec = 0;
  for (const p of parts)
    sec = sec * 60 + p;
  return Math.round(sec);
}
function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(sec)}`;
}
// node_modules/@sonn-audio/node-upnp/dist/esm/mediaserver/mediaServer.js
var ROOT_OBJECT_ID = "0";
var CDS_NS = SERVICE_TYPES.contentDirectory;
var CMS_NS = SERVICE_TYPES.connectionManager;
var MEDIA_SERVER_PATHS = {
  device: "device.xml",
  cdsScpd: "cds/scpd.xml",
  cmsScpd: "cms/scpd.xml",
  cdsControl: "cds/control",
  cmsControl: "cms/control",
  cdsEvent: "cds/event",
  cmsEvent: "cms/event"
};

class UpnpMediaServer {
  opts;
  log;
  constructor(opts) {
    this.opts = opts;
    this.log = opts.logger;
  }
  get udn() {
    return this.opts.udn;
  }
  deviceTypeAndServices() {
    return { deviceType: DEVICE_TYPES.mediaServer, serviceTypes: [CDS_NS, CMS_NS] };
  }
  async handle(req, res, sub) {
    const method = (req.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      if (sub === MEDIA_SERVER_PATHS.device)
        return this.sendXml(res, this.deviceXml());
      if (sub === MEDIA_SERVER_PATHS.cdsScpd)
        return this.sendXml(res, CONTENT_DIRECTORY_SCPD);
      if (sub === MEDIA_SERVER_PATHS.cmsScpd)
        return this.sendXml(res, CONNECTION_MANAGER_SCPD);
      return this.notFound(res);
    }
    if (method === "SUBSCRIBE" || method === "UNSUBSCRIBE") {
      res.writeHead(200, {
        SID: `uuid:${this.opts.udn.slice(5)}-cds`,
        TIMEOUT: "Second-1800"
      });
      res.end();
      return;
    }
    if (method === "POST") {
      if (sub === MEDIA_SERVER_PATHS.cdsControl)
        return this.handleCdsControl(req, res);
      if (sub === MEDIA_SERVER_PATHS.cmsControl)
        return this.handleCmsControl(req, res);
      return this.notFound(res);
    }
    return this.notFound(res);
  }
  deviceXml() {
    const base = this.opts.baseUrl();
    const p = (name) => `${base}/${MEDIA_SERVER_PATHS[name]}`;
    return buildDeviceDescription({
      deviceType: DEVICE_TYPES.mediaServer,
      dlnaDoc: "DMS-1.50",
      identity: {
        udn: this.opts.udn,
        friendlyName: this.opts.friendlyName(),
        ...this.opts.identity
      },
      services: [
        {
          serviceType: CDS_NS,
          serviceId: "urn:upnp-org:serviceId:ContentDirectory",
          scpdUrl: p("cdsScpd"),
          controlUrl: p("cdsControl"),
          eventSubUrl: p("cdsEvent")
        },
        {
          serviceType: CMS_NS,
          serviceId: "urn:upnp-org:serviceId:ConnectionManager",
          scpdUrl: p("cmsScpd"),
          controlUrl: p("cmsControl"),
          eventSubUrl: p("cmsEvent")
        }
      ]
    });
  }
  async handleCdsControl(req, res) {
    if (req.method !== "POST") {
      return this.methodNotAllowed(res);
    }
    const action = parseSoapAction(req.headers["soapaction"]);
    const body = await readBody2(req);
    if (action === "Browse" || /<[\w:]*Browse[\s>]/.test(body)) {
      const parsed = this.parseBrowse(body);
      if (!parsed) {
        return this.sendSoapRaw(res, buildSoapFault("Invalid Browse request"), 500);
      }
      try {
        const result = await this.browse(parsed);
        return this.sendSoapRaw(res, this.buildDirectoryResponse("Browse", result));
      } catch (error) {
        this.log?.warn?.("browse failed", {
          message: error instanceof Error ? error.message : String(error)
        });
        return this.sendSoapRaw(res, buildSoapFault("Browse failed"), 500);
      }
    }
    if (action === "Search" || /<[\w:]*Search[\s>]/.test(body)) {
      if (!this.opts.provider.search) {
        return this.sendSoapRaw(res, buildSoapFault("Search not supported"), 500);
      }
      const parsed = this.parseSearch(body);
      if (!parsed) {
        return this.sendSoapRaw(res, buildSoapFault("Invalid Search request"), 500);
      }
      try {
        const result = await this.search(parsed);
        return this.sendSoapRaw(res, this.buildDirectoryResponse("Search", result));
      } catch (error) {
        this.log?.warn?.("search failed", {
          message: error instanceof Error ? error.message : String(error)
        });
        return this.sendSoapRaw(res, buildSoapFault("Search failed"), 500);
      }
    }
    if (/GetSystemUpdateID/.test(action) || /GetSystemUpdateID/.test(body)) {
      return this.sendSoap(res, CDS_NS, "GetSystemUpdateID", { Id: "1" });
    }
    if (/GetSearchCapabilities/.test(action) || /GetSearchCapabilities/.test(body)) {
      const caps = this.opts.provider.search ? this.opts.searchCapabilities ?? "" : "";
      return this.sendSoap(res, CDS_NS, "GetSearchCapabilities", { SearchCaps: caps });
    }
    if (/GetSortCapabilities/.test(action) || /GetSortCapabilities/.test(body)) {
      return this.sendSoap(res, CDS_NS, "GetSortCapabilities", { SortCaps: "" });
    }
    return this.sendSoapRaw(res, buildSoapFault("Unsupported action"), 500);
  }
  parseBrowse(body) {
    if (!/<[\w:]*Browse[\s>]/.test(body)) {
      return null;
    }
    const objectId = extractTag(body, "ObjectID") ?? ROOT_OBJECT_ID;
    const flagRaw = extractTag(body, "BrowseFlag") ?? "BrowseDirectChildren";
    const browseFlag = flagRaw === "BrowseMetadata" ? "BrowseMetadata" : "BrowseDirectChildren";
    const startingIndex = toInt(extractTag(body, "StartingIndex"), 0);
    const requestedCount = toInt(extractTag(body, "RequestedCount"), 0);
    return { objectId, browseFlag, startingIndex, requestedCount };
  }
  parseSearch(body) {
    if (!/<[\w:]*Search[\s>]/.test(body)) {
      return null;
    }
    const containerId = extractTag(body, "ContainerID") ?? ROOT_OBJECT_ID;
    const searchCriteria = extractTag(body, "SearchCriteria") ?? "";
    const startingIndex = toInt(extractTag(body, "StartingIndex"), 0);
    const requestedCount = toInt(extractTag(body, "RequestedCount"), 0);
    return { containerId, searchCriteria, startingIndex, requestedCount };
  }
  async search(req) {
    const limit = req.requestedCount > 0 ? req.requestedCount : 200;
    const offset = req.startingIndex > 0 ? req.startingIndex : 0;
    const result = await this.opts.provider.search(req.containerId, req.searchCriteria, offset, limit);
    const elements = result.objects.map((o) => isItem(o) ? buildItemElement(o) : buildContainerElement(o));
    const total = typeof result.total === "number" && result.total > 0 ? result.total : offset + elements.length;
    return { didl: wrapDidl(elements), numberReturned: elements.length, totalMatches: total };
  }
  async browse(req) {
    if (req.browseFlag === "BrowseMetadata") {
      const obj = this.opts.provider.browseMetadata ? await this.opts.provider.browseMetadata(req.objectId) : null;
      if (!obj) {
        return { didl: wrapDidl([]), numberReturned: 0, totalMatches: 0 };
      }
      const el = isItem(obj) ? buildItemElement(obj) : buildContainerElement(obj);
      return { didl: wrapDidl([el]), numberReturned: 1, totalMatches: 1 };
    }
    const limit = req.requestedCount > 0 ? req.requestedCount : 200;
    const offset = req.startingIndex > 0 ? req.startingIndex : 0;
    const result = await this.opts.provider.browse(req.objectId, offset, limit);
    const elements = result.objects.map((o) => isItem(o) ? buildItemElement(o) : buildContainerElement(o));
    const total = typeof result.total === "number" && result.total > 0 ? result.total : offset + elements.length;
    return { didl: wrapDidl(elements), numberReturned: elements.length, totalMatches: total };
  }
  buildDirectoryResponse(action, result, updateId = 0) {
    const escapedDidl = escapeXml(result.didl);
    return '<?xml version="1.0" encoding="utf-8"?>' + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' + 's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' + "<s:Body>" + `<u:${action}Response xmlns:u="${CDS_NS}">` + `<Result>${escapedDidl}</Result>` + `<NumberReturned>${result.numberReturned}</NumberReturned>` + `<TotalMatches>${result.totalMatches}</TotalMatches>` + `<UpdateID>${updateId}</UpdateID>` + `</u:${action}Response>` + "</s:Body></s:Envelope>";
  }
  async handleCmsControl(req, res) {
    const action = parseSoapAction(req.headers["soapaction"]);
    await readBody2(req);
    if (action === "GetProtocolInfo") {
      return this.sendSoap(res, CMS_NS, "GetProtocolInfo", {
        Source: this.opts.sourceProtocolInfo ?? "http-get:*:audio/mpeg:*",
        Sink: ""
      });
    }
    return this.sendSoapRaw(res, buildSoapFault("Unsupported action"), 500);
  }
  sendXml(res, xml) {
    res.writeHead(200, { "Content-Type": 'text/xml; charset="utf-8"', "Cache-Control": "no-cache" });
    res.end(xml);
  }
  sendSoap(res, ns, action, args) {
    this.sendSoapRaw(res, buildSoapResponse(ns, action, args));
  }
  sendSoapRaw(res, xml, status = 200) {
    res.writeHead(status, { "Content-Type": 'text/xml; charset="utf-8"', EXT: "" });
    res.end(xml);
  }
  notFound(res) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not-found");
  }
  methodNotAllowed(res) {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("method-not-allowed");
  }
}
function isItem(o) {
  const cls = (o.upnpClass ?? "").toLowerCase();
  if (cls.startsWith("object.container")) {
    return false;
  }
  if (cls.startsWith("object.item")) {
    return true;
  }
  if (o.childCount !== undefined) {
    return false;
  }
  const item = o;
  return item.resources !== undefined || item.artist !== undefined || item.album !== undefined;
}
function toInt(value, fallback) {
  const n = Number((value ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
async function readBody2(req) {
  const MAX = 256 * 1024;
  const chunks = [];
  let total = 0;
  return new Promise((resolve) => {
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX)
        return;
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
// node_modules/@sonn-audio/node-upnp/dist/esm/controlpoint/controlPoint.js
import { setTimeout as delay2 } from "node:timers/promises";
import { URL as URL3 } from "node:url";

// node_modules/@sonn-audio/node-upnp/dist/esm/controlpoint/discovery.js
import dgram2 from "node:dgram";
import { setTimeout as delay } from "node:timers/promises";
import { URL as URL2 } from "node:url";
var SSDP_ADDRESS2 = "239.255.255.250";
var SSDP_PORT2 = 1900;
var SEARCH_TARGETS = [
  "urn:schemas-upnp-org:device:MediaRenderer:1",
  "urn:schemas-upnp-org:service:AVTransport:1",
  "ssdp:all"
];
var endpointCache = new Map;
function resolveDlnaEndpoints(options = {}) {
  const key = options.host?.toLowerCase() ?? "*";
  const cached = endpointCache.get(key);
  if (cached) {
    return cached;
  }
  const promise = discover(options).finally(() => {
    endpointCache.delete(key);
  });
  endpointCache.set(key, promise);
  return promise;
}
var RECENT_DEVICE_TTL_MS = 90000;
var recentDevices = new Map;
function pruneRecentDevices(now) {
  for (const [id, entry] of recentDevices) {
    if (now - entry.lastSeen > RECENT_DEVICE_TTL_MS) {
      recentDevices.delete(id);
    }
  }
}
async function discoverDlnaDevices(options = {}) {
  const log = options.logger;
  const responses = await searchSsdp(options);
  const hostFilter = options.host?.toLowerCase();
  const devices = [];
  const seen = new Set;
  for (const { location, responder, usn, st } of responses) {
    const stLower = (st ?? "").toLowerCase();
    if (stLower && !stLower.includes("mediarenderer") && !stLower.includes("avtransport") && !stLower.startsWith("uuid:")) {
      continue;
    }
    try {
      const description = await fetchWithTimeout(location, options.timeoutMs ?? 1500);
      const parsed = parseDeviceDescription(description, location);
      if (hostFilter && !matchesHost(hostFilter, location, responder, parsed.friendlyName)) {
        continue;
      }
      const id = (usn?.split("::")[0] ?? "").trim() || `${responder}|${location}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const host = normalizeHost(responder) || normalizeHost(new URL2(location).hostname) || normalizeHost(parsed.friendlyName ?? "") || responder;
      devices.push({
        id,
        name: parsed.friendlyName?.trim(),
        host,
        address: responder,
        location,
        controlUrl: parsed.controlUrl,
        renderingControlUrl: parsed.renderingControlUrl
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log?.debug?.("failed to parse device description", { location, message });
      if (hostFilter && !matchesHost(hostFilter, location, responder)) {
        continue;
      }
      const id = (usn?.split("::")[0] ?? "").trim() || `${responder}|${location}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      devices.push({
        id,
        host: responder,
        address: responder,
        location
      });
    }
  }
  if (hostFilter) {
    return devices;
  }
  const now = Date.now();
  pruneRecentDevices(now);
  for (const device of devices) {
    recentDevices.set(device.id, { device, lastSeen: now });
  }
  for (const [id, entry] of recentDevices) {
    if (!seen.has(id)) {
      seen.add(id);
      devices.push(entry.device);
    }
  }
  return devices;
}
async function discover(options) {
  const log = options.logger;
  const responses = await searchSsdp(options);
  const hostFilter = options.host?.toLowerCase();
  for (const { location, responder } of responses) {
    try {
      const description = await fetchWithTimeout(location, options.timeoutMs ?? 1500);
      const parsed = parseDeviceDescription(description, location);
      if (!parsed.controlUrl) {
        continue;
      }
      if (hostFilter && !matchesHost(hostFilter, location, responder, parsed.friendlyName)) {
        continue;
      }
      if (parsed.controlUrl) {
        log?.debug?.("dlna endpoints discovered", { info: parsed });
        return { ...parsed, descriptionUrl: location };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log?.debug?.("failed to parse device description", { location, message });
    }
  }
  return null;
}
async function searchSsdp(options) {
  const log = options.logger;
  const socket = dgram2.createSocket({ type: "udp4", reuseAddr: true });
  const mx = Math.max(1, Math.min(5, options.mx ?? 2));
  const totalWindowMs = Math.max(options.timeoutMs ?? 4000, mx * 1000 + 500);
  const responses = [];
  const seen = new Set;
  socket.on("message", (msg, rinfo) => {
    try {
      const headers = parseSsdpResponse(msg.toString());
      const location = headers.location;
      if (!location) {
        return;
      }
      const key = `${rinfo.address}|${location}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      responses.push({
        location,
        responder: rinfo.address,
        usn: headers.usn,
        st: headers.st ?? headers.nt
      });
    } catch (error) {
      log?.debug?.("error parsing ssdp response", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(() => resolve());
  });
  const requests = SEARCH_TARGETS.map((target) => buildSearchRequest(mx, target));
  const hostFilter = options.host?.trim();
  const sendBurst = () => {
    for (const request of requests) {
      socket.send(request, 0, request.length, SSDP_PORT2, SSDP_ADDRESS2);
      if (hostFilter) {
        socket.send(request, 0, request.length, SSDP_PORT2, hostFilter);
      }
    }
  };
  const burstIntervalMs = 1000;
  let elapsed = 0;
  sendBurst();
  while (elapsed + burstIntervalMs < totalWindowMs) {
    await delay(burstIntervalMs);
    elapsed += burstIntervalMs;
    sendBurst();
  }
  await delay(Math.max(0, totalWindowMs - elapsed));
  socket.close();
  return responses;
}
function matchesHost(filter, location, responder, friendlyName) {
  const normalizedFilter = normalizeHost(filter);
  const locationHost = normalizeHost(new URL2(location).hostname);
  const responderHost = normalizeHost(responder);
  if (normalizedFilter && (normalizedFilter === locationHost || normalizedFilter === responderHost)) {
    return true;
  }
  if (friendlyName) {
    const friendly = normalizeHost(friendlyName);
    if (friendly === normalizedFilter || friendly.replace(/\s+/g, "") === normalizedFilter || normalizedFilter.replace(/\s+/g, "") === friendly) {
      return true;
    }
  }
  return false;
}
function normalizeHost(value) {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
}
function buildSearchRequest(mx, target) {
  const payload = [
    "M-SEARCH * HTTP/1.1",
    `HOST: ${SSDP_ADDRESS2}:${SSDP_PORT2}`,
    'MAN: "ssdp:discover"',
    `MX: ${mx}`,
    `ST: ${target}`,
    "",
    ""
  ].join(`\r
`);
  return Buffer.from(payload, "utf-8");
}
function parseSsdpResponse(raw) {
  const lines = raw.split(/\r?\n/);
  const headers = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = value;
  }
  return headers;
}
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController;
  const timeout = setTimeout(() => controller.abort(), timeoutMs).unref();
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
function parseDeviceDescription(xml, location) {
  const services = extractServices(xml);
  const urlBase = extractTag2(xml, "URLBase");
  let base;
  try {
    base = urlBase ? new URL2(urlBase, location) : new URL2(location);
  } catch {
    base = new URL2(location);
  }
  const getUrl = (value) => {
    if (!value) {
      return;
    }
    try {
      return new URL2(value, base).toString();
    } catch {
      return;
    }
  };
  const avTransport = selectService(services, "avtransport");
  const rendering = selectService(services, "renderingcontrol");
  const connectionManager = selectService(services, "connectionmanager");
  return {
    friendlyName: extractTag2(xml, "friendlyName"),
    controlUrl: getUrl(avTransport?.controlUrl),
    renderingControlUrl: getUrl(rendering?.controlUrl),
    avTransportEventUrl: getUrl(avTransport?.eventSubUrl),
    renderingControlEventUrl: getUrl(rendering?.eventSubUrl),
    connectionManagerUrl: getUrl(connectionManager?.controlUrl)
  };
}
function extractServices(xml) {
  const map = [];
  const serviceRegex = /<(?:\w+:)?service>([\s\S]*?)<\/(?:\w+:)?service>/gi;
  let match;
  while ((match = serviceRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";
    const type = extractTag2(block, "serviceType");
    const control = extractTag2(block, "controlURL");
    const eventSub = extractTag2(block, "eventSubURL");
    if (type && control) {
      map.push({
        type: type.trim(),
        controlUrl: control.trim(),
        eventSubUrl: eventSub?.trim() || undefined
      });
    }
  }
  return map;
}
function selectService(services, keyword) {
  const target = keyword.toLowerCase();
  return services.find(({ type }) => type.toLowerCase().includes(target));
}
function extractTag2(block, tag) {
  const regex = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  const match = block.match(regex);
  return match?.[1]?.trim();
}

// node_modules/@sonn-audio/node-upnp/dist/esm/gena/eventSubscriber.js
import http2 from "node:http";
var SUBSCRIBE_TIMEOUT_SEC = 300;
var REQUEST_TIMEOUT_MS = 4000;

class DlnaEventSubscriber {
  zoneId;
  localHost;
  handlers;
  server;
  callbackBaseUrl;
  subscriptions = new Map;
  sidToKind = new Map;
  disposed = false;
  log;
  constructor(zoneId, localHost, handlers, options = {}) {
    this.zoneId = zoneId;
    this.localHost = localHost;
    this.handlers = handlers;
    this.log = options.logger;
  }
  async start(urls) {
    if (this.disposed) {
      return;
    }
    await this.ensureServer();
    if (!this.callbackBaseUrl) {
      return;
    }
    const targets = [
      { kind: "avtransport", url: urls.avTransportEventUrl },
      { kind: "renderingcontrol", url: urls.renderingControlEventUrl },
      ...(urls.extraServices ?? []).map((s) => ({ kind: s.kind, url: s.eventUrl }))
    ];
    for (const { kind, url } of targets) {
      if (!url) {
        continue;
      }
      const existing = this.subscriptions.get(kind);
      if (existing && existing.eventUrl === url) {
        continue;
      }
      if (existing?.renewTimer) {
        clearTimeout(existing.renewTimer);
      }
      const sub = {
        kind,
        eventUrl: url,
        timeoutSec: SUBSCRIBE_TIMEOUT_SEC,
        active: false,
        failures: 0
      };
      this.subscriptions.set(kind, sub);
      await this.subscribe(sub);
    }
  }
  dispose() {
    this.disposed = true;
    for (const sub of this.subscriptions.values()) {
      if (sub.renewTimer) {
        clearTimeout(sub.renewTimer);
      }
      this.unsubscribe(sub);
    }
    this.subscriptions.clear();
    this.sidToKind.clear();
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }
  async ensureServer() {
    if (this.server) {
      return;
    }
    const server = http2.createServer((req, res) => this.handleNotify(req, res));
    server.on("error", (err) => {
      this.log?.warn?.("DLNA event callback server error", {
        zoneId: this.zoneId,
        message: err instanceof Error ? err.message : String(err)
      });
    });
    await new Promise((resolve) => {
      server.listen(0, "0.0.0.0", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address.port !== "number") {
      server.close();
      this.log?.warn?.("DLNA event callback server failed to bind", { zoneId: this.zoneId });
      return;
    }
    this.server = server;
    this.callbackBaseUrl = `http://${this.localHost}:${address.port}`;
    this.log?.debug?.("DLNA event callback server listening", {
      zoneId: this.zoneId,
      callback: this.callbackBaseUrl
    });
  }
  handleNotify(req, res) {
    if ((req.method ?? "").toUpperCase() !== "NOTIFY") {
      res.writeHead(405);
      res.end();
      return;
    }
    const sid = req.headers.sid?.trim();
    const chunks = [];
    req.on("data", (c) => {
      if (chunks.reduce((n, b) => n + b.length, 0) < 256 * 1024) {
        chunks.push(c);
      }
    });
    req.on("end", () => {
      res.writeHead(200);
      res.end();
      const body = Buffer.concat(chunks).toString("utf8");
      const kind = sid ? this.sidToKind.get(sid) : undefined;
      this.log?.debug?.("DLNA NOTIFY received", {
        zoneId: this.zoneId,
        sid,
        kind: kind ?? "(unmapped)",
        bytes: body.length
      });
      try {
        this.dispatchNotify(kind, body);
      } catch (err) {
        this.log?.debug?.("DLNA NOTIFY parse failed", {
          zoneId: this.zoneId,
          message: err instanceof Error ? err.message : String(err)
        });
      }
    });
    req.on("error", () => {
      if (!res.writableEnded) {
        res.writeHead(200);
        res.end();
      }
    });
  }
  dispatchNotify(kind, body) {
    const lastChange = extractLastChange(body) ?? undefined;
    const resolvedKind = kind ?? (lastChange ? /TransportState|CurrentTrackURI/i.test(lastChange) ? "avtransport" : "renderingcontrol" : undefined);
    this.handlers.onRaw?.({ kind: resolvedKind, body, lastChange });
    if (!lastChange) {
      return;
    }
    if (resolvedKind === "avtransport") {
      const event = parseTransportLastChange(lastChange);
      if (event && (event.transportState || event.currentTrackUri || event.durationSeconds != null)) {
        this.handlers.onTransport?.(event);
      }
    } else if (resolvedKind === "renderingcontrol") {
      const event = parseRenderingLastChange(lastChange);
      if (event && (event.volume != null || event.muted != null)) {
        this.handlers.onRendering?.(event);
      }
    }
  }
  async subscribe(sub) {
    if (this.disposed || !this.callbackBaseUrl) {
      return;
    }
    try {
      const { sid, timeoutSec } = await this.sendSubscribe(sub.eventUrl, sub.sid);
      if (sub.sid && sub.sid !== sid) {
        this.sidToKind.delete(sub.sid);
      }
      sub.sid = sid;
      sub.timeoutSec = timeoutSec;
      sub.active = true;
      sub.failures = 0;
      if (sid) {
        this.sidToKind.set(sid, sub.kind);
      }
      this.scheduleRenew(sub);
      this.log?.debug?.("DLNA subscribed", { zoneId: this.zoneId, kind: sub.kind, sid, timeoutSec });
    } catch (err) {
      sub.active = false;
      sub.failures += 1;
      if (sub.sid) {
        this.sidToKind.delete(sub.sid);
        sub.sid = undefined;
      }
      const backoffMs = Math.min(30000, 2000 * sub.failures);
      this.log?.debug?.("DLNA subscribe failed; will retry", {
        zoneId: this.zoneId,
        kind: sub.kind,
        failures: sub.failures,
        backoffMs,
        message: err instanceof Error ? err.message : String(err)
      });
      if (sub.renewTimer) {
        clearTimeout(sub.renewTimer);
      }
      sub.renewTimer = setTimeout(() => {
        this.subscribe(sub);
      }, backoffMs);
      sub.renewTimer.unref?.();
    }
  }
  scheduleRenew(sub) {
    if (sub.renewTimer) {
      clearTimeout(sub.renewTimer);
    }
    const renewMs = Math.max(30000, sub.timeoutSec * 1000 / 2);
    sub.renewTimer = setTimeout(() => {
      const staleSid = sub.sid;
      if (staleSid) {
        this.sidToKind.delete(staleSid);
        sub.sid = undefined;
        this.sendGenaRequest("UNSUBSCRIBE", sub.eventUrl, { SID: staleSid }).catch(() => {});
      }
      this.subscribe(sub);
    }, renewMs);
    sub.renewTimer.unref?.();
  }
  sendSubscribe(eventUrl, existingSid) {
    const callback = `<${this.callbackBaseUrl}/notify>`;
    const headers = existingSid ? { SID: existingSid, TIMEOUT: `Second-${SUBSCRIBE_TIMEOUT_SEC}` } : { CALLBACK: callback, NT: "upnp:event", TIMEOUT: `Second-${SUBSCRIBE_TIMEOUT_SEC}` };
    return this.sendGenaRequest("SUBSCRIBE", eventUrl, headers).then((res) => {
      const sid = res.headers["sid"]?.trim() || existingSid;
      const timeoutSec = parseTimeoutHeader(res.headers["timeout"]);
      return { sid, timeoutSec };
    });
  }
  async unsubscribe(sub) {
    if (!sub.sid) {
      return;
    }
    try {
      await this.sendGenaRequest("UNSUBSCRIBE", sub.eventUrl, { SID: sub.sid });
    } catch {}
  }
  sendGenaRequest(method, eventUrl, headers) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(eventUrl);
      } catch {
        reject(new Error("invalid event url"));
        return;
      }
      const req = http2.request({
        method,
        hostname: url.hostname,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      }, (res) => {
        res.resume();
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
          resolve({ statusCode: res.statusCode ?? 200, headers: res.headers });
        } else {
          reject(new Error(`GENA ${method} HTTP ${res.statusCode}`));
        }
      });
      req.on("timeout", () => req.destroy(new Error("GENA request timeout")));
      req.on("error", reject);
      req.end();
    });
  }
}
function parseTimeoutHeader(value) {
  if (!value) {
    return SUBSCRIBE_TIMEOUT_SEC;
  }
  const match = /Second-(\d+)/i.exec(value);
  if (match?.[1]) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return SUBSCRIBE_TIMEOUT_SEC;
}
function extractLastChange(body) {
  const match = /<LastChange>([\s\S]*?)<\/LastChange>/i.exec(body);
  if (!match?.[1]) {
    return null;
  }
  return unescapeXml2(match[1].trim());
}
function parseTransportLastChange(xml) {
  const transportState = attrVal(xml, "TransportState");
  const currentTrackUri = attrVal(xml, "CurrentTrackURI");
  const durationStr = attrVal(xml, "CurrentTrackDuration");
  const durationSeconds = durationStr ? parseUpnpDuration(durationStr) : undefined;
  return {
    transportState: transportState || undefined,
    currentTrackUri: currentTrackUri || undefined,
    durationSeconds: durationSeconds != null && durationSeconds > 0 ? durationSeconds : undefined
  };
}
function parseRenderingLastChange(xml) {
  const volume = channelAttrVal(xml, "Volume");
  const mute = channelAttrVal(xml, "Mute");
  const event = {};
  if (volume != null) {
    const n = Number(volume);
    if (Number.isFinite(n)) {
      event.volume = Math.min(100, Math.max(0, Math.round(n)));
    }
  }
  if (mute != null) {
    event.muted = mute === "1" || mute.toLowerCase() === "true";
  }
  return event;
}
function attrVal(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*\\bval="([^"]*)"`, "i");
  return re.exec(xml)?.[1];
}
function channelAttrVal(xml, tag) {
  const master = new RegExp(`<${tag}\\b[^>]*channel="Master"[^>]*\\bval="([^"]*)"|<${tag}\\b[^>]*\\bval="([^"]*)"[^>]*channel="Master"`, "i").exec(xml);
  if (master) {
    return master[1] ?? master[2];
  }
  const any = new RegExp(`<${tag}\\b[^>]*\\bval="([^"]*)"`, "i").exec(xml);
  return any?.[1];
}
function parseUpnpDuration(value) {
  const m = /(\d+):(\d{1,2}):(\d{1,2})/.exec(value.trim());
  if (!m) {
    return;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (![h, min, sec].every(Number.isFinite)) {
    return;
  }
  return h * 3600 + min * 60 + sec;
}
function unescapeXml2(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

// node_modules/@sonn-audio/node-upnp/dist/esm/controlpoint/controlPoint.js
class DlnaControlPoint {
  log;
  controllers = new Set;
  commandTimeoutMs;
  host;
  controlUrl;
  renderingControlUrl;
  connectionManagerUrl;
  sinkContentTypes;
  discoveryPromise;
  autoDiscover;
  deviceName;
  commandChain = Promise.resolve();
  eventSubscriber;
  eventHandlers;
  eventCallbackHost = "127.0.0.1";
  avTransportEventUrl;
  renderingControlEventUrl;
  eventDiscoveryStarted = false;
  constructor(opts = {}) {
    this.log = opts.logger;
    this.commandTimeoutMs = opts.commandTimeoutMs ?? 2500;
    this.host = typeof opts.host === "string" ? opts.host.trim() : "";
    this.autoDiscover = opts.autoDiscover ?? true;
    this.deviceName = typeof opts.deviceName === "string" && opts.deviceName.trim().length > 0 ? opts.deviceName.trim() : "";
    if (typeof opts.controlUrl === "string" && opts.controlUrl.trim().length > 0) {
      this.controlUrl = opts.controlUrl.trim();
      this.renderingControlUrl = typeof opts.renderingControlUrl === "string" && opts.renderingControlUrl.trim().length > 0 ? opts.renderingControlUrl.trim() : this.deriveRenderingUrl(this.controlUrl);
      this.log?.info?.("DLNA control point configured with manual control URL", {
        controlUrl: this.controlUrl
      });
    } else if (typeof opts.renderingControlUrl === "string" && opts.renderingControlUrl.trim()) {
      this.renderingControlUrl = opts.renderingControlUrl.trim();
    }
  }
  async ensureEndpoints() {
    if (this.controlUrl) {
      if (this.host && this.eventHandlers && !this.avTransportEventUrl && !this.renderingControlEventUrl && !this.eventDiscoveryStarted) {
        this.eventDiscoveryStarted = true;
        this.resolveEventEndpoints();
      }
      return true;
    }
    if (this.discoveryPromise) {
      return this.discoveryPromise;
    }
    if (!this.host && !this.autoDiscover) {
      this.log?.warn?.("DLNA command skipped; no host or control URL configured");
      return false;
    }
    this.discoveryPromise = this.resolveEndpoints().finally(() => {
      this.discoveryPromise = undefined;
    });
    return this.discoveryPromise;
  }
  async setUri(uri, didlMetadata) {
    if (!await this.ensureEndpoints()) {
      return false;
    }
    return this.enqueueResult(() => this.sendPlaybackWithSoap(uri, didlMetadata));
  }
  async updateMetadata(uri, didlMetadata) {
    if (!this.controlUrl) {
      return false;
    }
    return this.enqueueResult(() => this.invokeActionWithRetry("SetAVTransportURI", this.buildSetUriBody(uri, didlMetadata), 1, {
      timeoutMs: 1500,
      timeoutOk: true
    }));
  }
  async play() {
    if (!await this.ensureEndpoints()) {
      return false;
    }
    return this.enqueueResult(() => this.invokeAction("Play", this.buildPlayBody()));
  }
  async pause() {
    if (!await this.ensureEndpoints()) {
      return false;
    }
    return this.enqueueResult(() => this.invokeAction("Pause", this.buildPauseBody()));
  }
  async stop() {
    if (!await this.ensureEndpoints()) {
      return false;
    }
    return this.enqueueResult(() => this.invokeAction("Stop", this.buildStopBody()));
  }
  async getSinkContentTypes() {
    if (this.sinkContentTypes !== undefined) {
      return this.sinkContentTypes;
    }
    if (!await this.ensureEndpoints() || !this.connectionManagerUrl) {
      this.log?.debug?.("no ConnectionManager endpoint; sink formats unknown", { host: this.host });
      return null;
    }
    const body = '<?xml version="1.0" encoding="utf-8"?>' + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"' + ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' + '<s:Body><u:GetProtocolInfo xmlns:u="urn:schemas-upnp-org:service:ConnectionManager:1"/></s:Body>' + "</s:Envelope>";
    const controller = new AbortController;
    this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), this.commandTimeoutMs);
    timeout.unref();
    try {
      const response = await fetch(this.connectionManagerUrl, {
        method: "POST",
        headers: {
          "Content-Type": 'text/xml; charset="utf-8"',
          SOAPAction: '"urn:schemas-upnp-org:service:ConnectionManager:1#GetProtocolInfo"'
        },
        body,
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        this.log?.debug?.("GetProtocolInfo failed", { host: this.host, status: response.status });
        return null;
      }
      const types = parseSinkContentTypes(text);
      this.sinkContentTypes = types;
      this.log?.info?.("renderer sink formats", { host: this.host, count: types?.length ?? 0, types });
      return types;
    } catch (err) {
      this.log?.debug?.("GetProtocolInfo error", {
        host: this.host,
        message: err instanceof Error ? err.message : String(err)
      });
      return null;
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
    }
  }
  async setVolume(percent) {
    if (!await this.ensureEndpoints()) {
      return false;
    }
    const url = this.renderingControlUrl;
    if (!url) {
      this.log?.debug?.("rendering control URL missing; skipping volume update");
      return false;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const ok = await this.invokeRenderingAction("SetVolume", this.buildSetVolumeBody(clamped), {
      optional: true
    });
    if (ok) {
      this.log?.info?.("DLNA volume set", { volume: clamped });
    }
    return ok;
  }
  async subscribeEvents(handlers, localHost = "127.0.0.1") {
    this.eventHandlers = handlers;
    this.eventCallbackHost = localHost;
    await this.ensureEndpoints();
    if (!this.avTransportEventUrl && !this.renderingControlEventUrl) {
      if (!this.host) {
        this.log?.debug?.("no event endpoints and no host; GENA subscription unavailable");
      }
      return;
    }
    this.ensureEventSubscription();
  }
  dispose() {
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
    this.eventSubscriber?.dispose();
    this.eventSubscriber = undefined;
    this.log?.debug?.("DLNA control point disposed");
  }
  async resolveEndpoints() {
    if (!this.host && this.autoDiscover) {
      const resolvedHost = await this.autoResolveHost();
      if (!resolvedHost) {
        return false;
      }
      this.host = resolvedHost;
    }
    const info = await resolveDlnaEndpoints({ host: this.host, logger: this.log });
    if (info) {
      this.applyDiscoveredEndpoints(info);
      return Boolean(this.controlUrl);
    }
    this.log?.warn?.("no DLNA endpoints discovered", { host: this.host });
    return false;
  }
  async resolveEventEndpoints() {
    try {
      const info = await resolveDlnaEndpoints({ host: this.host, logger: this.log });
      if (info?.avTransportEventUrl || info?.renderingControlEventUrl) {
        if (info.avTransportEventUrl) {
          this.avTransportEventUrl = info.avTransportEventUrl;
        }
        if (info.renderingControlEventUrl) {
          this.renderingControlEventUrl = info.renderingControlEventUrl;
        }
        this.ensureEventSubscription();
      }
    } catch (err) {
      this.log?.debug?.("DLNA event endpoint resolve failed", {
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
  async autoResolveHost() {
    const devices = await discoverDlnaDevices({ logger: this.log });
    if (!devices.length) {
      this.log?.warn?.("DLNA auto-discovery found no renderers", { deviceName: this.deviceName });
      return "";
    }
    const preferred = this.deviceName.toLowerCase();
    const match = (preferred ? devices.find((device) => (device.name ?? "").toLowerCase() === preferred) : undefined) ?? devices[0];
    if (!match?.host) {
      return "";
    }
    this.log?.info?.("DLNA renderer auto-discovered", {
      host: match.host,
      name: match.name,
      matchedByName: (match.name ?? "").toLowerCase() === preferred
    });
    return match.host;
  }
  async sendPlaybackWithSoap(uri, didl) {
    this.log?.info?.("sending playback command", { uri });
    await this.invokeAction("Stop", this.buildStopBody(), { optional: true });
    let timedOut = false;
    const didSetUri = await this.invokeActionWithRetry("SetAVTransportURI", this.buildSetUriBody(uri, didl), 1, {
      timeoutMs: 1500,
      timeoutOk: true,
      onTimeout: () => {
        timedOut = true;
      }
    });
    if (!didSetUri && !timedOut) {
      this.log?.warn?.("DLNA SetAVTransportURI faulted; proceeding to Play anyway");
    }
    await delay2(200);
    const playAttempts = 6;
    const playDelay = timedOut ? 600 : 300;
    if (!await this.invokeActionWithRetry("Play", this.buildPlayBody(), playAttempts, {
      retryDelayMs: playDelay,
      retryFaultCodes: ["701"]
    })) {
      this.log?.warn?.("DLNA Play did not succeed after retries", { uri });
      return false;
    }
    this.log?.info?.("DLNA playback started", { uri });
    return true;
  }
  enqueueResult(task) {
    const run = this.commandChain.then(task, task);
    this.commandChain = run.then(() => {
      return;
    }, () => {
      return;
    });
    return run;
  }
  async invokeActionWithRetry(action, body, attempts, options = {}) {
    for (let attempt = 1;attempt <= attempts; attempt += 1) {
      const success = await this.invokeAction(action, body, options);
      if (success) {
        return true;
      }
      if (attempt < attempts) {
        await delay2(options.retryDelayMs ?? 150);
      }
    }
    return false;
  }
  async invokeAction(action, body, options = {}) {
    if (!this.controlUrl) {
      this.log?.warn?.("AVTransport command skipped; endpoint unknown", { action });
      return false;
    }
    return this.invokeServiceAction(this.controlUrl, "AVTransport", action, body, options);
  }
  async invokeRenderingAction(action, body, options = {}) {
    if (!this.renderingControlUrl) {
      this.log?.debug?.("RenderingControl command skipped; endpoint unknown", { action });
      return false;
    }
    return this.invokeServiceAction(this.renderingControlUrl, "RenderingControl", action, body, options);
  }
  async invokeServiceAction(url, service, action, body, options = {}) {
    const controller = new AbortController;
    this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.commandTimeoutMs);
    timeout.unref();
    try {
      this.log?.debug?.("DLNA soap request", { action, service });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": 'text/xml; charset="utf-8"',
          SOAPAction: `"urn:schemas-upnp-org:service:${service}:1#${action}"`
        },
        body,
        signal: controller.signal
      });
      let text = "";
      try {
        text = await response.text();
      } catch (err) {
        this.log?.debug?.("dlna control response read failed", {
          status: response.status,
          message: err instanceof Error ? err.message : String(err)
        });
      }
      if (!response.ok && response.status !== 500) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
      if (response.ok) {
        this.log?.info?.("DLNA action succeeded", { action, service });
        return true;
      }
      const fault = text.slice(0, 2000);
      const errorCode = extractFaultCode(fault);
      if (errorCode && options.retryFaultCodes?.includes(errorCode)) {
        this.log?.debug?.("DLNA action returned retryable SOAP fault", {
          action,
          service,
          errorCode
        });
        return false;
      }
      this.log?.warn?.("DLNA action returned SOAP fault", {
        action,
        status: response.status,
        service,
        body: fault
      });
      if (options.softFaultOk) {
        return true;
      }
      return options.optional ?? false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (isAbort && options.timeoutOk) {
        this.log?.debug?.("DLNA request timed out; continuing", { action, service });
        options.onTimeout?.();
        return false;
      }
      if (options.optional) {
        this.log?.debug?.("optional command failed", { action, service, message });
      } else {
        this.log?.warn?.("command failed", { action, service, message });
      }
      return options.optional ?? false;
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
    }
  }
  buildSetUriBody(uri, didl) {
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${escapeXml(uri)}</CurrentURI>
      <CurrentURIMetaData>${escapeXml(didl)}</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;
  }
  buildPlayBody() {
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>`;
  }
  buildPauseBody() {
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Pause>
  </s:Body>
</s:Envelope>`;
  }
  buildStopBody() {
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Stop>
  </s:Body>
</s:Envelope>`;
  }
  buildSetVolumeBody(volume) {
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
      <DesiredVolume>${volume}</DesiredVolume>
    </u:SetVolume>
  </s:Body>
</s:Envelope>`;
  }
  deriveRenderingUrl(avTransportUrl) {
    try {
      const parsed = new URL3(avTransportUrl);
      if (parsed.pathname.toLowerCase().includes("avtransport")) {
        parsed.pathname = parsed.pathname.replace(/AVTransport/gi, "RenderingControl");
      } else {
        parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/RenderingControl/Control`;
      }
      return parsed.toString();
    } catch {
      return;
    }
  }
  applyDiscoveredEndpoints(info) {
    if (info.controlUrl) {
      this.controlUrl = info.controlUrl;
    }
    if (info.renderingControlUrl) {
      this.renderingControlUrl = info.renderingControlUrl;
    } else if (this.controlUrl && !this.renderingControlUrl) {
      this.renderingControlUrl = this.deriveRenderingUrl(this.controlUrl);
    }
    if (info.avTransportEventUrl) {
      this.avTransportEventUrl = info.avTransportEventUrl;
    }
    if (info.renderingControlEventUrl) {
      this.renderingControlEventUrl = info.renderingControlEventUrl;
    }
    if (info.connectionManagerUrl) {
      this.connectionManagerUrl = info.connectionManagerUrl;
    }
    this.log?.info?.("DLNA discovery completed", {
      host: this.host,
      controlUrl: this.controlUrl
    });
    this.ensureEventSubscription();
  }
  ensureEventSubscription() {
    if (!this.eventHandlers) {
      return;
    }
    if (!this.avTransportEventUrl && !this.renderingControlEventUrl) {
      return;
    }
    if (!this.eventSubscriber) {
      this.eventSubscriber = new DlnaEventSubscriber(0, this.eventCallbackHost, this.eventHandlers, {
        logger: this.log
      });
    }
    this.eventSubscriber.start({
      avTransportEventUrl: this.avTransportEventUrl,
      renderingControlEventUrl: this.renderingControlEventUrl
    });
  }
}
function parseSinkContentTypes(soapResponse) {
  const sink = /<Sink>([\s\S]*?)<\/Sink>/i.exec(soapResponse)?.[1];
  if (!sink) {
    return null;
  }
  const decoded = sink.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const types = new Set;
  for (const entry of decoded.split(",")) {
    const fields = entry.trim().split(":");
    const mime = fields[2]?.trim().toLowerCase();
    if (mime && mime.includes("/")) {
      types.add(mime);
    }
  }
  return types.size ? [...types] : null;
}
// mediaserver/index.ts
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
var configPath = path.join(os.homedir(), "Documents", "MediaPlay", "library.json");
var host = process.env.MEDIAPLAY_SERVER_HOST ?? "0.0.0.0";
var advertisedHost = process.env.MEDIAPLAY_SERVER_ADVERTISE_HOST ?? getLanAddress();
var port = Number(process.env.MEDIAPLAY_SERVER_PORT ?? 7799);
var baseUrl = `http://${advertisedHost}:${port}/dms`;
function getLanAddress() {
  const addresses = Object.values(os.networkInterfaces()).flatMap((items) => items ?? []);
  return addresses.find((address) => address.family === "IPv4" && !address.internal)?.address ?? "127.0.0.1";
}
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}
function loadLibrary(type) {
  const library = readConfig().libraries?.find((item) => item.type === type);
  if (!library?.path)
    return [];
  try {
    const dbPath = path.join(library.path, "MediaPlayDb", "db.json");
    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return Object.entries(db.metadataStore ?? {}).map(([relativePath, tags]) => ({
      libraryPath: path.resolve(library.path),
      relativePath,
      tags
    }));
  } catch {
    return [];
  }
}
function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".wav": "audio/wav",
    ".wma": "audio/x-ms-wma",
    ".mp4": "video/mp4",
    ".m4v": "video/x-m4v",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv"
  };
  return types[extension] ?? "application/octet-stream";
}
var provider = {
  async browse(objectId, offset, limit) {
    if (objectId === ROOT_OBJECT_ID) {
      const configured = readConfig().libraries ?? [];
      const objects = ["music", "videos"].filter((type) => configured.some((item) => item.type === type)).map((type) => ({
        id: type,
        title: type === "music" ? "Music" : "Video",
        upnpClass: "object.container.storageFolder",
        parentId: ROOT_OBJECT_ID
      }));
      return { objects, total: objects.length };
    }
    if (objectId !== "music" && objectId !== "videos")
      return { objects: [], total: 0 };
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
          upnpClass: objectId === "music" ? "object.item.audioItem.musicTrack" : "object.item.videoItem",
          resources: [{
            url: `${baseUrl}/media/${objectId}/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
            protocolInfo: `http-get:*:${mimeType(filePath)}:*`
          }]
        };
      }),
      total: tracks.length
    };
  }
};
var server = new UpnpMediaServer({
  udn: "uuid:mediaplay-server-0000-000000000001",
  friendlyName: () => os.hostname() + " (MediaPlay)",
  baseUrl: () => baseUrl,
  provider
});
function streamMedia(req, res, pathname) {
  const match = pathname.match(/^\/media\/(music|videos)\/(.+)$/);
  if (!match) {
    res.writeHead(404).end("Not found");
    return;
  }
  let relativePath;
  try {
    relativePath = match[2].split("/").map(decodeURIComponent).join("/");
  } catch {
    res.writeHead(400).end("Bad path");
    return;
  }
  const track = loadLibrary(match[1]).find((item) => item.relativePath === relativePath);
  if (!track) {
    res.writeHead(404).end("Media not found");
    return;
  }
  const filePath = path.resolve(track.libraryPath, relativePath);
  if (!filePath.startsWith(track.libraryPath + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fsp.stat(filePath).then((stat) => {
    if (!stat.isFile()) {
      res.writeHead(404).end("Media not found");
      return;
    }
    const headers = {
      "Content-Type": mimeType(filePath),
      "Accept-Ranges": "bytes",
      "Content-Length": stat.size,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`
    };
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
      const end = range[2] && range[1] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start >= stat.size || end < start) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
        return;
      }
      headers["Content-Length"] = end - start + 1;
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      res.writeHead(206, headers);
      if (req.method === "HEAD")
        return res.end();
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD")
      return res.end();
    fs.createReadStream(filePath).pipe(res);
  }).catch(() => res.writeHead(404).end("Media not found"));
}
var httpServer = http3.createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname.startsWith("/dms/")) {
    if (pathname.startsWith("/dms/media/")) {
      streamMedia(req, res, pathname.slice("/dms".length));
      return;
    }
    server.handle(req, res, pathname.slice("/dms/".length));
    return;
  }
  if (pathname.startsWith("/media/")) {
    streamMedia(req, res, pathname);
    return;
  }
  res.writeHead(404).end("Not found");
});
httpServer.listen(port, host);
var ssdp = new SsdpAdvertiser;
ssdp.addDevice({ udn: server.udn, ...server.deviceTypeAndServices(), location: () => `${baseUrl}/device.xml` });
await ssdp.start();
console.log(`MediaPlay server listening at ${baseUrl}`);
