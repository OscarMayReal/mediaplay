// mediaserver/index.ts
import http from "node:http";
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

// node_modules/@sonn-audio/node-upnp/dist/esm/renderer/mediaRenderer.js
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
    const body = await readBody(req);
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
    await readBody(req);
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
async function readBody(req) {
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
// node_modules/@sonn-audio/node-upnp/dist/esm/controlpoint/discovery.js
var endpointCache = new Map;
var recentDevices = new Map;
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
var httpServer = http.createServer((req, res) => {
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
