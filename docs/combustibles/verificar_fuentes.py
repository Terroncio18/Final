"""Read-only checks of public fuel sources; writes evidence beside this script.

Run with Python 3: python docs/combustibles/verificar_fuentes.py
No dependencies, credentials, changes to the app, or national bulk downloads.
The Soller GeoJSON is a small research sample, NOT a complete simulation domain.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


OUT = Path(__file__).resolve().parent
IDEIB = "https://ideib.caib.es/geoserveis/rest/services/public/GOIB_InvForestal_IB/MapServer/1"
MFE = "https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/biodiversidad/"
PORTUGAL = "https://pccir.isa.ulisboa.pt/arcgis/rest/services/Mapas/ModeloCombustivel/MapServer"
STAT = json.dumps([{
    "statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "n"
}])


def query(**params):
    return IDEIB + "/query?" + urlencode({"f": "json", "returnGeometry": "false", **params})


def fetch(url):
    request = Request(url, headers={"User-Agent": "IgnisLab-TFG fuel-source verification"})
    with urlopen(request, timeout=25) as response:
        data = response.read(8_000_001)
        if len(data) > 8_000_000:
            raise ValueError("Response exceeds research sample limit (8 MB)")
        content_type = response.headers.get("Content-Type", "")
        charset = response.headers.get_content_charset() or "utf-8"
        text = data.decode(charset, errors="replace")
        if "json" in content_type or text.lstrip().startswith("{"):
            body = json.loads(text)
            if "error" in body:
                raise ValueError(json.dumps(body["error"]))
        else:
            body = {
                "links": sorted(set(urljoin(url, link) for link in re.findall(
                    r'''(?:href|src)=["']([^"']+)''', text
                ) if any(token in link.lower() for token in (
                    "descargafichero", "mfe25_dd", "/es/cartografia-y-sig/ide/descargas/biodiversidad/mfe_",
                    "earthengine.app", "modeloCombustivel".lower()
                )))),
            }
        return {"status": response.status, "final_url": response.url,
                "content_type": content_type, "body": body}


def check(item):
    name, url = item
    result = {"url": url, "checked_at_utc": datetime.now(timezone.utc).isoformat()}
    try:
        result.update(fetch(url))
    except Exception as error:
        result["error"] = str(error)
    return name, result


def main():
    sample_bbox = [2.70, 39.73, 2.74, 39.77]
    urls = {
        "ideib_layer": IDEIB + "?f=pjson",
        "balears_models": query(where="1=1", groupByFieldsForStatistics="MODCOMB", outStatistics=STAT),
        "balears_unknown_land_use": query(where="MODCOMB=0", groupByFieldsForStatistics="TIPESTR", outStatistics=STAT),
        "balears_zero_meaning": query(where="MODCOMB=0", outFields="MODCOMB,M_COMBU,TIPESTR,ESTRUCT1", resultRecordCount=3),
        "soller_sample": query(
            f="geojson", where="1=1", geometry=",".join(map(str, sample_bbox)),
            geometryType="esriGeometryEnvelope", inSR=4326, outSR=4326,
            spatialRel="esriSpatialRelIntersects", returnGeometry="true",
            outFields="OBJECTID,POLIGON,MODCOMB,TIPESTR,FCCARB,FCCMAT,FCCHER,HMMAT,SP1",
            orderByFields="OBJECTID", resultRecordCount=1000,
        ),
        "mfe_download_index": MFE + "mfe.html",
        "mfe_balears": MFE + "mfe_illesbalears.html",
        "mfe_catalunya": MFE + "mfe_catalunia.html",
        "portugal_fire_modsat": PORTUGAL + "?f=pjson",
        "fire_res_app": "https://www.cirgeo.unipd.it/fire-res/app/",
    }
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = dict(pool.map(check, urls.items()))

    sample = results["soller_sample"].get("body", {})
    if sample.get("type") == "FeatureCollection":
        sample["metadata"] = {
            "source_url": results["soller_sample"]["url"],
            "checked_at_utc": results["soller_sample"]["checked_at_utc"],
            "bbox_filter": sample_bbox,
            "note": "Intersecting original polygons, NOT clipped; research sample only.",
            "transfer_limit_reported": bool(sample.get("exceededTransferLimit")),
            "completeness": "unverified if record count reaches 1000 or transfer limit is reported",
        }
        (OUT / "soller-muestra.geojson").write_text(json.dumps(sample, ensure_ascii=False), encoding="utf-8")
        results["soller_sample"]["body"] = {
            "feature_count": len(sample["features"]),
            "metadata": sample["metadata"], "file": "soller-muestra.geojson",
        }

    (OUT / "verificacion.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    for name, result in results.items():
        print(name, result.get("status", result.get("error")))
    print("Sample polygons:", len(sample.get("features", [])))


if __name__ == "__main__":
    main()
