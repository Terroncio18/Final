"""Download an original ZIP member by ranges, checking its CRC (Python 3 stdlib).

Output is a local subset ZIP, not a byte-for-byte copy of the upstream archive.
"""
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import urllib.request
import zipfile


class RemoteZip(io.RawIOBase):
    def __init__(self, url):
        self.url, self.position = url, 0
        with self.request("bytes=0-0") as response:
            match = re.fullmatch(r"bytes 0-0/(\d+)", response.headers.get("Content-Range", ""))
            if response.status != 206 or not match:
                raise ValueError("The server does not support exact byte ranges")
            self.length = int(match[1])
            self.etag = response.headers.get("ETag")
            self.modified = response.headers.get("Last-Modified")

    def request(self, byte_range):
        headers = {"Range": byte_range, "Accept-Encoding": "identity"}
        if getattr(self, "etag", None):
            headers["If-Match"] = self.etag
        return urllib.request.urlopen(urllib.request.Request(self.url, headers=headers), timeout=60)

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = offset if whence == 0 else self.position + offset if whence == 1 else self.length + offset
        if self.position < 0:
            raise ValueError("Negative archive offset")
        return self.position

    def read(self, size=-1):
        size = self.length - self.position if size < 0 else min(size, self.length - self.position)
        if size <= 0:
            return b""
        end = self.position + size - 1
        with self.request(f"bytes={self.position}-{end}") as response:
            expected = f"bytes {self.position}-{end}/{self.length}"
            if response.status != 206 or response.headers.get("Content-Range") != expected:
                raise ValueError("Shifted, incomplete or changed range response")
            if self.etag and response.headers.get("ETag") != self.etag:
                raise ValueError("Archive changed during download")
            data = response.read(size + 1)
        if len(data) != size:
            raise ValueError("Incomplete range response")
        self.position += size
        return data


def main():
    url, member, output = sys.argv[1:]
    if not url.startswith("https://") or Path(member).name != member:
        raise ValueError("An HTTPS URL and a flat member name are required")
    destination = Path(output)
    remote = RemoteZip(url)
    with zipfile.ZipFile(remote) as archive:
        entries = [entry for entry in archive.infolist() if entry.filename == member]
        if len(entries) != 1 or entries[0].file_size > 250_000_000:
            raise ValueError("Missing, ambiguous or oversized raster member")
        data = archive.read(entries[0])  # verifies original member CRC
    temporary = destination.with_suffix(".tmp")
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr(member, data)
    temporary.replace(destination)
    destination.with_suffix(".ranges.json").write_text(json.dumps({
        "url": url, "upstreamBytes": remote.length, "etag": remote.etag,
        "lastModified": remote.modified, "member": member,
        "memberSha256": hashlib.sha256(data).hexdigest(), "memberBytes": len(data),
        "mode": "original member extracted by ranges, CRC checked; local ZIP is a subset",
    }, indent=2), encoding="utf-8")
    print(f"Downloaded original member {member}: {len(data)} bytes")


if __name__ == "__main__":
    main()
