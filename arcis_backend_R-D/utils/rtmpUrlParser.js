// Parses third-party RTMP URLs of the form rtmp://<serverName>:<port>/<app>/<deviceId>
// e.g. rtmp://bihar2by2026.vmukti.com:80/live-record/VSPL-157731-CNBED
const RTMP_URL_REGEX = /^rtmp:\/\/([^:/]+)(?::(\d+))?\/([^/]+)\/(.+)$/i;

exports.parseRtmpUrl = (rtmpUrl) => {
    if (typeof rtmpUrl !== "string") {
        throw new Error("Invalid RTMP URL");
    }

    const match = rtmpUrl.trim().match(RTMP_URL_REGEX);
    if (!match) {
        throw new Error("Invalid RTMP URL");
    }

    const [, serverName, port, app, deviceId] = match;

    return {
        serverName,
        port: port || "80",
        app,
        deviceId,
    };
};
